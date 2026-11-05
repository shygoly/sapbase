import { createHash } from 'node:crypto'
import { assertSafeIdent } from './unique-index'

/**
 * 声明式查询索引。
 *
 * 与 `record-query` 的表达式必须逐字一致，否则索引不会被命中：
 *   · 文本 / 枚举 / 布尔 / 日期 → `(data->>'field')`
 *   · number / decimal / i32   → `((data->>'field')::numeric)`
 *
 * 谓词同时限定 `entity` 与 `blueprintId`：`blueprint_records` 是多份蓝图共用的
 * 一张表，只按字段建索引会让 A 的索引去拦 B 的写入/查询。
 */

const IDENT_ENTITY = /^[A-Z][A-Za-z0-9]*$/
const IDENT_FIELD = /^[a-z][A-Za-z0-9]*$/
const IDENT_BLUEPRINT = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const NUMERIC_TYPES = new Set(['number', 'decimal', 'i32'])

export interface QueryIndexFieldRef {
  entity: string
  field: string
  sqlType: 'text' | 'numeric'
}

export interface QueryIndexSemantic {
  entities: Array<{
    name: string
    fields: Array<{ name: string; type: string; indexed?: boolean }>
  }>
}

export interface SqlQueryable {
  query(sql: string, parameters?: unknown[]): Promise<unknown>
}

export function queryIndexFieldsOf(semantic: QueryIndexSemantic): QueryIndexFieldRef[] {
  const refs: QueryIndexFieldRef[] = []
  for (const entity of semantic.entities) {
    for (const field of entity.fields) {
      if (field.indexed !== true) continue
      refs.push({
        entity: entity.name,
        field: field.name,
        sqlType: NUMERIC_TYPES.has(field.type) ? 'numeric' : 'text',
      })
    }
  }
  return refs
}

/** 确定性索引名：qix_br_ + sha256(blueprintId, version, entity, field) 前 16 hex。 */
export function queryIndexName(
  blueprintId: string,
  version: string,
  entity: string,
  field: string,
): string {
  const digest = createHash('sha256')
    .update(`${blueprintId}\0${version}\0${entity}\0${field}`)
    .digest('hex')
    .slice(0, 16)
  return `qix_br_${digest}`
}

export function queryIndexExpression(field: string, sqlType: 'text' | 'numeric'): string {
  const json = `data->>'${field}'`
  return sqlType === 'numeric' ? `((${json})::numeric)` : `(${json})`
}

export function queryIndexDdl(
  semantic: QueryIndexSemantic,
  blueprintId: string,
  version = '',
): string[] {
  assertSafeIdent(blueprintId, IDENT_BLUEPRINT, '蓝图')
  return queryIndexFieldsOf(semantic).map((ref) => {
    assertSafeIdent(ref.entity, IDENT_ENTITY, '实体')
    assertSafeIdent(ref.field, IDENT_FIELD, '字段')
    const name = queryIndexName(blueprintId, version, ref.entity, ref.field)
    const expr = queryIndexExpression(ref.field, ref.sqlType)
    return (
      `CREATE INDEX IF NOT EXISTS ${name} ` +
      `ON public.blueprint_records (${expr}, "blueprintId", "organizationId") ` +
      `WHERE entity = '${ref.entity}' AND "blueprintId" = '${blueprintId}'`
    )
  })
}

export async function applyQueryIndexes(
  db: SqlQueryable,
  blueprintId: string,
  semantic: QueryIndexSemantic,
  version = '',
): Promise<void> {
  for (const ddl of queryIndexDdl(semantic, blueprintId, version)) {
    await db.query(ddl)
  }
}
