import type { SemanticEntity, SemanticField } from './record-validator'
import { RecordWriteError } from './record-write-error'

export interface CsvRecord {
  line: number
  cells: string[]
}

export interface ParsedCsv {
  headers: string[]
  records: CsvRecord[]
}

export interface ImportRow {
  line: number
  data: Record<string, unknown>
}

export interface NormalizedImport {
  source: 'csv' | 'json'
  rows: ImportRow[]
}

export interface ImportBody {
  csv?: unknown
  rows?: unknown
  dryRun?: unknown
}

/**
 * RFC 4180 子集：逗号分隔、双引号包裹、字段内逗号、`""` 转义、`\r\n`/`\n`。
 * 行号 = 文件行号（含表头所占行）；空行跳过。
 */
export function parseCsv(text: string): ParsedCsv {
  const rows: CsvRecord[] = []
  let i = 0
  let line = 1
  const n = text.length
  if (n > 0 && text.charCodeAt(0) === 0xfeff) i = 1

  while (i < n) {
    if (text[i] === '\r' && text[i + 1] === '\n') {
      line += 1
      i += 2
      continue
    }
    if (text[i] === '\n') {
      line += 1
      i += 1
      continue
    }

    const startLine = line
    const cells: string[] = []
    while (i < n) {
      if (text[i] === '"') {
        i += 1
        let field = ''
        while (i < n) {
          const ch = text[i]
          if (ch === '"') {
            if (text[i + 1] === '"') {
              field += '"'
              i += 2
              continue
            }
            i += 1
            break
          }
          if (ch === '\r' && text[i + 1] === '\n') {
            field += '\n'
            line += 1
            i += 2
            continue
          }
          if (ch === '\n') {
            field += '\n'
            line += 1
            i += 1
            continue
          }
          field += ch
          i += 1
        }
        cells.push(field)
      } else {
        let field = ''
        while (i < n && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          field += text[i]
          i += 1
        }
        cells.push(field)
      }

      if (text[i] === ',') {
        i += 1
        continue
      }
      if (text[i] === '\r' && text[i + 1] === '\n') {
        i += 2
        line += 1
        break
      }
      if (text[i] === '\n') {
        i += 1
        line += 1
        break
      }
      break
    }

    const blank = cells.length === 1 && cells[0] === ''
    if (!blank) {
      rows.push({ line: startLine, cells })
    }
  }

  if (rows.length === 0) {
    throw new RecordWriteError('CSV 为空', 'type-mismatch')
  }
  const header = rows[0]!
  return {
    headers: header.cells.map((cell) => cell.trim()),
    records: rows.slice(1),
  }
}

function assertHeaders(headers: string[], entity: SemanticEntity): void {
  if (headers.length === 0 || headers.every((name) => name.length === 0)) {
    throw new RecordWriteError(`实体 ${entity.name} 的导入表头为空`, 'type-mismatch')
  }
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const name of headers) {
    if (name.length === 0) {
      throw new RecordWriteError(`实体 ${entity.name} 的导入表头含空列名`, 'type-mismatch')
    }
    if (seen.has(name)) duplicates.push(name)
    seen.add(name)
  }
  if (duplicates.length > 0) {
    throw new RecordWriteError(
      `实体 ${entity.name} 的导入表头有重复列名：${[...new Set(duplicates)].join(', ')}`,
      'type-mismatch',
    )
  }
  const declared = new Set(entity.fields.map((field) => field.name))
  const unknown = headers.filter((name) => !declared.has(name))
  if (unknown.length > 0) {
    throw new RecordWriteError(
      `实体 ${entity.name} 的导入表头含未声明列：${unknown.join(', ')}`,
      'unknown-field',
      unknown[0],
    )
  }
}

function coerceCsvCell(field: SemanticField, raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return undefined
  switch (field.type) {
    case 'text':
    case 'enum':
    case 'reference':
    case 'date':
    case 'datetime':
      return trimmed
    case 'i32':
      return /^-?\d+$/.test(trimmed) ? Number(trimmed) : trimmed
    case 'number':
      return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed
    case 'decimal':
      return trimmed
    case 'boolean':
      if (trimmed === 'true') return true
      if (trimmed === 'false') return false
      return trimmed
    default:
      return trimmed
  }
}

function rowFromCells(
  headers: string[],
  cells: string[],
  entity: SemanticEntity,
): Record<string, unknown> {
  const fields = new Map(entity.fields.map((field) => [field.name, field]))
  const data: Record<string, unknown> = {}
  for (const [index, header] of headers.entries()) {
    const field = fields.get(header)
    if (!field) continue
    const raw = cells[index] ?? ''
    const value = coerceCsvCell(field, raw)
    if (value !== undefined) data[header] = value
  }
  return data
}

function assertObjectRows(rows: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(rows)) {
    throw new RecordWriteError('rows 必须是对象数组', 'type-mismatch', 'rows')
  }
  return rows.map((row, index) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      throw new RecordWriteError(`rows[${index}] 必须是对象`, 'type-mismatch', 'rows')
    }
    return row as Record<string, unknown>
  })
}

/**
 * 把 `{ csv | rows }` 归一成带文件行号的行。结构错误整份拒（抛 RecordWriteError）。
 */
export function normalizeImportInput(body: ImportBody, entity: SemanticEntity): NormalizedImport {
  const hasCsv = typeof body.csv === 'string'
  const hasRows = Object.prototype.hasOwnProperty.call(body, 'rows') && body.rows !== undefined
  if (hasCsv === hasRows) {
    throw new RecordWriteError('csv 与 rows 必须二选一', 'type-mismatch')
  }

  if (hasCsv) {
    const parsed = parseCsv(body.csv as string)
    assertHeaders(parsed.headers, entity)
    return {
      source: 'csv',
      rows: parsed.records.map((record) => ({
        line: record.line,
        data: rowFromCells(parsed.headers, record.cells, entity),
      })),
    }
  }

  const objects = assertObjectRows(body.rows)
  return {
    source: 'json',
    rows: objects.map((data, index) => ({ line: index + 1, data })),
  }
}

export function isDryRun(body: ImportBody): boolean {
  return body.dryRun === true
}
