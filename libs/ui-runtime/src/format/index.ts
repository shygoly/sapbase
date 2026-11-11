/**
 * Runtime 统一格式管道：日期 / 货币 / 单位 / 数字。
 * 只做展示；金额精度与业务舍入仍由后端/金额库决定。
 */

export interface FormatOptions {
  locale?: string
  timeZone?: string
}

const DEFAULT_LOCALE = 'zh-CN'

export function formatDate(
  value: Date | string | number | null | undefined,
  options: FormatOptions & { withTime?: boolean } = {},
): string {
  if (value === null || value === undefined || value === '') return '-'
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T00:00:00`)
        : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat(options.locale ?? DEFAULT_LOCALE, {
    timeZone: options.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(options.withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

export function formatCurrency(
  value: number | string | null | undefined,
  currency = 'CNY',
  options: FormatOptions = {},
): string {
  if (value === null || value === undefined || value === '') return '-'
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return '-'
  return new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const UNIT_LABELS: Record<string, string> = {
  kg: 'kg',
  g: 'g',
  t: 't',
  m: 'm',
  cm: 'cm',
  mm: 'mm',
  m2: 'm²',
  m3: 'm³',
  l: 'L',
  ml: 'mL',
  pcs: '件',
  box: '箱',
  pack: '包',
  hour: '小时',
  day: '天',
}

/** 单位展示；未知单位原样输出，不静默换算。 */
export function formatUnit(
  value: number | string | null | undefined,
  unit: string | null | undefined,
  options: FormatOptions = {},
): string {
  if (value === null || value === undefined || value === '') return '-'
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return '-'
  const number = new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALE, {
    maximumFractionDigits: 4,
  }).format(amount)
  if (!unit) return number
  return `${number} ${UNIT_LABELS[unit] ?? unit}`
}

export function formatNumber(
  value: number | string | null | undefined,
  options: FormatOptions & { maximumFractionDigits?: number } = {},
): string {
  if (value === null || value === undefined || value === '') return '-'
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return '-'
  return new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALE, {
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(amount)
}

/** 按字段类型选择展示格式；未知类型回退字符串。 */
export function formatFieldValue(
  value: unknown,
  type: string,
  options: FormatOptions & { unit?: string } = {},
): string {
  if (value === null || value === undefined) return '-'
  switch (type) {
    case 'date':
      return formatDate(value as never, options)
    case 'datetime':
      return formatDate(value as never, { ...options, withTime: true })
    case 'number':
      return formatNumber(value as never, options)
    case 'currency':
      return formatCurrency(value as never, 'CNY', options)
    case 'unit':
      return formatUnit(value as never, options.unit, options)
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }
}
