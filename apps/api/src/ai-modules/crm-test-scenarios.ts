/**
 * CRM 回归场景：用模块 patchContent 中的 objects/semantic 校验实体字段与关系。
 *
 * 不是“模拟 500ms 然后全过”：缺少实体/字段会返回 failed 与具体错误，
 * 便于 AI 模块在提交评审前发现 DSL 不完整。
 */

export interface CrmTestScenario {
  name: string
  entityType: string
  /** 每组至少命中一个（兼容 orderNo/orderNumber 命名）。 */
  requiredFields: string[][]
  /** 可选关系：命中任意一个即可，不强制。 */
  relations?: string[][]
}

export const CRM_TEST_SCENARIOS: CrmTestScenario[] = [
  {
    name: 'Customer CRUD',
    entityType: 'Customer',
    requiredFields: [['id'], ['name', 'customerName'], ['email', 'contactEmail']],
    relations: [['orders', 'order'], ['transactions']],
  },
  {
    name: 'Order CRUD',
    entityType: 'Order',
    requiredFields: [
      ['id'],
      ['orderNo', 'orderNumber', 'number'],
      ['total', 'totalAmount', 'amount'],
      ['status'],
    ],
    relations: [['customer', 'customerId'], ['items', 'orderItems'], ['tracking']],
  },
  {
    name: 'OrderTracking CRUD',
    entityType: 'OrderTracking',
    requiredFields: [['id'], ['orderId', 'order'], ['status'], ['timestamp', 'trackedAt', 'createdAt']],
    relations: [['order']],
  },
  {
    name: 'FinancialTransaction CRUD',
    entityType: 'FinancialTransaction',
    requiredFields: [
      ['id'],
      ['transactionNumber', 'transactionNo', 'number'],
      ['amount'],
      ['type', 'transactionType'],
      ['status'],
    ],
    relations: [['order', 'orderId'], ['customer', 'customerId']],
  },
]

export interface CrmScenarioResult {
  scenario: string
  entityType: string
  status: 'passed' | 'failed' | 'skipped'
  errors: string[]
  warnings: string[]
  coverage: { fields: number; matched: number; percent: number }
}

export function runCrmScenario(
  patchContent: Record<string, any> | null | undefined,
  scenario: CrmTestScenario,
): CrmScenarioResult {
  const objects = patchContent?.objects
  const semanticEntities = patchContent?.semantic?.entities
  const entity =
    (objects && typeof objects === 'object' ? objects[scenario.entityType] : null) ??
    (Array.isArray(semanticEntities)
      ? semanticEntities.find((item: any) => item?.name === scenario.entityType)
      : null)

  if (!entity) {
    return {
      scenario: scenario.name,
      entityType: scenario.entityType,
      status: 'failed',
      errors: [`patchContent 缺少实体 ${scenario.entityType}`],
      warnings: [],
      coverage: { fields: 0, matched: 0, percent: 0 },
    }
  }

  const fields: Array<{ name?: string }> = Array.isArray(entity.fields) ? entity.fields : []
  const fieldNames = new Set(fields.map((field) => String(field.name ?? '').toLowerCase()))
  const errors: string[] = []
  let matched = 0
  for (const group of scenario.requiredFields) {
    const hit = group.some((name) => fieldNames.has(name.toLowerCase()))
    if (hit) matched += 1
    else errors.push(`缺少字段：${group.join(' / ')}`)
  }

  const warnings: string[] = []
  const relations: Array<{ name?: string; target?: string }> = Array.isArray(entity.relations)
    ? entity.relations
    : []
  if (scenario.relations && scenario.relations.length > 0 && relations.length === 0) {
    warnings.push('实体未声明 relations（关系检查跳过）')
  }

  const total = scenario.requiredFields.length
  return {
    scenario: scenario.name,
    entityType: scenario.entityType,
    status: errors.length === 0 ? 'passed' : 'failed',
    errors,
    warnings,
    coverage: {
      fields: total,
      matched,
      percent: total === 0 ? 100 : Math.round((matched / total) * 100),
    },
  }
}

export function runAllCrmScenarios(
  patchContent: Record<string, any> | null | undefined,
): CrmScenarioResult[] {
  return CRM_TEST_SCENARIOS.map((scenario) => runCrmScenario(patchContent, scenario))
}

export function coverageFor(results: CrmScenarioResult[]): {
  scenarios: number
  passed: number
  failed: number
  percent: number
  entities: number
} {
  const passed = results.filter((result) => result.status === 'passed').length
  const failed = results.filter((result) => result.status === 'failed').length
  return {
    scenarios: results.length,
    passed,
    failed,
    percent: results.length === 0 ? 0 : Math.round((passed / results.length) * 100),
    entities: passed,
  }
}
