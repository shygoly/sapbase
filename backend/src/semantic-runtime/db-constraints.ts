import { createHash } from 'node:crypto'

/**
 * 非空 CHECK 约束生成 + 违规清单 + 约束名 → (entity, field) 映射。
 *
 * P2：字段 required 且类型是标量时，在 blueprint_records 上生成
 * `CHECK ("blueprintId" <> 'bp' OR entity <> 'X' OR (data->>'f') IS NOT NULL)`。
 * 必须带 blueprintId，否则一张表上多份蓝图会互相误伤（min 模板没有 full 的 required 字段）。
 * 先报告冲突再建约束，与 P1 唯一索引同一套路。
 */

import { uniqueFieldsOf, uniqueIndexName, type UniqueSemantic } from './unique-index'

const IDENT_ENTITY = /^[A-Z][A-Za-z0-9]*$/
const IDENT_FIELD = /^[a-z][A-Za-z0-9]*$/
const IDENT_BLUEPRINT = /^[A-Za-z0-9._-]+$/
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

export interface ConstraintFieldRef {
  entity: string
  field: string
}

export interface NotNullConflict {
  entity: string
  field: string
  organizationId: string
  ids: string[]
}

export interface ConstraintSemantic {
  entities: Array<{
    name: string
    fields: Array<{
      name: string
      type?: string
      required?: boolean
      unique?: boolean
      default?: unknown
    }>
  }>
}

export interface SqlQueryable {
  query(sql: string, parameters?: unknown[]): Promise<unknown>
}

export function requiredScalarFieldsOf(semantic: ConstraintSemantic): ConstraintFieldRef[] {
  const refs: ConstraintFieldRef[] = []
  for (const entity of semantic.entities) {
    for (const field of entity.fields) {
      if (
        field.required === true &&
        SCALAR_REQUIRED_TYPES.has(field.type ?? '') &&
        field.default === undefined
      ) {
        refs.push({ entity: entity.name, field: field.name })
      }
    }
  }
  return refs
}

/** 确定性约束名：nn_br_ + sha256(blueprintId, entity, field) 前 16 hex。 */
export function notNullConstraintName(blueprintId: string, entity: string, field: string): string {
  const digest = createHash('sha256')
    .update(`${blueprintId}\0${entity}\0${field}`)
    .digest('hex')
    .slice(0, 16)
  return `nn_br_${digest}`
}

export function notNullConstraintDdl(semantic: ConstraintSemantic, blueprintId: string): string[] {
  return requiredScalarFieldsOf(semantic).map((ref) => {
    assertSafeIdent(ref.entity, IDENT_ENTITY, '实体')
    assertSafeIdent(ref.field, IDENT_FIELD, '字段')
    const name = notNullConstraintName(blueprintId, ref.entity, ref.field)
    const bp = assertSafeBlueprintId(blueprintId)
    return (
      `DO $$ BEGIN ` +
      `IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN ` +
      `ALTER TABLE public.blueprint_records ADD CONSTRAINT ${name} ` +
      `CHECK ("blueprintId" <> '${bp}' OR entity <> '${ref.entity}' OR (data->>'${ref.field}') IS NOT NULL); ` +
      `END IF; END $$`
    )
  })
}

export async function findNotNullConflicts(
  db: SqlQueryable,
  blueprintId: string,
  semantic: ConstraintSemantic,
): Promise<NotNullConflict[]> {
  const conflicts: NotNullConflict[] = []
  for (const ref of requiredScalarFieldsOf(semantic)) {
    assertSafeIdent(ref.entity, IDENT_ENTITY, '实体')
    assertSafeIdent(ref.field, IDENT_FIELD, '字段')
    const rows = (await db.query(
      `SELECT "organizationId"::text AS "organizationId",
              json_agg(id::text) AS ids
         FROM public.blueprint_records
        WHERE "blueprintId" = $1
          AND entity = $2
          AND (data->>'${ref.field}') IS NULL
        GROUP BY "organizationId"`,
      [blueprintId, ref.entity],
    )) as Array<{ organizationId: string; ids: unknown }>
    for (const row of rows) {
      conflicts.push({
        entity: ref.entity,
        field: ref.field,
        organizationId: row.organizationId,
        ids: asIdList(row.ids),
      })
    }
  }
  return conflicts
}

export async function applyNotNullConstraints(
  db: SqlQueryable,
  blueprintId: string,
  semantic: ConstraintSemantic,
): Promise<NotNullConflict[]> {
  const conflicts = await findNotNullConflicts(db, blueprintId, semantic)
  if (conflicts.length > 0) return conflicts
  for (const ddl of notNullConstraintDdl(semantic, blueprintId)) {
    await db.query(ddl)
  }
  return []
}

export function constraintFieldMap(
  blueprintId: string,
  semantic: ConstraintSemantic,
): Map<string, ConstraintFieldRef> {
  const map = new Map<string, ConstraintFieldRef>()
  for (const ref of requiredScalarFieldsOf(semantic)) {
    map.set(notNullConstraintName(blueprintId, ref.entity, ref.field), ref)
  }
  for (const ref of uniqueFieldsOf(semantic as UniqueSemantic)) {
    map.set(uniqueIndexName(blueprintId, ref.entity, ref.field), ref)
  }
  return map
}

export function locateConstraintField(
  map: Map<string, ConstraintFieldRef>,
  constraintName: string | undefined,
): ConstraintFieldRef | undefined {
  if (!constraintName) return undefined
  const direct = map.get(constraintName)
  if (direct) return direct
  for (const [name, ref] of map) {
    if (constraintName.includes(name)) return ref
  }
  return undefined
}

function assertSafeIdent(value: string, pattern: RegExp, label: string): void {
  if (!pattern.test(value)) {
    throw new Error(`${label}名非法，拒绝编入 DDL：${value}`)
  }
}

function assertSafeBlueprintId(value: string): string {
  if (!IDENT_BLUEPRINT.test(value)) {
    throw new Error(`蓝图 id 非法，拒绝编入 DDL：${value}`)
  }
  return value
}

function asIdList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map((item) => String(item))
    } catch {
      return [value]
    }
  }
  return []
}
