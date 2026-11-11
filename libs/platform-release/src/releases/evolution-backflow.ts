/**
 * 实例演进回流与升级冲突的纯函数。
 *
 * - 回流：客户数据必须先脱敏，命中项逐条返回，禁止静默放行；
 * - 升级：base / instance / next 三方比较，双方改同一路径即冲突并阻塞。
 */

export type BackflowFindingType =
  | 'phone'
  | 'email'
  | 'id-card'
  | 'amount'
  | 'order-number'
  | 'customer-name'
  | 'person-name'

export interface BackflowFinding {
  type: BackflowFindingType
  value: string
}

const PATTERNS: Array<{ type: BackflowFindingType; regex: RegExp; mask: string }> = [
  { type: 'phone', regex: /\b1[3-9]\d{9}\b/g, mask: '[PHONE]' },
  {
    type: 'email',
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    mask: '[EMAIL]',
  },
  { type: 'id-card', regex: /\b\d{17}[\dXx]\b/g, mask: '[ID_CARD]' },
  {
    type: 'amount',
    regex: /(?:¥|￥|CNY|RMB)\s?-?\d+(?:,\d{3})*(?:\.\d+)?/gi,
    mask: '[AMOUNT]',
  },
  {
    type: 'order-number',
    regex: /\b(?:SO|PO|ORD|ORDER|INV)[-_]?\d{4,}\b/gi,
    mask: '[ORDER_NO]',
  },
  { type: 'customer-name', regex: /(客户|公司|机构)[:：]\s*[^\s，。；,;]{2,30}/g, mask: '$1：[CUSTOMER]' },
  { type: 'person-name', regex: /(姓名|联系人|负责人)[:：]\s*[^\s，。；,;]{1,20}/g, mask: '$1：[PERSON]' },
]

export function scanBackflow(text: string): BackflowFinding[] {
  const findings: BackflowFinding[] = []
  for (const pattern of PATTERNS) {
    for (const match of String(text ?? '').matchAll(pattern.regex)) {
      findings.push({ type: pattern.type, value: match[0] })
    }
  }
  return findings
}

export function redactBackflow(text: string): {
  text: string
  findings: BackflowFinding[]
  safe: boolean
} {
  let output = String(text ?? '')
  const findings = scanBackflow(output)
  for (const pattern of PATTERNS) {
    output = output.replace(pattern.regex, pattern.mask)
  }
  return { text: output, findings, safe: findings.length === 0 }
}

export interface UpgradeConflict {
  path: string
  base: unknown
  instance: unknown
  next: unknown
  reason: 'both-modified' | 'instance-deleted' | 'next-deleted'
}

export interface UpgradeCheckResult {
  compatible: boolean
  conflicts: UpgradeConflict[]
  resolved: Record<string, unknown>
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * 三方合并：instance 是实例自己的改动，next 是平台升级后的值。
 * 只有一侧改动时自动采用；双方改同一路径且值不同则冲突。
 */
export function checkUpgradeConflicts(input: {
  base: Record<string, unknown>
  instance: Record<string, unknown>
  next: Record<string, unknown>
}): UpgradeCheckResult {
  const conflicts: UpgradeConflict[] = []

  const merge = (
    base: Record<string, unknown>,
    instance: Record<string, unknown>,
    next: Record<string, unknown>,
    path: string,
  ): Record<string, unknown> => {
    const keys = new Set([
      ...Object.keys(base),
      ...Object.keys(instance),
      ...Object.keys(next),
    ])
    const resolved: Record<string, unknown> = {}
    for (const key of keys) {
      const keyPath = path ? `${path}.${key}` : key
      const baseValue = base[key]
      const instanceValue = instance[key]
      const nextValue = next[key]
      const instanceChanged = !same(baseValue, instanceValue)
      const nextChanged = !same(baseValue, nextValue)

      if (!instanceChanged) {
        if (nextValue !== undefined) resolved[key] = nextValue
        continue
      }
      if (!nextChanged) {
        if (instanceValue !== undefined) resolved[key] = instanceValue
        continue
      }
      if (same(instanceValue, nextValue)) {
        resolved[key] = instanceValue
        continue
      }
      if (isPlainObject(instanceValue) && isPlainObject(nextValue)) {
        resolved[key] = merge(
          isPlainObject(baseValue) ? baseValue : {},
          instanceValue,
          nextValue,
          keyPath,
        )
        continue
      }
      conflicts.push({
        path: keyPath,
        base: baseValue,
        instance: instanceValue,
        next: nextValue,
        reason: 'both-modified',
      })
    }
    return resolved
  }

  const resolved = merge(input.base, input.instance, input.next, '')
  return { compatible: conflicts.length === 0, conflicts, resolved }
}
