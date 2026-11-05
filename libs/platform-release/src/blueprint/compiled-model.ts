import type {
  AccountingRule,
  ApprovalRule,
  PermissionsFile,
  SemanticEntity,
  UiFile,
  ValidationRule,
} from './compiler'
import { CompileError } from './compiler'

/**
 * 运行时可用的编译产物。
 *
 * 与 IR 的分工：
 *   · IR 是**协议/审计形态**（实体数、事件、层 digest），会被清单引用；
 *   · CompiledBlueprint 是**运行时形态**（实体/规则/索引计划），不进包、不参与签名。
 *
 * 它只在缓存未命中时构建；构建失败按编译失败处理，不产出半成品。
 */
export const COMPILED_BLUEPRINT_FORMAT = 'blueprint-runtime/v1' as const

export type CompiledIndexKind = 'query' | 'unique' | 'not-null'
export type CompiledIndexSqlType = 'text' | 'numeric'

export interface CompiledIndexPlanItem {
  entity: string
  field: string
  kind: CompiledIndexKind
  sqlType: CompiledIndexSqlType
}

export interface CompiledTemplate {
  entities: SemanticEntity[]
  validation: ValidationRule[]
  approval: ApprovalRule[]
  accounting: AccountingRule[]
}

export interface CompiledBlueprint {
  format: typeof COMPILED_BLUEPRINT_FORMAT
  blueprint: string
  version: string
  irDigest: string
  compiledAt: string
  template: CompiledTemplate
  indexPlan: CompiledIndexPlanItem[]
  /** 页面/菜单发布层（可选） */
  ui?: UiFile
  /** 角色/资源/数据范围发布层（可选） */
  permissions?: PermissionsFile
}

const NUMERIC_TYPES = new Set(['number', 'decimal', 'i32'])
const SCALAR_REQUIRED_TYPES = new Set([
  'text',
  'number',
  'decimal',
  'i32',
  'boolean',
  'date',
  'datetime',
  'enum',
])

function sqlTypeOf(type: string): CompiledIndexSqlType {
  return NUMERIC_TYPES.has(type) ? 'numeric' : 'text'
}

/**
 * 唯一索引 / 非空约束已经由既有运行时生成；这里只把同一份语义汇总成计划，
 * 额外加入作者显式声明的 `indexed` 查询索引。
 */
export function buildIndexPlan(entities: SemanticEntity[]): CompiledIndexPlanItem[] {
  const plan: CompiledIndexPlanItem[] = []
  for (const entity of entities) {
    for (const field of entity.fields) {
      const sqlType = sqlTypeOf(field.type)
      if (field.unique === true) {
        plan.push({ entity: entity.name, field: field.name, kind: 'unique', sqlType })
      }
      if (
        field.required === true &&
        SCALAR_REQUIRED_TYPES.has(field.type) &&
        field.default === undefined
      ) {
        plan.push({ entity: entity.name, field: field.name, kind: 'not-null', sqlType })
      }
      if (field.indexed === true) {
        plan.push({ entity: entity.name, field: field.name, kind: 'query', sqlType })
      }
    }
  }
  return plan
}

export interface BuildCompiledBlueprintInput {
  blueprint: string
  version: string
  irDigest: string
  files: Map<string, Buffer>
}

export function buildCompiledBlueprint(
  input: BuildCompiledBlueprintInput,
): CompiledBlueprint {
  const semanticBytes = input.files.get('semantic.json')
  if (!semanticBytes) {
    throw new CompileError('包内缺少 semantic.json，无法构建运行时模型', 'schema-invalid')
  }

  let semantic: { entities?: SemanticEntity[] }
  try {
    semantic = JSON.parse(semanticBytes.toString('utf8')) as { entities?: SemanticEntity[] }
  } catch (error) {
    throw new CompileError(
      `semantic.json 不是合法 JSON：${(error as Error).message}`,
      'schema-invalid',
    )
  }
  if (!Array.isArray(semantic.entities)) {
    throw new CompileError('semantic.json 缺少 entities 数组', 'schema-invalid')
  }

  let rules: {
    validation?: ValidationRule[]
    approval?: ApprovalRule[]
    accounting?: AccountingRule[]
  } = {}
  const rulesBytes = input.files.get('rules.json')
  if (rulesBytes) {
    try {
      rules = JSON.parse(rulesBytes.toString('utf8')) as typeof rules
    } catch (error) {
      throw new CompileError(
        `rules.json 不是合法 JSON：${(error as Error).message}`,
        'schema-invalid',
      )
    }
  }

  let ui: UiFile | undefined
  const uiBytes = input.files.get('ui.json')
  if (uiBytes) {
    try {
      ui = JSON.parse(uiBytes.toString('utf8')) as UiFile
    } catch (error) {
      throw new CompileError(`ui.json 不是合法 JSON：${(error as Error).message}`, 'schema-invalid')
    }
  }

  let permissions: PermissionsFile | undefined
  const permissionBytes = input.files.get('permissions.json')
  if (permissionBytes) {
    try {
      permissions = JSON.parse(permissionBytes.toString('utf8')) as PermissionsFile
    } catch (error) {
      throw new CompileError(
        `permissions.json 不是合法 JSON：${(error as Error).message}`,
        'schema-invalid',
      )
    }
  }

  return {
    format: COMPILED_BLUEPRINT_FORMAT,
    blueprint: input.blueprint,
    version: input.version,
    irDigest: input.irDigest,
    compiledAt: new Date().toISOString(),
    template: {
      entities: semantic.entities,
      validation: rules.validation ?? [],
      approval: rules.approval ?? [],
      accounting: rules.accounting ?? [],
    },
    indexPlan: buildIndexPlan(semantic.entities),
    ...(ui ? { ui } : {}),
    ...(permissions ? { permissions } : {}),
  }
}
