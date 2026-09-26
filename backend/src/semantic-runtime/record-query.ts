import { RecordWriteError } from './record-write-error'
import type { SemanticEntity } from './record-validator'

export const QUERY_PAGE_SIZE_MAX = 100
export const QUERY_PAGE_SIZE_DEFAULT = 20

export type QueryOrder = 'asc' | 'desc'

export interface ParsedRecordQuery {
  page: number
  pageSize: number
  sort: string | null
  order: QueryOrder | null
  state: string | null
  filter: Record<string, unknown>
}

export interface QueryEnvelope<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  sort: string | null
  order: string | null
}

const ALLOWED_QUERY_KEYS = new Set(['page', 'pageSize', 'sort', 'order', 'state', 'filter'])
const NUMERIC_TYPES = new Set(['number', 'decimal', 'i32'])

export function hasQueryParams(query: Record<string, string | undefined> | undefined): boolean {
  if (!query) return false
  return Object.keys(query).length > 0
}

export function parseRecordQuery(
  entity: SemanticEntity,
  query: Record<string, string | undefined>,
): ParsedRecordQuery {
  for (const key of Object.keys(query)) {
    if (!ALLOWED_QUERY_KEYS.has(key)) {
      throw new RecordWriteError(`未声明的查询参数 ${key}`, 'invalid-query', key)
    }
  }

  const declared = new Map(entity.fields.map((field) => [field.name, field]))
  const stateNames = new Set((entity.states ?? []).map((state) => state.name))

  const page = query.page === undefined ? 1 : parseBoundedInt(query.page, 'page', 1, Number.MAX_SAFE_INTEGER)
  const pageSize =
    query.pageSize === undefined
      ? QUERY_PAGE_SIZE_DEFAULT
      : parseBoundedInt(query.pageSize, 'pageSize', 1, QUERY_PAGE_SIZE_MAX)

  let sort: string | null = null
  if (query.sort !== undefined) {
    if (query.sort !== 'createdAt' && !declared.has(query.sort)) {
      throw new RecordWriteError(
        `排序字段 ${query.sort} 未被实体 ${entity.name} 声明（只允许已声明字段或 createdAt）`,
        'invalid-query',
        query.sort,
      )
    }
    sort = query.sort
  }

  let order: QueryOrder | null = null
  if (query.order !== undefined) {
    if (query.order !== 'asc' && query.order !== 'desc') {
      throw new RecordWriteError(`order 必须是 asc 或 desc（实际 ${query.order}）`, 'invalid-query', 'order')
    }
    order = query.order
  }

  let state: string | null = null
  if (query.state !== undefined) {
    if (!stateNames.has(query.state)) {
      throw new RecordWriteError(
        `状态 ${query.state} 未被实体 ${entity.name} 声明`,
        'invalid-query',
        'state',
      )
    }
    state = query.state
  }

  const filter = parseFilter(entity, query.filter, declared)

  return { page, pageSize, sort, order, state, filter }
}

function parseFilter(
  entity: SemanticEntity,
  raw: string | undefined,
  declared: Map<string, { name: string; type: string }>,
): Record<string, unknown> {
  if (raw === undefined) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new RecordWriteError('filter 必须是 URL 编码的 JSON 对象字符串', 'invalid-query', 'filter')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new RecordWriteError('filter 必须是 JSON 对象', 'invalid-query', 'filter')
  }
  const filter = parsed as Record<string, unknown>
  for (const key of Object.keys(filter)) {
    if (!declared.has(key)) {
      throw new RecordWriteError(
        `过滤字段 ${key} 未被实体 ${entity.name} 声明`,
        'unknown-field',
        key,
      )
    }
  }
  return filter
}

function parseBoundedInt(raw: string, label: string, min: number, max: number): number {
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new RecordWriteError(`${label} 必须是正整数`, 'invalid-query', label)
  }
  const value = Number(raw)
  if (value < min || value > max) {
    throw new RecordWriteError(`${label}=${raw} 超出范围 ${min}..${max}`, 'invalid-query', label)
  }
  return value
}

export function sortSqlExpression(entity: SemanticEntity, sort: string): string {
  if (sort === 'createdAt') return '"createdAt"'
  const field = entity.fields.find((item) => item.name === sort)
  const json = `data->>'${sort}'`
  if (field && NUMERIC_TYPES.has(field.type)) {
    return `(${json})::numeric`
  }
  return json
}

export function filterSql(
  entity: SemanticEntity,
  filter: Record<string, unknown>,
  startIndex: number,
): { clause: string; params: unknown[]; nextIndex: number } {
  const parts: string[] = []
  const params: unknown[] = []
  let index = startIndex
  for (const [key, value] of Object.entries(filter)) {
    const field = entity.fields.find((item) => item.name === key)
    const json = `data->>'${key}'`
    if (field && NUMERIC_TYPES.has(field.type)) {
      parts.push(`(${json})::numeric = $${index}::numeric`)
    } else {
      parts.push(`${json} = $${index}`)
    }
    params.push(value == null ? null : String(value))
    index += 1
  }
  return {
    clause: parts.length === 0 ? '' : parts.join(' AND '),
    params,
    nextIndex: index,
  }
}
