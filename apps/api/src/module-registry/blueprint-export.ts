import type { BlueprintDependency } from '@speckit/shared-schemas'
import type { BlueprintMeta } from '../blueprint/packager'

/**
 * v1 平台只有一条 runtime 线（1.x）。导出时统一写平台当前范围，
 * 而不是让每个模块各写一个 —— 否则同一个平台会导出互相矛盾的 runtime 声明。
 * 等 runtime 自身版本化（多条线并存）时，这里改成读平台配置。
 */
export const PLATFORM_RUNTIME_RANGE = '>=1.0.0 <2.0.0'

export type BlueprintExportErrorReason =
  | 'invalid-name'
  | 'invalid-version'
  | 'invalid-dependency'
  | 'no-entities'

export class BlueprintExportError extends Error {
  constructor(
    message: string,
    readonly reason: BlueprintExportErrorReason,
  ) {
    super(message)
    this.name = 'BlueprintExportError'
  }
}

const BLUEPRINT_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const ENTITY_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/

/** 模块名 → 蓝图标识（kebab-case）。 */
export function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

/**
 * 导出用的蓝图标识与版本 —— 两者都必须能通过包协议。
 *
 * 宁可在导出时拒绝，也不要打出一个 manifest 通不过协议校验的包：
 * 那种包要到加载侧才炸，报错点离原因很远。
 */
export function blueprintIdentity(
  name: string,
  version: string,
): { blueprint: string; version: string } {
  const blueprint = toKebabCase(name)
  if (!BLUEPRINT_ID_PATTERN.test(blueprint)) {
    throw new BlueprintExportError(
      `模块名「${name}」无法转成合法的蓝图标识（得到「${blueprint}」，需形如 auto-parts-erp）`,
      'invalid-name',
    )
  }
  if (!SEMVER_PATTERN.test(version)) {
    throw new BlueprintExportError(
      `模块版本「${version}」不是语义化版本（需形如 1.0.0）`,
      'invalid-version',
    )
  }
  return { blueprint, version }
}

export interface EntityNameSource {
  /** 模块记录里显式声明的实体名（`metadata.entities`）。 */
  declared?: string[]
  /** capability 上写的实体名（更早的模块只有这一处）。 */
  capabilities?: Array<string | null | undefined>
}

export interface CollectedEntityNames {
  names: string[]
  /** 舍弃的候选及原因（**必须回报给调用方**，不允许静默丢弃）。 */
  dropped: Array<{ name: string; reason: string }>
}

/**
 * 收集模块声明的实体名。
 *
 * 优先 `metadata.entities`（显式声明），并上 capability 里的实体名（历史数据只有这一处）。
 * 不满足实体命名约定的候选**不静默丢掉**，而是连原因一起回报。
 */
export function collectEntityNames(source: EntityNameSource): CollectedEntityNames {
  const names: string[] = []
  const dropped: Array<{ name: string; reason: string }> = []
  const seen = new Set<string>()

  for (const candidate of [...(source.declared ?? []), ...(source.capabilities ?? [])]) {
    if (!candidate) continue
    if (!ENTITY_NAME_PATTERN.test(candidate)) {
      if (!dropped.some((entry) => entry.name === candidate)) {
        dropped.push({ name: candidate, reason: '不满足实体命名约定（需形如 SalesOrder）' })
      }
      continue
    }
    if (seen.has(candidate)) continue
    seen.add(candidate)
    names.push(candidate)
  }

  return { names, dropped }
}

/**
 * `dependsOnAtomics`（`atomicType@range`）→ 包协议里的依赖声明。
 *
 * 格式非法即拒：把一个解析不了的字符串塞进包，等于把一个"编译期才发现的错"
 * 藏进交付物里。
 */
export function parseAtomicDependencies(dependsOnAtomics: string[]): BlueprintDependency[] {
  return dependsOnAtomics.map((dependency) => {
    const at = dependency.lastIndexOf('@')
    if (at <= 0 || at === dependency.length - 1) {
      throw new BlueprintExportError(
        `原子依赖「${dependency}」格式非法（需形如 available-inventory@^1.0.0）`,
        'invalid-dependency',
      )
    }
    const atomic = dependency.slice(0, at)
    const version = dependency.slice(at + 1)
    if (!BLUEPRINT_ID_PATTERN.test(atomic)) {
      throw new BlueprintExportError(
        `原子类型「${atomic}」不是合法的 kebab-case 标识`,
        'invalid-dependency',
      )
    }
    return { atomic, version }
  })
}

export interface MinimalBlueprintInput {
  name: string
  version: string
  entityNames: string[]
  dependencies: BlueprintDependency[]
}

export interface MinimalBlueprint {
  meta: BlueprintMeta
  semantic: { entities: Array<Record<string, unknown>> }
}

/**
 * 模块记录 → 最小蓝图（骨架）。
 *
 * 只声明模块**确实拥有**的东西：实体名（来自 capability / metadata）与原子依赖
 * （来自 `dependsOnAtomics`，且逐条解析过）。字段与生命周期**不编**——
 * 模块记录里没有这两样语义，编出来就是平台在替作者做业务假设。
 *
 * 那为什么每个实体仍要写状态机？因为 v1 协议要求实体必须有状态机
 * （初始态唯一 + 有终态）。所以这里给的是**最小可编译**的形状：
 * 一个既是初始态又是终态的 `active`，语义是"生命周期尚未建模"，不是一条业务流程。
 */
export function buildMinimalBlueprint(input: MinimalBlueprintInput): MinimalBlueprint {
  if (input.entityNames.length === 0) {
    throw new BlueprintExportError(
      '模块没有可导出的实体（capability 未声明 entity，metadata.entities 也为空）—— 导出空骨架没有意义',
      'no-entities',
    )
  }

  const { blueprint, version } = blueprintIdentity(input.name, input.version)
  return {
    meta: {
      blueprint,
      version,
      runtime: PLATFORM_RUNTIME_RANGE,
      ...(input.dependencies.length ? { dependencies: input.dependencies } : {}),
    },
    semantic: {
      entities: input.entityNames.map((name) => ({
        name,
        fields: [],
        states: [{ name: 'active', initial: true, final: true }],
      })),
    },
  }
}
