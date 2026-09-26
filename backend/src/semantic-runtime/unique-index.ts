import { createHash } from 'node:crypto'

/**
 * 按模板声明生成 `blueprint_records` 上的部分唯一索引。
 *
 * P1：装载时幂等应用（先冲突清单，有冲突拒写；无冲突再 CREATE UNIQUE INDEX IF NOT EXISTS）。
 * P2 再扩展：非空约束，以及冲突时返回可定位错误的完整形态。
 * 索引名由 blueprintId / entity / field 派生，重复应用幂等。
 */

const IDENT_ENTITY = /^[A-Z][A-Za-z0-9]*$/
const IDENT_FIELD = /^[a-z][A-Za-z0-9]*$/
/** 蓝图 id 的形状与 manifest 的 `blueprint` 一致（kebab-case）；它要进 DDL 字面量，必须校验。 */
const IDENT_BLUEPRINT = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export interface UniqueFieldRef {
  entity: string
  field: string
}

export interface UniqueConflict {
  entity: string
  field: string
  value: string
  /**
   * 冲突所属租户。**必须与索引的唯一性定义一致**：索引键是
   * `(data->>'field', blueprintId, organizationId)`，因此"唯一"是**按租户**的。
   * 不带上租户就会把"两个租户各自都有 P-001"误报成冲突，把多租户写入全部堵死。
   */
  organizationId: string
  ids: string[]
}

export interface UniqueSemantic {
  entities: Array<{
    name: string
    fields: Array<{ name: string; unique?: boolean }>
  }>
}

export interface SqlQueryable {
  query(sql: string, parameters?: unknown[]): Promise<unknown>
}

export function uniqueFieldsOf(semantic: UniqueSemantic): UniqueFieldRef[] {
  const refs: UniqueFieldRef[] = []
  for (const entity of semantic.entities) {
    for (const field of entity.fields) {
      if (field.unique === true) {
        refs.push({ entity: entity.name, field: field.name })
      }
    }
  }
  return refs
}

/** 确定性索引名：ux_br_ + sha256(blueprintId, entity, field) 前 16 hex。 */
export function uniqueIndexName(blueprintId: string, entity: string, field: string): string {
  const digest = createHash('sha256')
    .update(`${blueprintId}\0${entity}\0${field}`)
    .digest('hex')
    .slice(0, 16)
  return `ux_br_${digest}`
}

export function uniqueIndexDdl(semantic: UniqueSemantic, blueprintId: string): string[] {
  assertSafeIdent(blueprintId, IDENT_BLUEPRINT, '蓝图')
  return uniqueFieldsOf(semantic).map((ref) => {
    assertSafeIdent(ref.entity, IDENT_ENTITY, '实体')
    assertSafeIdent(ref.field, IDENT_FIELD, '字段')
    const name = uniqueIndexName(blueprintId, ref.entity, ref.field)
    // 谓词**必须**同时限定 blueprintId：blueprint_records 是多份蓝图共用的一张表，
    // 只按 entity 限定会让 A 蓝图的索引也去拦 B 蓝图的写入，且报错里出现的是 A 的索引名
    // —— 于是 B 的错误映射查不到 (entity, field)，"可定位的错误"就废了。
    return (
      `CREATE UNIQUE INDEX IF NOT EXISTS ${name} ` +
      `ON public.blueprint_records ((data->>'${ref.field}'), "blueprintId", "organizationId") ` +
      `WHERE entity = '${ref.entity}' AND "blueprintId" = '${blueprintId}'`
    )
  })
}

/**
 * 幂等应用唯一索引。有冲突 → 返回清单（调用方拒写），不硬建索引。
 * 无冲突 → CREATE UNIQUE INDEX IF NOT EXISTS。
 */
export async function applyUniqueIndexes(
  db: SqlQueryable,
  blueprintId: string,
  semantic: UniqueSemantic,
): Promise<UniqueConflict[]> {
  const conflicts = await findUniqueConflicts(db, blueprintId, semantic)
  if (conflicts.length > 0) return conflicts
  for (const ddl of uniqueIndexDdl(semantic, blueprintId)) {
    await db.query(ddl)
  }
  return []
}

export async function findUniqueConflicts(
  db: SqlQueryable,
  blueprintId: string,
  semantic: UniqueSemantic,
): Promise<UniqueConflict[]> {
  const conflicts: UniqueConflict[] = []
  for (const ref of uniqueFieldsOf(semantic)) {
    assertSafeIdent(ref.entity, IDENT_ENTITY, '实体')
    assertSafeIdent(ref.field, IDENT_FIELD, '字段')
    const rows = (await db.query(
      `SELECT data->>'${ref.field}' AS value,
              "organizationId"::text AS "organizationId",
              json_agg(id::text) AS ids
         FROM public.blueprint_records
        WHERE "blueprintId" = $1
          AND entity = $2
          AND data->>'${ref.field}' IS NOT NULL
        GROUP BY data->>'${ref.field}', "organizationId"
       HAVING COUNT(*) > 1`,
      [blueprintId, ref.entity],
    )) as Array<{ value: string; organizationId: string; ids: unknown }>
    for (const row of rows) {
      conflicts.push({
        entity: ref.entity,
        field: ref.field,
        value: row.value,
        organizationId: row.organizationId,
        ids: asIdList(row.ids),
      })
    }
  }
  return conflicts
}

function assertSafeIdent(value: string, pattern: RegExp, label: string): void {
  if (!pattern.test(value)) {
    throw new Error(`${label}名非法，拒绝编入 DDL：${value}`)
  }
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
