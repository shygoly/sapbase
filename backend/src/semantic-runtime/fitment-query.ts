import { RecordWriteError } from './record-write-error'

export interface FitmentQuery {
  make: string
  model: string
  year: number
  position?: string
}

export interface FitmentRow {
  id: string
  make: string
  model: string
  yearFrom: number
  yearTo: number
  position: string
  part: string
}

export interface FitmentEvidence {
  fitmentId: string
  yearFrom: number
  yearTo: number
  position: string
}

export interface FitmentCandidate {
  partId: string
  partNo: string | null
  name: string | null
  evidence: FitmentEvidence[]
}

function asYear(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value)
  return null
}

function requiredText(query: Record<string, string | undefined>, field: string): string {
  const raw = query[field]
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new RecordWriteError(`适配查询缺少 ${field}`, 'type-mismatch', field)
  }
  return raw.trim()
}

/**
 * make/model 必填；year 必须是整数；position 给了就必须是模板枚举值。
 */
export function parseFitmentQuery(
  query: Record<string, string | undefined>,
  allowedPositions: readonly string[],
): FitmentQuery {
  const make = requiredText(query, 'make')
  const model = requiredText(query, 'model')
  const yearRaw = query.year
  if (typeof yearRaw !== 'string' || !/^-?\d+$/.test(yearRaw.trim())) {
    throw new RecordWriteError('适配查询的 year 必须是整数', 'type-mismatch', 'year')
  }
  const year = Number(yearRaw.trim())
  const parsed: FitmentQuery = { make, model, year }
  if (query.position !== undefined && query.position.length > 0) {
    if (!allowedPositions.includes(query.position)) {
      throw new RecordWriteError(
        `适配查询的 position 必须是 ${allowedPositions.join(' / ')}`,
        'type-mismatch',
        'position',
      )
    }
    parsed.position = query.position
  }
  return parsed
}

/** make/model 用 lower() 比较；yearFrom ≤ year ≤ yearTo；position 精确（若请求给了）。 */
export function fitmentMatches(row: FitmentRow, query: FitmentQuery): boolean {
  if (row.make.toLowerCase() !== query.make.toLowerCase()) return false
  if (row.model.toLowerCase() !== query.model.toLowerCase()) return false
  if (!(row.yearFrom <= query.year && query.year <= row.yearTo)) return false
  if (query.position !== undefined && row.position !== query.position) return false
  return true
}

/**
 * 命中行 → 零件候选去重，按 partNo 排序（缺失 partNo 的排后面，再用 partId 兜底），并带命中依据。
 */
export function assembleFitmentCandidates(
  rows: FitmentRow[],
  query: FitmentQuery,
  parts: Map<string, { partNo?: string; name?: string }>,
): FitmentCandidate[] {
  const grouped = new Map<string, FitmentCandidate>()
  for (const row of rows) {
    if (!fitmentMatches(row, query)) continue
    const existing = grouped.get(row.part)
    const evidence: FitmentEvidence = {
      fitmentId: row.id,
      yearFrom: row.yearFrom,
      yearTo: row.yearTo,
      position: row.position,
    }
    if (existing) {
      existing.evidence.push(evidence)
      continue
    }
    const part = parts.get(row.part)
    grouped.set(row.part, {
      partId: row.part,
      partNo: part?.partNo ?? null,
      name: part?.name ?? null,
      evidence: [evidence],
    })
  }
  return [...grouped.values()].sort((left, right) => {
    const leftKey = left.partNo ?? `\uFFFF${left.partId}`
    const rightKey = right.partNo ?? `\uFFFF${right.partId}`
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
  })
}

export function fitmentRowFromData(
  id: string,
  data: Record<string, unknown>,
): FitmentRow | null {
  if (typeof data.make !== 'string' || typeof data.model !== 'string') return null
  if (typeof data.part !== 'string' || typeof data.position !== 'string') return null
  const yearFrom = asYear(data.yearFrom)
  const yearTo = asYear(data.yearTo)
  if (yearFrom === null || yearTo === null) return null
  return {
    id,
    make: data.make,
    model: data.model,
    yearFrom,
    yearTo,
    position: data.position,
    part: data.part,
  }
}
