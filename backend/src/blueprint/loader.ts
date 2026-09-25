import type {
  BlueprintCompileResult,
  BlueprintIr,
  BlueprintIrAction,
  BlueprintManifest,
} from '@speckit/shared-schemas'
import { compileBlueprint } from './compiler'
import { unpackBlueprint, type UnpackedBlueprint } from './packager'
import type { AtomicRegistryService } from '../atomic-registry/atomic-registry.service'

export type LoadErrorReason =
  /** 清单里记录的 IR 摘要与重新编译得到的不一致。 */
  | 'ir-drift'
  /** 动作引用了没有解析到实现的原子。 */
  | 'unbound-atomic'
  /** 解析到的实现指认不出"要跑哪一份代码"。 */
  | 'implementation-unbound'

export class LoadError extends Error {
  constructor(
    message: string,
    readonly reason: LoadErrorReason,
  ) {
    super(message)
    this.name = 'LoadError'
  }
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
}

/**
 * 加载蓝图包 → 可执行计划。
 *
 * 四道关，任一不过即抛（**没有"部分加载"这种结果**）：
 *
 *   1. 包完整性：清单形状 / 分层一致性 / 逐文件哈希（B2 的解包已完成）
 *   2. 编译：逐文件 Schema → 依赖闭包 → 冲突检测 → IR（B3）
 *   3. **防漂移**：若清单记录了 `compiled.irDigest`，必须与本次重编的摘要一致
 *   4. 绑定：每个 `check` 动作必须解析到具体实现，且能指认要执行的代码
 *
 * 为什么"记录摘要不符"要拒而不是信记录：记录是**外部可写的数据**（包可能是别人给的），
 * 我们从不采信自述，只信自己重算的结果；记录的唯一用途就是拿来做这次比对。
 */
export async function loadBlueprint(
  packagePath: string,
  registry: AtomicRegistryService,
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

  const bindings = await resolveBindings(unpacked.manifest, registry)
  return {
    manifest: unpacked.manifest,
    ir: compiled.ir,
    irText: compiled.irText,
    plan: buildExecutionPlan(compiled, bindings),
  }
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
