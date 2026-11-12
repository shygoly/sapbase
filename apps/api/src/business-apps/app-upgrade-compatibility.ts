import type { SemanticEntity } from '@sap/platform-release/blueprint/compiler'

export interface AppUpgradeRecord {
  entity: string
  data: Record<string, unknown>
  state?: string | null
}

export interface AppUpgradeCompatibilityInput {
  current: SemanticEntity[]
  target: SemanticEntity[]
  records: AppUpgradeRecord[]
}

export interface AppUpgradeCompatibilityResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

/**
 * 应用升级数据兼容检查（确定性，不查库）。
 *
 * 阻断：实体删除、字段删除仍有值、字段类型变化、状态被删除、枚举值被删除、
 * 新必填字段无默认值且旧记录缺值。
 * 非阻断：新增可选字段/状态。
 */
export function checkAppUpgradeCompatibility(
  input: AppUpgradeCompatibilityInput,
): AppUpgradeCompatibilityResult {
  const errors = new Set<string>()
  const warnings = new Set<string>()
  const targetEntities = new Map(input.target.map((entity) => [entity.name, entity]))
  const currentEntities = new Map(input.current.map((entity) => [entity.name, entity]))

  for (const entity of input.target) {
    if (!currentEntities.has(entity.name)) {
      warnings.add(`新增实体：${entity.name}`)
    }
  }

  const recordsByEntity = new Map<string, AppUpgradeRecord[]>()
  for (const record of input.records) {
    const list = recordsByEntity.get(record.entity) ?? []
    list.push(record)
    recordsByEntity.set(record.entity, list)
  }

  for (const [entityName, records] of recordsByEntity) {
    const current = currentEntities.get(entityName)
    const target = targetEntities.get(entityName)
    if (!current) {
      warnings.add(`记录引用了当前版本未声明的实体：${entityName}`)
      continue
    }
    if (!target) {
      errors.add(`实体 ${entityName} 在目标版本被删除，但仍有 ${records.length} 条记录`)
      continue
    }

    const targetFields = new Map(target.fields.map((field) => [field.name, field]))
    for (const field of current.fields) {
      const next = targetFields.get(field.name)
      if (!next) {
        const used = records.filter((record) => hasValue(record.data[field.name]))
        if (used.length > 0) {
          errors.add(
            `字段 ${entityName}.${field.name} 被删除，但 ${used.length} 条记录仍有值`,
          )
        } else {
          warnings.add(`字段 ${entityName}.${field.name} 被删除（旧记录均为空）`)
        }
        continue
      }
      if (next.type !== field.type) {
        errors.add(
          `字段 ${entityName}.${field.name} 类型从 ${field.type} 变为 ${next.type}`,
        )
        continue
      }
      if (
        field.type === 'enum' &&
        next.values &&
        next.values.length > 0
      ) {
        const removed = new Set(
          (field.values ?? []).filter((value) => !next.values!.includes(value)),
        )
        if (removed.size > 0) {
          const used = records.filter(
            (record) =>
              typeof record.data[field.name] === 'string' &&
              removed.has(record.data[field.name] as string),
          )
          if (used.length > 0) {
            errors.add(
              `字段 ${entityName}.${field.name} 删除了仍被使用的枚举值：${[...removed].join(', ')}`,
            )
          }
        }
      }
      if (
        field.type === 'asset' &&
        field.assetKind &&
        next.assetKind &&
        field.assetKind !== next.assetKind
      ) {
        errors.add(
          `资产字段 ${entityName}.${field.name} 类型从 ${field.assetKind} 变为 ${next.assetKind}`,
        )
      }
    }

    for (const field of target.fields) {
      if (!field.required || field.default !== undefined) continue
      const missing = records.filter((record) => !hasValue(record.data[field.name]))
      if (missing.length > 0) {
        errors.add(
          `新必填字段 ${entityName}.${field.name} 缺少默认值，${missing.length} 条旧记录无值`,
        )
      }
    }

    const targetStates = new Set(target.states.map((state) => state.name))
    const removedStates = new Set(
      current.states
        .map((state) => state.name)
        .filter((name) => !targetStates.has(name)),
    )
    if (removedStates.size > 0) {
      const used = records.filter(
        (record) =>
          typeof record.state === 'string' && removedStates.has(record.state),
      )
      if (used.length > 0) {
        errors.add(
          `实体 ${entityName} 删除了仍被记录使用的状态：${[
            ...removedStates,
          ].join(', ')}`,
        )
      }
    }
  }

  return {
    ok: errors.size === 0,
    errors: [...errors],
    warnings: [...warnings],
  }
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}
