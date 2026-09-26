/**
 * 平台内置查询视图：库存 / 在途 / 应收。
 *
 * 跨实体聚合，模板层没有聚合声明能力（rollups 只做「头 → 自己的行」），
 * 所以这三个视图是平台固定口径，不是模板声明、更不是模板里的 SQL。
 * 本文件只做行 → 结果组装（可单测）；SQL 在 service。
 */

export interface StockAggRow {
  partId: string | null
  partNo: string | null
  onHand: unknown
  reserved: unknown
  available: unknown
  inTransit: unknown
}

export interface InTransitAggRow {
  partId: string | null
  partNo: string | null
  inTransit: unknown
}

export interface ReceivableAggRow {
  customerId: string | null
  customerName: string | null
  receivable: unknown
  currency?: string | null
}

export interface StockViewRow {
  partId: string
  partNo?: string
  onHand: number
  reserved: number
  available: number
  inTransit: number
}

export interface InTransitViewRow {
  partId: string
  partNo?: string
  inTransit: number
}

export interface ReceivableViewRow {
  customerId: string
  customerName?: string
  receivable: string
  currency?: string
}

const INT_TEXT = /^-?\d+$/
const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/

function asInt(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && INT_TEXT.test(value)) return Number(value)
  return 0
}

function asId(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : ''
}

function asOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** 金额保持小数串；禁止落到 JS number。缺省 / 非法 → "0"。 */
export function asDecimalText(value: unknown): string {
  if (typeof value === 'string' && DECIMAL_TEXT.test(value)) return value
  if (typeof value === 'number' && Number.isInteger(value)) return String(value)
  return '0'
}

function compareTextThenId(aName: string | undefined, aId: string, bName: string | undefined, bId: string): number {
  const nameCmp = (aName ?? '').localeCompare(bName ?? '', 'en')
  if (nameCmp !== 0) return nameCmp
  return aId.localeCompare(bId, 'en')
}

export function assembleStockView(rows: StockAggRow[]): StockViewRow[] {
  return rows
    .map((row) => {
      const partId = asId(row.partId)
      const partNo = asOptionalText(row.partNo)
      const result: StockViewRow = {
        partId,
        onHand: asInt(row.onHand),
        reserved: asInt(row.reserved),
        available: asInt(row.available),
        inTransit: asInt(row.inTransit),
      }
      if (partNo !== undefined) result.partNo = partNo
      return result
    })
    .sort((a, b) => compareTextThenId(a.partNo, a.partId, b.partNo, b.partId))
}

export function assembleInTransitView(rows: InTransitAggRow[]): InTransitViewRow[] {
  return rows
    .map((row) => {
      const partId = asId(row.partId)
      const partNo = asOptionalText(row.partNo)
      const result: InTransitViewRow = { partId, inTransit: asInt(row.inTransit) }
      if (partNo !== undefined) result.partNo = partNo
      return result
    })
    .sort((a, b) => compareTextThenId(a.partNo, a.partId, b.partNo, b.partId))
}

export function assembleReceivableView(rows: ReceivableAggRow[]): ReceivableViewRow[] {
  return rows
    .map((row) => {
      const customerId = asId(row.customerId)
      const customerName = asOptionalText(row.customerName)
      const result: ReceivableViewRow = {
        customerId,
        receivable: asDecimalText(row.receivable),
      }
      if (customerName !== undefined) result.customerName = customerName
      const currency = asOptionalText(row.currency)
      if (currency !== undefined) result.currency = currency
      return result
    })
    .sort((a, b) => {
      const ccy = (a.currency ?? '').localeCompare(b.currency ?? '', 'en')
      if (ccy !== 0) return ccy
      return compareTextThenId(a.customerName, a.customerId, b.customerName, b.customerId)
    })
}
