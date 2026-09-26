export interface RelatedRecord {
  id: string
  data: Record<string, unknown>
}

export interface TraceabilityHit {
  batchId: string
  partId: string | null
  partNo: string | null
  quantity: number | null
  shippedOn: string | null
  orderId: string | null
  orderNumber: string | null
  customerId: string | null
  customerName: string | null
  notes: string[]
}

export interface TraceabilityResult {
  found: boolean
  batchNo: string
  hits: TraceabilityHit[]
}

export interface TraceabilityLookup {
  parts: Map<string, RelatedRecord>
  orders: Map<string, RelatedRecord>
  customers: Map<string, RelatedRecord>
}

function asId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asQuantity(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value)
  return null
}

/**
 * 把批次命中行组装成反向查询结果。悬空引用给 null + notes，不抛。
 * 未知批次（没有任何行）→ found:false + hits:[]。
 */
export function assembleTraceability(
  batchNo: string,
  batches: RelatedRecord[],
  lookup: TraceabilityLookup,
): TraceabilityResult {
  if (batches.length === 0) {
    return { found: false, batchNo, hits: [] }
  }

  const hits = batches.map((batch) => {
    const notes: string[] = []
    const partId = asId(batch.data.part)
    const orderId = asId(batch.data.order)
    const part = partId ? lookup.parts.get(partId) : undefined
    const order = orderId ? lookup.orders.get(orderId) : undefined
    const customerId = order ? asId(order.data.customer) : null
    const customer = customerId ? lookup.customers.get(customerId) : undefined

    if (!partId) notes.push('批次行缺少 part 引用')
    else if (!part) notes.push(`零件 ${partId} 不存在`)
    else if (!asText(part.data.partNo)) notes.push(`零件 ${partId} 缺少 partNo，已返回 id`)

    if (!orderId) notes.push('批次行缺少 order 引用')
    else if (!order) notes.push(`订单 ${orderId} 不存在`)

    if (order && !customerId) notes.push(`订单 ${orderId} 缺少 customer 引用`)
    else if (customerId && !customer) notes.push(`客户 ${customerId} 不存在`)

    return {
      batchId: batch.id,
      partId,
      partNo: part ? asText(part.data.partNo) : null,
      quantity: asQuantity(batch.data.quantity),
      shippedOn: asText(batch.data.shippedOn),
      orderId,
      orderNumber: order ? asText(order.data.number) : null,
      customerId,
      customerName: customer ? asText(customer.data.name) : null,
      notes,
    }
  })

  return { found: true, batchNo, hits }
}
