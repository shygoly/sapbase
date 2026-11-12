import AdmZip from 'adm-zip'
import { toXlsx } from '../audit-exports/audit-export-format'
import { parseCsv } from '../semantic-runtime/import-rows'
import type {
  ColumnMappingResult,
  ParsedImportFile,
  ParsedImportRow,
  PreparedImportRow,
  ResourceDescriptor,
  ResourceField,
  RowError,
} from './bulk.types'

export const BULK_LIMITS = {
  maxFileBytes: Number(process.env.BULK_MAX_FILE_BYTES ?? 20 * 1024 * 1024),
  maxRows: Number(process.env.BULK_MAX_ROWS ?? 50_000),
  maxColumns: 200,
  maxCellChars: 32_000,
  maxXlsxEntries: 2_000,
  maxXlsxUncompressedBytes: 64 * 1024 * 1024,
  maxXlsxEntryBytes: 16 * 1024 * 1024,
  maxXlsxSheets: 20,
  maxCompressionRatio: 200,
}

export class BulkFormatError extends Error {
  constructor(
    message: string,
    readonly reason:
      | 'unsupported-format'
      | 'too-large'
      | 'empty'
      | 'invalid-header'
      | 'invalid-row'
      | 'xlsx-unsafe',
  ) {
    super(message)
    this.name = 'BulkFormatError'
  }
}

export function detectImportFormat(filename?: string, mimeType?: string): 'csv' | 'json' | 'xlsx' {
  const name = (filename ?? '').toLowerCase()
  if (name.endsWith('.csv')) return 'csv'
  if (name.endsWith('.json')) return 'json'
  if (name.endsWith('.xlsx')) return 'xlsx'
  if (name.endsWith('.xls')) {
    throw new BulkFormatError('不支持旧版 .xls，请另存为 .xlsx', 'unsupported-format')
  }
  if (mimeType === 'text/csv') return 'csv'
  if (mimeType === 'application/json') return 'json'
  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'xlsx'
  }
  throw new BulkFormatError(
    `无法识别文件格式：${filename ?? mimeType ?? 'unknown'}（支持 csv/xlsx/json）`,
    'unsupported-format',
  )
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function xmlTexts(value: string): string {
  const parts: string[] = []
  for (const match of value.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) {
    parts.push(decodeXml(match[1] ?? ''))
  }
  return parts.join('')
}

function attr(value: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(value)
  return match ? decodeXml(match[1] ?? '') : null
}

function columnIndex(ref: string | null, fallback: number): number {
  if (!ref) return fallback
  const letters = /^([A-Z]+)/i.exec(ref)?.[1]
  if (!letters) return fallback
  let index = 0
  for (const char of letters.toUpperCase()) index = index * 26 + (char.charCodeAt(0) - 64)
  return index - 1
}

export interface XlsxEntryInfo {
  entryName: string
  size: number
  compressedSize: number
}

/** xlsx 是不可信 zip：先做大小/宏/外链/路径检查，再解析。 */
export function assertXlsxArchive(entries: XlsxEntryInfo[]): void {
  if (entries.length === 0) throw new BulkFormatError('xlsx 为空', 'empty')
  if (entries.length > BULK_LIMITS.maxXlsxEntries) {
    throw new BulkFormatError(`xlsx 条目过多：${entries.length}`, 'xlsx-unsafe')
  }
  let total = 0
  for (const entry of entries) {
    if (
      entry.entryName.startsWith('/') ||
      entry.entryName.includes('\\') ||
      entry.entryName.split('/').includes('..')
    ) {
      throw new BulkFormatError(`xlsx 含非法路径：${entry.entryName}`, 'xlsx-unsafe')
    }
    if (/vbaProject\.bin$/i.test(entry.entryName) || /^xl\/macros\//i.test(entry.entryName)) {
      throw new BulkFormatError('xlsx 含宏，拒绝解析', 'xlsx-unsafe')
    }
    if (/^xl\/externalLinks\//i.test(entry.entryName)) {
      throw new BulkFormatError('xlsx 含外部链接，拒绝解析', 'xlsx-unsafe')
    }
    if (/^xl\/connections\.xml$/i.test(entry.entryName)) {
      throw new BulkFormatError('xlsx 含外部数据连接，拒绝解析', 'xlsx-unsafe')
    }
    if (entry.size > BULK_LIMITS.maxXlsxEntryBytes) {
      throw new BulkFormatError(
        `xlsx 单条目解压过大：${entry.entryName} (${entry.size} bytes)`,
        'xlsx-unsafe',
      )
    }
    if (
      entry.compressedSize > 0 &&
      entry.size / entry.compressedSize > BULK_LIMITS.maxCompressionRatio &&
      entry.size > 1024 * 1024
    ) {
      throw new BulkFormatError(`xlsx 压缩比异常：${entry.entryName}`, 'xlsx-unsafe')
    }
    total += entry.size
  }
  if (total > BULK_LIMITS.maxXlsxUncompressedBytes) {
    throw new BulkFormatError(`xlsx 解压总量过大：${total} bytes`, 'xlsx-unsafe')
  }
  const sheetCount = entries.filter((entry) =>
    /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.entryName),
  ).length
  if (sheetCount > BULK_LIMITS.maxXlsxSheets) {
    throw new BulkFormatError(`xlsx sheet 数过多：${sheetCount}`, 'xlsx-unsafe')
  }
  const types = entries.find((entry) => entry.entryName === '[Content_Types].xml')
  if (!types) throw new BulkFormatError('xlsx 缺少 [Content_Types].xml', 'invalid-row')
}

function parseXlsx(buffer: Buffer): ParsedImportFile {
  let zip: AdmZip
  try {
    zip = new AdmZip(buffer)
  } catch (error) {
    throw new BulkFormatError(`xlsx 无法读取：${(error as Error).message}`, 'invalid-row')
  }
  const entries = zip.getEntries()
  assertXlsxArchive(
    entries.map((entry) => ({
      entryName: entry.entryName,
      size: entry.header.size,
      compressedSize: entry.header.compressedSize,
    })),
  )
  const contentTypes = zip.readAsText('[Content_Types].xml')
  if (/macroEnabled|vbaProject/i.test(contentTypes)) {
    throw new BulkFormatError('xlsx 声明了宏内容，拒绝解析', 'xlsx-unsafe')
  }
  const sharedEntry = zip.getEntry('xl/sharedStrings.xml')
  const shared: string[] = []
  if (sharedEntry) {
    const xml = sharedEntry.getData().toString('utf8')
    for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
      shared.push(xmlTexts(match[1] ?? ''))
    }
  }
  const workbookEntry = zip.getEntry('xl/workbook.xml')
  let sheetName = 'Sheet1'
  if (workbookEntry) {
    const workbook = workbookEntry.getData().toString('utf8')
    const firstSheet = /<sheet\b[^>]*>/i.exec(workbook)?.[0]
    sheetName = (firstSheet && attr(firstSheet, 'name')) || sheetName
  }
  const sheetEntry =
    zip.getEntry('xl/worksheets/sheet1.xml') ??
    entries
      .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.entryName))
      .sort((a, b) => a.entryName.localeCompare(b.entryName))[0]
  if (!sheetEntry) throw new BulkFormatError('xlsx 中找不到工作表', 'empty')
  const sheet = sheetEntry.getData().toString('utf8')
  const parsedRows: Array<{ row: number; cells: string[] }> = []
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowAttrs = rowMatch[1] ?? ''
    const rowNumber = Number(attr(rowAttrs, 'r') ?? parsedRows.length + 1)
    const body = rowMatch[2] ?? ''
    const cells: string[] = []
    let fallback = 0
    for (const cellMatch of body.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1] ?? ''
      const cellBody = cellMatch[2] ?? ''
      const index = columnIndex(attr(attrs, 'r'), fallback)
      fallback = index + 1
      const type = attr(attrs, 't')
      let value = ''
      if (type === 'inlineStr') {
        value = xmlTexts(cellBody)
      } else if (type === 's') {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(cellBody)?.[1] ?? ''
        value = shared[Number(raw)] ?? ''
      } else if (type === 'b') {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(cellBody)?.[1] ?? ''
        value = raw === '1' ? 'true' : 'false'
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(cellBody)?.[1]
        value = raw === undefined ? xmlTexts(cellBody) : decodeXml(raw)
      }
      if (value.length > BULK_LIMITS.maxCellChars) {
        throw new BulkFormatError(`第 ${rowNumber} 行单元格过大`, 'too-large')
      }
      cells[index] = value
    }
    if (cells.some((cell) => (cell ?? '').trim().length > 0)) {
      parsedRows.push({ row: rowNumber, cells: Array.from(cells, (cell) => cell ?? '') })
    }
  }
  if (parsedRows.length === 0) throw new BulkFormatError('xlsx 为空', 'empty')
  const header = parsedRows[0]!
  const headers = trimTrailingEmpty(header.cells.map((cell) => cell.trim()))
  if (headers.every((name) => !name)) {
    throw new BulkFormatError('xlsx 表头为空', 'invalid-header')
  }
  if (headers.length > BULK_LIMITS.maxColumns) {
    throw new BulkFormatError(`列数过多：${headers.length}`, 'too-large')
  }
  const rows: ParsedImportRow[] = []
  for (const record of parsedRows.slice(1)) {
    if (record.cells.length > headers.length) {
      const extra = record.cells
        .slice(headers.length)
        .some((cell) => (cell ?? '').trim().length > 0)
      if (extra) {
        throw new BulkFormatError(`第 ${record.row} 行数据列超过表头`, 'invalid-row')
      }
    }
    rows.push({
      row: record.row,
      sheet: sheetName,
      values: Object.fromEntries(
        headers.map((headerName, index) => [headerName, record.cells[index] ?? '']),
      ),
    })
  }
  return { format: 'xlsx', headers, rows, sheet: sheetName }
}

function trimTrailingEmpty(values: string[]): string[] {
  const next = [...values]
  while (next.length > 0 && next[next.length - 1]!.trim().length === 0) next.pop()
  return next
}

function parseJson(buffer: Buffer): ParsedImportFile {
  let value: unknown
  try {
    value = JSON.parse(buffer.toString('utf8'))
  } catch (error) {
    throw new BulkFormatError(`JSON 无法解析：${(error as Error).message}`, 'invalid-row')
  }
  const objects =
    value && typeof value === 'object' && !Array.isArray(value) && Array.isArray((value as { rows?: unknown }).rows)
      ? ((value as { rows: unknown[] }).rows as unknown[])
      : value
  if (!Array.isArray(objects)) {
    throw new BulkFormatError('JSON 必须是对象数组或 { rows: [] }', 'invalid-row')
  }
  if (objects.length > BULK_LIMITS.maxRows) {
    throw new BulkFormatError(`行数过多：${objects.length}`, 'too-large')
  }
  const headers: string[] = []
  for (const item of objects) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new BulkFormatError('JSON 数组元素必须是对象', 'invalid-row')
    }
    for (const key of Object.keys(item as Record<string, unknown>)) {
      if (!headers.includes(key)) headers.push(key)
    }
  }
  if (headers.length > BULK_LIMITS.maxColumns) {
    throw new BulkFormatError(`列数过多：${headers.length}`, 'too-large')
  }
  const rows: ParsedImportRow[] = objects.map((item, index) => {
    const values: Record<string, string> = {}
    for (const header of headers) {
      const raw = (item as Record<string, unknown>)[header]
      if (raw === null || raw === undefined) values[header] = ''
      else if (typeof raw === 'object') values[header] = JSON.stringify(raw)
      else values[header] = String(raw)
    }
    return { row: index + 1, values }
  })
  return { format: 'json', headers, rows }
}

export function parseImportFile(
  buffer: Buffer,
  format: 'csv' | 'json' | 'xlsx',
): ParsedImportFile {
  if (buffer.length === 0) throw new BulkFormatError('文件为空', 'empty')
  if (buffer.length > BULK_LIMITS.maxFileBytes) {
    throw new BulkFormatError(
      `文件过大：${buffer.length} bytes（上限 ${BULK_LIMITS.maxFileBytes}）`,
      'too-large',
    )
  }
  if (format === 'xlsx') return parseXlsx(buffer)
  if (format === 'json') return parseJson(buffer)
  let parsed: ReturnType<typeof parseCsv>
  try {
    parsed = parseCsv(buffer.toString('utf8'))
  } catch (error) {
    throw new BulkFormatError((error as Error).message || 'CSV 无法解析', 'invalid-row')
  }
  const headers = trimTrailingEmpty(parsed.headers.map((header) => header.trim()))
  if (headers.every((name) => !name)) {
    throw new BulkFormatError('CSV 表头为空', 'invalid-header')
  }
  if (headers.length > BULK_LIMITS.maxColumns) {
    throw new BulkFormatError(`列数过多：${headers.length}`, 'too-large')
  }
  const rows: ParsedImportRow[] = parsed.records.map((record) => {
    if (record.cells.length > headers.length) {
      const extra = record.cells
        .slice(headers.length)
        .some((cell) => cell.trim().length > 0)
      if (extra) {
        throw new BulkFormatError(`第 ${record.line} 行数据列超过表头`, 'invalid-row')
      }
    }
    return {
      row: record.line,
      values: Object.fromEntries(
        headers.map((header, index) => [header, record.cells[index] ?? '']),
      ),
    }
  })
  return { format: 'csv', headers, rows }
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\s*\*$/, '')
    .replace(/[（(]\s*(必填|required)\s*[)）]$/i, '')
    .trim()
    .toLowerCase()
}

/** 表头 → 字段键；支持显式 mapping、字段 key/label/alias 与必填星号。 */
export function buildColumnMapping(
  descriptor: ResourceDescriptor,
  headers: string[],
  mapping: Record<string, unknown> = {},
  unknownColumns: 'reject' | 'ignore' = 'reject',
): ColumnMappingResult {
  const fields = descriptor.fields.filter((field) => field.importable !== false)
  const fieldByKey = new Map(fields.map((field) => [field.key, field]))
  const aliases = new Map<string, ResourceField>()
  for (const field of fields) {
    for (const candidate of [field.key, field.label, ...(field.aliases ?? [])]) {
      aliases.set(normalizeHeader(candidate), field)
    }
  }
  const errors: RowError[] = []
  const fieldByHeader = new Map<string, string>()
  const used = new Set<string>()
  const seenHeader = new Set<string>()
  for (const [index, rawHeader] of headers.entries()) {
    const header = rawHeader.trim()
    if (!header) {
      errors.push({
        row: 1,
        column: String(index + 1),
        reason: 'empty-header',
        message: '表头含空列名',
      })
      continue
    }
    const normalized = normalizeHeader(header)
    if (seenHeader.has(normalized)) {
      errors.push({
        row: 1,
        column: header,
        reason: 'duplicate-header',
        message: `表头重复：${header}`,
      })
      continue
    }
    seenHeader.add(normalized)
    const explicit = mapping[header]
    let field: ResourceField | undefined
    if (typeof explicit === 'string') {
      field = fieldByKey.get(explicit)
      if (!field) {
        errors.push({
          row: 1,
          column: header,
          field: explicit,
          reason: 'unknown-field',
          message: `映射目标字段不存在：${explicit}`,
        })
        continue
      }
    } else {
      field = aliases.get(normalized)
    }
    if (!field) {
      if (unknownColumns === 'ignore') continue
      errors.push({
        row: 1,
        column: header,
        reason: 'unknown-column',
        message: `未声明列：${header}`,
      })
      continue
    }
    if (used.has(field.key)) {
      errors.push({
        row: 1,
        column: header,
        field: field.key,
        reason: 'duplicate-field',
        message: `多个表头映射到同一字段：${field.key}`,
      })
      continue
    }
    used.add(field.key)
    fieldByHeader.set(header, field.key)
  }
  for (const field of fields) {
    if (!field.required) continue
    if (!used.has(field.key) && field.default !== undefined) continue
    if (!used.has(field.key)) {
      errors.push({
        row: 1,
        column: field.key,
        field: field.key,
        reason: 'missing-required-column',
        message: `缺少必填列：${field.key}`,
      })
    }
  }
  return { headers: headers.map((header) => header.trim()), fieldByHeader, errors }
}

function excelSerialToIso(raw: string): string | null {
  if (!/^\d+(\.\d+)?$/.test(raw)) return null
  const serial = Number(raw)
  if (!Number.isFinite(serial) || serial <= 0) return null
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function coerceValue(
  field: ResourceField,
  raw: string,
): { ok: true; value: unknown } | { ok: false; message: string } {
  const trimmed = raw.trim()
  switch (field.type) {
    case 'string':
    case 'reference':
    case 'decimal':
      return { ok: true, value: trimmed }
    case 'number': {
      if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return { ok: false, message: `不是合法数字：${trimmed}` }
      }
      return { ok: true, value: Number(trimmed) }
    }
    case 'integer': {
      if (!/^-?\d+$/.test(trimmed)) return { ok: false, message: `不是合法整数：${trimmed}` }
      return { ok: true, value: Number(trimmed) }
    }
    case 'boolean': {
      const normalized = trimmed.toLowerCase()
      if (['true', '1', 'yes', 'y', '是'].includes(normalized)) return { ok: true, value: true }
      if (['false', '0', 'no', 'n', '否'].includes(normalized)) return { ok: true, value: false }
      return { ok: false, message: `不是合法布尔值：${trimmed}` }
    }
    case 'date': {
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return { ok: true, value: trimmed }
      const serial = excelSerialToIso(trimmed)
      if (serial) return { ok: true, value: serial }
      return { ok: false, message: `不是合法日期（YYYY-MM-DD）：${trimmed}` }
    }
    case 'datetime': {
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return { ok: true, value: `${trimmed}T00:00:00Z` }
      }
      const date = new Date(trimmed)
      if (Number.isNaN(date.getTime())) {
        return { ok: false, message: `不是合法时间：${trimmed}` }
      }
      return { ok: true, value: date.toISOString() }
    }
    case 'enum': {
      const values = field.enumValues ?? []
      if (values.includes(trimmed)) return { ok: true, value: trimmed }
      const match = values.find((value) => value.toLowerCase() === trimmed.toLowerCase())
      if (match) return { ok: true, value: match }
      return { ok: false, message: `不在枚举范围：${values.join(', ')}` }
    }
    case 'json': {
      try {
        return { ok: true, value: JSON.parse(trimmed) }
      } catch {
        return { ok: false, message: '不是合法 JSON' }
      }
    }
    default:
      return { ok: true, value: trimmed }
  }
}

export function prepareImportRows(
  descriptor: ResourceDescriptor,
  parsed: ParsedImportFile,
  mapping: Record<string, unknown> = {},
  unknownColumns: 'reject' | 'ignore' = 'reject',
): PreparedImportRow[] {
  if (parsed.rows.length > BULK_LIMITS.maxRows) {
    throw new BulkFormatError(`行数过多：${parsed.rows.length}`, 'too-large')
  }
  const columns = buildColumnMapping(descriptor, parsed.headers, mapping, unknownColumns)
  const fieldByKey = new Map(descriptor.fields.map((field) => [field.key, field]))
  return parsed.rows.map((row) => {
    const errors: RowError[] = []
    const data: Record<string, unknown> = {}
    for (const [header, fieldKey] of columns.fieldByHeader.entries()) {
      const field = fieldByKey.get(fieldKey)
      if (!field) continue
      const raw = row.values[header] ?? ''
      if (raw.trim().length === 0) {
        if (field.required) {
          errors.push({
            row: row.row,
            sheet: row.sheet,
            column: header,
            field: field.key,
            reason: 'required',
            message: `${field.label || field.key} 必填`,
          })
        }
        continue
      }
      const coerced = coerceValue(field, raw)
      if (!coerced.ok) {
        errors.push({
          row: row.row,
          sheet: row.sheet,
          column: header,
          field: field.key,
          reason: 'type-mismatch',
          message: coerced.message,
        })
        continue
      }
      data[field.key] = coerced.value
    }
    for (const field of descriptor.fields) {
      if (data[field.key] === undefined && field.default !== undefined) {
        data[field.key] = field.default
      }
    }
    for (const error of columns.errors) errors.push({ ...error, sheet: row.sheet })
    return { row: row.row, sheet: row.sheet, data, errors }
  })
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** 导出时防止电子表格公式注入：字符串以 = + - @ 或控制字符开头时加前缀单引号。 */
export function escapeFormulaValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export function buildTemplate(
  descriptor: ResourceDescriptor,
  format: 'csv' | 'xlsx',
): { buffer: Buffer; filename: string; mimeType: string } {
  const fields = descriptor.fields.filter((field) => field.importable !== false)
  const headers = fields.map((field) =>
    field.required ? `${field.key}*` : field.key,
  )
  const sample: Record<string, unknown> = {}
  for (const field of fields) {
    const key = field.required ? `${field.key}*` : field.key
    sample[key] = escapeFormulaValue(field.example ?? '')
  }
  if (format === 'xlsx') {
    return {
      buffer: toXlsx([sample as { id: string }]),
      filename: `${descriptor.resourceKey.replace(/[^a-z0-9._-]+/gi, '-')}-template.xlsx`,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
  }
  const lines = [headers.map(csvCell).join(',')]
  lines.push(headers.map((header) => csvCell(sample[header] ?? '')).join(','))
  return {
    buffer: Buffer.from(`\uFEFF${lines.join('\n')}`),
    filename: `${descriptor.resourceKey.replace(/[^a-z0-9._-]+/gi, '-')}-template.csv`,
    mimeType: 'text/csv',
  }
}

export interface RenderField {
  key: string
  label: string
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function markdownCell(value: unknown): string {
  return displayValue(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function xmlSafe(value: unknown): string {
  return displayValue(value).replace(/[^\x20-\x7E]/g, '?').replace(/[()\\]/g, '\\$&')
}

function renderPdf(rows: Array<Record<string, unknown>>, fields: RenderField[]): Buffer {
  const header = fields.map((field) => field.label).join(' | ').slice(0, 150)
  const lines = rows.map((row) =>
    fields.map((field) => displayValue(row[field.key])).join(' | ').slice(0, 150),
  )
  const pages: string[][] = []
  for (let index = 0; index < lines.length; index += 38) {
    pages.push([header, ...lines.slice(index, index + 38)])
  }
  if (pages.length === 0) pages.push([header, '(no rows)'])
  const objects: string[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  const pageIds = pages.map((_, index) => 4 + index * 2)
  objects.push(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  )
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  pages.forEach((page, index) => {
    const content = [
      'BT /F1 7 Tf 24 820 Td 10 TL',
      ...page.map((line) => `(${xmlSafe(line)}) Tj T*`),
      'ET',
    ].join('\n')
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${
        5 + index * 2
      } 0 R >>`,
    )
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`)
  })
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}

export function renderExport(
  format: 'csv' | 'json' | 'xlsx' | 'md' | 'pdf',
  rows: Array<Record<string, unknown>>,
  fields: RenderField[],
): Buffer {
  const projected = rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const field of fields) out[field.key] = escapeFormulaValue(row[field.key])
    return out
  })
  if (format === 'json') return Buffer.from(JSON.stringify(projected, null, 2))
  if (format === 'xlsx') {
    const xlsxRows =
      projected.length > 0
        ? projected
        : [
            Object.fromEntries(
              fields.map((field) => [field.key, '']),
            ),
          ]
    return toXlsx(xlsxRows as Array<{ id: string }>)
  }
  if (format === 'csv') {
    const lines = [fields.map((field) => csvCell(field.key)).join(',')]
    for (const row of projected) {
      lines.push(fields.map((field) => csvCell(row[field.key])).join(','))
    }
    return Buffer.from(`\uFEFF${lines.join('\n')}`)
  }
  if (format === 'md') {
    const lines = [
      `| ${fields.map((field) => markdownCell(field.label)).join(' | ')} |`,
      `| ${fields.map(() => '---').join(' | ')} |`,
    ]
    for (const row of projected) {
      lines.push(`| ${fields.map((field) => markdownCell(row[field.key])).join(' | ')} |`)
    }
    return Buffer.from(lines.join('\n'))
  }
  return renderPdf(projected, fields)
}
