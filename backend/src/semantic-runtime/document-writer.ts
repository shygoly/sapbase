import { In, type EntityManager } from 'typeorm'
import { BlueprintRecord } from './blueprint-record.entity'
import {
  validateRecord,
  type SemanticEntity,
  type SemanticField,
  type ValidationRule,
} from './record-validator'
import type { ConstraintFieldRef } from './db-constraints'
import { isUniqueViolation, mapConstraintError, RecordWriteError } from './record-write-error'
import { declaredMoneyCurrency, STAMPED_CURRENCY_KEY } from './field-permissions'

export const NUMBERING_RETRY_LIMIT = 5

export type NumberingDateFormat = 'YYYYMMDD' | 'YYYYMM' | 'YYYY' | 'none'

export interface SemanticNumbering {
  field: string
  prefix: string
  dateFormat?: NumberingDateFormat
  width: number
}

export interface DocumentEntity extends SemanticEntity {
  children?: string[]
  parent?: { entity: string; field: string }
  states?: Array<{ name: string; initial?: boolean; final?: boolean }>
  numbering?: SemanticNumbering
}

export interface WriteContext {
  manager: EntityManager
  blueprintId: string
  blueprintVersion: string
  organizationId: string
  entities: DocumentEntity[]
  validation: ValidationRule[]
  now?: Date
  constraintMap?: Map<string, ConstraintFieldRef>
}

export interface ParsedDocumentPayload {
  header: Record<string, unknown>
  children: Record<string, Array<Record<string, unknown>>>
}

/**
 * 拆写入载荷。没有 `children` 键 → 普通记录（归档 e2e 依赖这一点）。
 * `children` 是保留键，不得出现在头字段里。
 */
export function parseDocumentPayload(
  payload: Record<string, unknown>,
): { kind: 'plain'; data: Record<string, unknown> } | { kind: 'document'; parsed: ParsedDocumentPayload } {
  if (!Object.prototype.hasOwnProperty.call(payload, 'children')) {
    return { kind: 'plain', data: payload }
  }
  const { children, ...header } = payload
  if (children === null || typeof children !== 'object' || Array.isArray(children)) {
    throw new RecordWriteError('children 必须是对象（键 = 行实体名）', 'type-mismatch', 'children')
  }
  const parsedChildren: Record<string, Array<Record<string, unknown>>> = {}
  for (const [name, rows] of Object.entries(children as Record<string, unknown>)) {
    if (!Array.isArray(rows)) {
      throw new RecordWriteError(`children.${name} 必须是数组`, 'type-mismatch', name)
    }
    parsedChildren[name] = rows.map((row, index) => {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) {
        throw new RecordWriteError(`children.${name}[${index}] 必须是对象`, 'type-mismatch', name)
      }
      return row as Record<string, unknown>
    })
  }
  return { kind: 'document', parsed: { header, children: parsedChildren } }
}

export function initialStateOf(entity: DocumentEntity): string | undefined {
  return entity.states?.find((state) => state.initial === true)?.name
}

export function resolveState(recordState: string | null | undefined, entity: DocumentEntity): string | undefined {
  return recordState ?? initialStateOf(entity)
}

export function formatPeriod(now: Date, dateFormat: NumberingDateFormat = 'YYYYMMDD'): string {
  if (dateFormat === 'none') return ''
  const y = String(now.getFullYear())
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  if (dateFormat === 'YYYY') return y
  if (dateFormat === 'YYYYMM') return `${y}${m}`
  return `${y}${m}${d}`
}

export function formatDocNumber(numbering: SemanticNumbering, period: string, seq: number): string {
  return `${numbering.prefix}${period}${String(seq).padStart(numbering.width, '0')}`
}

export async function allocateSeq(
  manager: EntityManager,
  input: {
    blueprintId: string
    organizationId: string
    entity: string
    period: string
  },
): Promise<number> {
  const rows = (await manager.query(
    `INSERT INTO public.blueprint_doc_counters
       ("blueprintId","organizationId",entity,period,seq,"createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,1,now(),now())
     ON CONFLICT ("blueprintId","organizationId",entity,period)
     DO UPDATE SET seq = public.blueprint_doc_counters.seq + 1, "updatedAt" = now()
     RETURNING seq`,
    [input.blueprintId, input.organizationId, input.entity, input.period],
  )) as Array<{ seq: number }>
  const seq = rows[0]?.seq
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1) {
    throw new RecordWriteError('单号计数器未返回序号', 'numbering-failed')
  }
  return seq
}

export async function collectRefs(
  manager: EntityManager,
  blueprintId: string,
  organizationId: string,
  entities: DocumentEntity[],
  data: Record<string, unknown>,
): Promise<Set<string>> {
  const needed = new Map<string, string[]>()
  for (const entity of entities) {
    for (const field of entity.fields as SemanticField[]) {
      if (field.type !== 'reference' || !field.reference) continue
      const value = data[field.name]
      if (typeof value !== 'string' || value.length === 0) continue
      const list = needed.get(field.reference) ?? []
      list.push(value)
      needed.set(field.reference, list)
    }
  }

  const found = new Set<string>()
  const repo = manager.getRepository(BlueprintRecord)
  for (const [targetEntity, ids] of needed) {
    if (ids.length === 0) continue
    const rows = await repo.find({
      where: {
        blueprintId,
        entity: targetEntity,
        organizationId,
        id: In(ids),
      },
      select: ['id', 'entity'],
    })
    for (const row of rows) {
      found.add(`${row.entity}:${row.id}`)
    }
  }
  return found
}

function stampDeclaredCurrency(
  entity: DocumentEntity,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const currency = declaredMoneyCurrency(entity.fields)
  if (!currency) return data
  return { ...data, [STAMPED_CURRENCY_KEY]: currency }
}

function entityOf(entities: DocumentEntity[], name: string): DocumentEntity {
  const entity = entities.find((item) => item.name === name)
  if (!entity) {
    throw new RecordWriteError(`模板未声明实体 ${name}`, 'unknown-entity')
  }
  return entity
}

function assertNoNestedDocument(entity: DocumentEntity): void {
  if (entity.children && entity.children.length > 0) {
    throw new RecordWriteError(
      `暂不支持多级单据：${entity.name} 自己也声明了 children`,
      'nested-document-unsupported',
    )
  }
}

async function insertRecord(
  ctx: WriteContext,
  entityName: string,
  data: Record<string, unknown>,
  extraRefs: ReadonlySet<string> = new Set(),
): Promise<BlueprintRecord> {
  const entity = entityOf(ctx.entities, entityName)
  const existingRefs = new Set([
    ...(await collectRefs(ctx.manager, ctx.blueprintId, ctx.organizationId, ctx.entities, data)),
    ...extraRefs,
  ])
  const checked = validateRecord({
    entities: ctx.entities,
    validation: ctx.validation,
    entity: entityName,
    data,
    existingRefs,
  })
  if (!checked.ok) {
    throw new RecordWriteError(checked.detail, checked.reason, checked.field, checked.ruleId)
  }

  const stamped = stampDeclaredCurrency(entity, data)
  const repo = ctx.manager.getRepository(BlueprintRecord)
  const row = repo.create({
    blueprintId: ctx.blueprintId,
    blueprintVersion: ctx.blueprintVersion,
    entity: entityName,
    organizationId: ctx.organizationId,
    data: stamped,
    state: initialStateOf(entity),
    version: 1,
  })
  try {
    return await repo.save(row)
  } catch (error) {
    if (isUniqueViolation(error)) throw error
    const mapped = mapConstraintError(error, ctx.constraintMap ?? new Map())
    throw mapped ?? error
  }
}

async function insertWithNumbering(
  ctx: WriteContext,
  entityName: string,
  data: Record<string, unknown>,
  extraRefs: ReadonlySet<string> = new Set(),
): Promise<BlueprintRecord> {
  const entity = entityOf(ctx.entities, entityName)
  const numbering = entity.numbering
  if (!numbering) {
    return insertRecord(ctx, entityName, data, extraRefs)
  }
  if (Object.prototype.hasOwnProperty.call(data, numbering.field)) {
    throw new RecordWriteError(
      `单号字段 ${entityName}.${numbering.field} 由运行时分配，不允许调用方指定`,
      'numbering-injected',
      numbering.field,
    )
  }

  const now = ctx.now ?? new Date()
  const dateFormat = numbering.dateFormat ?? 'YYYYMMDD'
  const period = formatPeriod(now, dateFormat)
  for (let attempt = 0; attempt < NUMBERING_RETRY_LIMIT; attempt += 1) {
    const seq = await allocateSeq(ctx.manager, {
      blueprintId: ctx.blueprintId,
      organizationId: ctx.organizationId,
      entity: entityName,
      period,
    })
    const numbered = { ...data, [numbering.field]: formatDocNumber(numbering, period, seq) }
    const savepoint = `numbering_${attempt}`
    await ctx.manager.query(`SAVEPOINT ${savepoint}`)
    try {
      const row = await insertRecord(ctx, entityName, numbered, extraRefs)
      await ctx.manager.query(`RELEASE SAVEPOINT ${savepoint}`)
      return row
    } catch (error) {
      await ctx.manager.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
      if (!isUniqueViolation(error)) throw error
    }
  }
  throw new RecordWriteError(
    `单号分配在 ${NUMBERING_RETRY_LIMIT} 次有界重试后仍撞唯一约束`,
    'numbering-exhausted',
    numbering.field,
  )
}

/**
 * 头 + 行一次事务写入。调用方必须把本函数放进 `dataSource.transaction`，
 * 且传入**事务** EntityManager（不要用类字段上的 Repository）。
 */
export async function writeDocumentOrRecord(
  ctx: WriteContext,
  entityName: string,
  payload: Record<string, unknown>,
): Promise<BlueprintRecord> {
  const parsed = parseDocumentPayload(payload)
  if (parsed.kind === 'plain') {
    return insertWithNumbering(ctx, entityName, parsed.data)
  }
  return writeDocument(ctx, entityName, parsed.parsed)
}

export async function writeDocument(
  ctx: WriteContext,
  entityName: string,
  parsed: ParsedDocumentPayload,
): Promise<BlueprintRecord> {
  const head = entityOf(ctx.entities, entityName)
  const declaredChildren = new Set(head.children ?? [])
  if (declaredChildren.size === 0) {
    const undeclared = Object.keys(parsed.children)
    throw new RecordWriteError(
      `实体 ${entityName} 未声明行实体：${undeclared.join(', ')}`,
      'undeclared-child',
      undeclared[0],
    )
  }

  for (const childName of Object.keys(parsed.children)) {
    if (!declaredChildren.has(childName)) {
      throw new RecordWriteError(
        `实体 ${entityName} 未声明行实体 ${childName}`,
        'undeclared-child',
        childName,
      )
    }
    assertNoNestedDocument(entityOf(ctx.entities, childName))
  }

  const header = await insertWithNumbering(ctx, entityName, parsed.header)
  const extraRefs = new Set<string>([`${entityName}:${header.id}`])

  for (const childName of Object.keys(parsed.children)) {
    const child = entityOf(ctx.entities, childName)
    const parentField = child.parent?.field
    if (!parentField) {
      throw new RecordWriteError(`行实体 ${childName} 未声明 parent`, 'undeclared-child', childName)
    }
    for (const [index, row] of parsed.children[childName].entries()) {
      if (Object.prototype.hasOwnProperty.call(row, parentField)) {
        throw new RecordWriteError(
          `父引用字段由运行时注入：${childName}.${parentField}（行 ${index}）不允许调用方指定`,
          'parent-field-injected',
          parentField,
        )
      }
      const injected = { ...row, [parentField]: header.id }
      await insertWithNumbering(ctx, childName, injected, extraRefs)
    }
  }

  return header
}
