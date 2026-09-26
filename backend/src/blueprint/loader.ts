import type {
  BlueprintCompileResult,
  BlueprintIr,
  BlueprintIrAction,
  BlueprintManifest,
} from '@speckit/shared-schemas'
import { Validator } from 'jsonschema'
import { loadSchema } from '../common/protocol/schema-loader'
import { compileBlueprint } from './compiler'
import {
  isUnsignedExemption,
  verifyAgainstTrustRoots,
  type BlueprintLicense,
} from './license'
import { unpackBlueprint, type UnpackedBlueprint } from './packager'
import type { AtomicRegistryService } from '../atomic-registry/atomic-registry.service'

export type LoadErrorReason =
  /** 清单里记录的 IR 摘要与重新编译得到的不一致。 */
  | 'ir-drift'
  /** 动作引用了没有解析到实现的原子。 */
  | 'unbound-atomic'
  /** 解析到的实现指认不出"要跑哪一份代码"。 */
  | 'implementation-unbound'
  | 'license-missing'
  | 'license-invalid'
  | 'signature-invalid'
  | 'unauthorized'
  | 'license-expired'
  | 'unsigned-exemption-in-production'

export class LoadError extends Error {
  constructor(
    message: string,
    readonly reason: LoadErrorReason,
  ) {
    super(message)
    this.name = 'LoadError'
  }
}

export interface LoadBlueprintOptions {
  tenantId?: string
  now?: Date
  allowUnsigned?: boolean
  env?: NodeJS.ProcessEnv
}

export interface BlueprintAuditRecord {
  action: string
  detail?: Record<string, unknown>
}

/**
 * 一个原子依赖在**加载这一刻**的绑定结果。
 *
 * 关键在 `moduleSha256`：执行期要能指认"客户同意跑的那一份代码"，
 * 所以加载阶段就把哈希定下来，而不是等到第一次调用时再查。
 */
export interface AtomicBinding {
  /** 原子类型（包内声明的名字） */
  atomic: string
  /** 包内声明的版本范围 */
  requested: string
  /** 实际解析到的契约版本 */
  version: string
  implementationKind: string
  /** Wasm 实现必填；TS 实现为 null */
  moduleSha256: string | null
  tier: string | null
}

export interface LoadedAction extends BlueprintIrAction {
  /** kind=check 时：绑定到的原子实现（含契约版本与模块哈希） */
  binding?: AtomicBinding
}

export interface LoadedEvent {
  on: string
  actions: LoadedAction[]
}

/** 可执行计划：IR 事件 + 逐动作的原子绑定。 */
export interface BlueprintExecutionPlan {
  blueprint: string
  version: string
  runtime: string
  irDigest: string
  events: LoadedEvent[]
  resolvedAtomics: AtomicBinding[]
}

export interface LoadedBlueprint {
  manifest: BlueprintManifest
  ir: BlueprintIr
  irText: string
  plan: BlueprintExecutionPlan
  /** 装载器保持纯函数：审计记录收集到返回值，由 service 落库。 */
  audit: BlueprintAuditRecord[]
  /** 授权声明（豁免路径可能缺省）；resell 只透出，不做装载门。 */
  license?: Pick<BlueprintLicense, 'grantedTo' | 'resell' | 'expiresAt' | 'issuer'>
}

/**
 * 加载蓝图包 → 可执行计划。
 *
 * 七道关，任一不过即抛（**没有"部分加载"这种结果**）：
 *
 *   1. 包完整性：清单形状 / 分层一致性 / 逐文件哈希
 *   2. 编译：逐文件 Schema → 依赖闭包 → 冲突检测 → IR
 *   3. 防漂移：若清单记录了 `compiled.irDigest`，必须与本次重编的摘要一致
 *   4. license.json 存在且形状合法
 *   5. 验签（Ed25519，公钥来自信任根）
 *   6. 授权匹配（tenantId ∈ grantedTo；expiresAt 未过期）
 *   7. 绑定：每个 `check` 动作必须解析到具体实现
 *
 * 第 3 参可选（向后兼容）。`BLUEPRINT_ALLOW_UNSIGNED` 只豁免 4–6，不豁免 1–3 / 7。
 */
export async function loadBlueprint(
  packagePath: string,
  registry: AtomicRegistryService,
  options?: LoadBlueprintOptions,
): Promise<LoadedBlueprint> {
  const unpacked: UnpackedBlueprint = unpackBlueprint(packagePath)
  const compiled = await compileBlueprint(unpacked, registry)

  const recorded = unpacked.manifest.compiled?.irDigest
  if (recorded && recorded !== compiled.irDigest) {
    throw new LoadError(
      `IR 摘要不符：清单记录 ${recorded}，重新编译得到 ${compiled.irDigest}（包内容与编译结果已漂移）`,
      'ir-drift',
    )
  }

  const env = options?.env ?? process.env
  const exemption = isUnsignedExemption(env, options?.allowUnsigned)
  if (exemption && env.NODE_ENV === 'production') {
    throw new LoadError(
      '生产环境禁止未签名豁免（BLUEPRINT_ALLOW_UNSIGNED）：该开关在生产必须被拒绝，不是警告',
      'unsigned-exemption-in-production',
    )
  }

  const audit: BlueprintAuditRecord[] = []
  let license: LoadedBlueprint['license']

  if (exemption) {
    audit.push({
      action: 'blueprint.load.unsigned',
      detail: { reason: 'BLUEPRINT_ALLOW_UNSIGNED' },
    })
  } else {
    const checked = checkLicenseChain(unpacked, env, options)
    license = {
      grantedTo: checked.grantedTo,
      resell: checked.resell,
      expiresAt: checked.expiresAt,
      issuer: checked.issuer,
    }
    audit.push({
      action: 'blueprint.load.authorized',
      detail: {
        tenantId: options?.tenantId,
        grantedTo: checked.grantedTo,
        resell: checked.resell,
        expiresAt: checked.expiresAt,
        issuer: checked.issuer,
      },
    })
  }

  const bindings = await resolveBindings(unpacked.manifest, registry)
  return {
    manifest: unpacked.manifest,
    ir: compiled.ir,
    irText: compiled.irText,
    plan: buildExecutionPlan(compiled, bindings),
    audit,
    ...(license ? { license } : {}),
  }
}

function checkLicenseChain(
  unpacked: UnpackedBlueprint,
  env: NodeJS.ProcessEnv,
  options?: LoadBlueprintOptions,
): BlueprintLicense {
  const bytes = unpacked.files.get('license.json')
  if (!bytes) {
    throw new LoadError('包内缺少 license.json（未签名豁免未开启）', 'license-missing')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    throw new LoadError(`license.json 不是合法 JSON：${(error as Error).message}`, 'license-invalid')
  }

  const shape = new Validator().validate(parsed, loadSchema('blueprint-license.schema.json'))
  if (!shape.valid) {
    throw new LoadError(
      `license.json 形状非法：${shape.errors.map((error) => error.message).join('; ')}`,
      'license-invalid',
    )
  }

  const license = parsed as BlueprintLicense
  const signature = unpacked.manifest.signature
  if (license.signature && license.signature !== signature) {
    throw new LoadError(
      'license.json.signature 与 manifest.signature 不一致',
      'signature-invalid',
    )
  }
  if (!signature) {
    throw new LoadError('清单缺少 signature（权威签名在 manifest.signature）', 'signature-invalid')
  }
  if (!verifyAgainstTrustRoots(unpacked.manifest, signature, env)) {
    throw new LoadError(
      '验签失败：签名无效或信任根未配置（BLUEPRINT_LICENSE_PUBLIC_KEYS）',
      'signature-invalid',
    )
  }

  if (license.grantedTo.length > 0) {
    if (!options?.tenantId) {
      throw new LoadError(
        '授权范围非空，但装载未提供 tenantId（无租户上下文不能证明被授权）',
        'unauthorized',
      )
    }
    if (!license.grantedTo.includes(options.tenantId)) {
      throw new LoadError(
        `租户 ${options.tenantId} 不在授权范围 ${license.grantedTo.join(', ')}`,
        'unauthorized',
      )
    }
  }

  if (license.expiresAt) {
    const expires = new Date(license.expiresAt)
    if (Number.isNaN(expires.getTime())) {
      throw new LoadError(`expiresAt 无法解析：${license.expiresAt}`, 'license-invalid')
    }
    const now = options?.now ?? new Date()
    if (now.getTime() > expires.getTime()) {
      throw new LoadError(`授权已过期：expiresAt ${license.expiresAt}`, 'license-expired')
    }
  }

  return license
}

/**
 * 解析原子依赖 → 绑定。
 *
 * 这里会对原子依赖做**第二次**解析（编译时已解析过一次）：编译关心的是"能不能满足"，
 * 加载关心的是"绑定到哪一份实现"。v1 的注册表是一次数据库读，成本可忽略；
 * 等注册表变成跨进程服务时再合并成一次解析（否则等于提前优化）。
 */
async function resolveBindings(
  manifest: BlueprintManifest,
  registry: AtomicRegistryService,
): Promise<AtomicBinding[]> {
  const bindings: AtomicBinding[] = []
  for (const dependency of manifest.dependencies ?? []) {
    // v1 只绑定原子依赖；模块/蓝图依赖只登记（跨包解析属市场与注册表那条线）
    if (!('atomic' in dependency)) continue

    const resolved = await registry.resolve(dependency.atomic, dependency.version)
    const moduleSha256 = resolved.implementation.moduleSha256 ?? null
    if (resolved.implementation.kind === 'wasm' && !moduleSha256) {
      // 宁可加载失败，也不要一个"第一次调用才知道跑不了"的计划
      throw new LoadError(
        `原子 ${dependency.atomic}@${resolved.contract.version} 的 Wasm 实现没有 moduleSha256 —— 指认不出要执行的代码`,
        'implementation-unbound',
      )
    }

    bindings.push({
      atomic: dependency.atomic,
      requested: dependency.version,
      version: resolved.contract.version,
      implementationKind: resolved.implementation.kind,
      moduleSha256,
      tier: resolved.implementation.tier ?? null,
    })
  }
  return bindings
}

/**
 * IR 事件 + 绑定 → 可执行计划。
 *
 * 每个 `check` 动作都必须绑到已解析的原子：绑定表是按**清单声明的原子**建的，
 * 而编译器只允许调用已声明的原子，所以正常路径下这里必然命中。
 * 保留这条判定作为纵深防御 —— 计划里出现一个悬空动作，等于计划本身不可执行。
 */
export function buildExecutionPlan(
  compiled: BlueprintCompileResult,
  bindings: AtomicBinding[],
): BlueprintExecutionPlan {
  const byAtomic = new Map(bindings.map((binding) => [binding.atomic, binding]))

  const events: LoadedEvent[] = compiled.ir.events.map((event) => ({
    on: event.on,
    actions: event.actions.map((action) => {
      if (action.kind !== 'check') return { ...action }
      const atomic = (action.atomic ?? '').split('@')[0]
      const binding = byAtomic.get(atomic)
      if (!binding) {
        throw new LoadError(
          `事件 ${event.on} 调用了未解析的原子 ${action.atomic} —— 拒绝加载（不做部分加载）`,
          'unbound-atomic',
        )
      }
      return { ...action, binding }
    }),
  }))

  return {
    blueprint: compiled.blueprint,
    version: compiled.version,
    runtime: compiled.ir.runtime,
    irDigest: compiled.irDigest,
    events,
    resolvedAtomics: bindings,
  }
}
