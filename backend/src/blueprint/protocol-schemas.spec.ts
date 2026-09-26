// D1 协议冻结：三个新 Schema 的正例通过、拒绝集被拒。
// 拒绝是有意的（additionalProperties + 显式 not），不是碰巧没定义。
import { Validator } from 'jsonschema'
import { loadSchema } from '../common/protocol/schema-loader'

const validator = new Validator()

function check(schemaFile: string, instance: unknown): { valid: boolean; errors: string[] } {
  const result = validator.validate(instance, loadSchema(schemaFile))
  return {
    valid: result.valid,
    errors: result.errors.map((error) => `${error.property}: ${error.message}`),
  }
}

const VALID_RULES = {
  rules: 'blueprint-rules/v1',
  validation: [
    {
      id: 'po-amount-positive',
      entity: 'PurchaseOrder',
      field: 'amount',
      rule: 'greaterThan',
      value: 0,
      message: '金额必须为正',
    },
  ],
  approval: [
    {
      id: 'high-value',
      entity: 'PurchaseOrder',
      when: 'amount > 500000',
      steps: [{ role: 'finance-manager' }, { role: 'gm' }],
    },
  ],
  accounting: [
    {
      id: 'po-received',
      on: 'PurchaseOrder.received',
      entries: [
        { account: '1401', side: 'debit', amount: '$entity.amount' },
        { account: '2202', side: 'credit', amount: '$entity.amount' },
      ],
    },
  ],
}

const VALID_EXPERIENCE = {
  experience: 'blueprint-experience/v1',
  priority: [{ entity: 'PurchaseOrder', fields: ['supplier', 'amount', 'deliveryDate'] }],
  confirm: [
    {
      action: 'PurchaseOrder.submitted',
      when: { field: 'PurchaseOrder.amount', op: 'greaterThan', value: 500000 },
    },
  ],
  automate: [{ action: 'available-inventory' }],
  surfaces: [
    {
      id: 'purchase-order.approval-needed',
      when: { entity: 'PurchaseOrder', state: 'submitted' },
    },
  ],
}

const VALID_LICENSE = {
  license: 'blueprint-license/v1',
  grantedTo: ['org-1111'],
  resell: false,
  expiresAt: '2027-09-25T00:00:00Z',
  issuer: 'sapbase-platform',
}

describe('blueprint-rules.schema.json', () => {
  it('正例：三类规则都合法', () => {
    expect(check('blueprint-rules.schema.json', VALID_RULES).valid).toBe(true)
  })

  it('负例：未知 layer 键（如 bom）被拒', () => {
    const result = check('blueprint-rules.schema.json', { ...VALID_RULES, bom: [] })
    expect(result.valid).toBe(false)
  })

  it('负例：借贷方向非法（side 不是 debit/credit）', () => {
    const bad = {
      ...VALID_RULES,
      accounting: [
        {
          id: 'po-received',
          on: 'PurchaseOrder.received',
          entries: [
            { account: '1401', side: 'left', amount: 100 },
            { account: '2202', side: 'credit', amount: 100 },
          ],
        },
      ],
    }
    expect(check('blueprint-rules.schema.json', bad).valid).toBe(false)
  })

  it('加法修订：greaterOrEqual / lessOrEqual 现在通过，value 必须是 number', () => {
    const ge = {
      ...VALID_RULES,
      validation: [
        {
          id: 'so-price-nonneg',
          entity: 'SalesOrder',
          field: 'unitPrice',
          rule: 'greaterOrEqual',
          value: 0,
          message: '单价不能为负',
        },
      ],
    }
    expect(check('blueprint-rules.schema.json', ge).valid).toBe(true)

    const le = {
      ...VALID_RULES,
      validation: [
        {
          id: 'so-qty-cap',
          entity: 'SalesOrder',
          field: 'quantity',
          rule: 'lessOrEqual',
          value: 100,
          message: '数量上限',
        },
      ],
    }
    expect(check('blueprint-rules.schema.json', le).valid).toBe(true)

    const badValue = {
      ...VALID_RULES,
      validation: [
        {
          id: 'so-price-nonneg',
          entity: 'SalesOrder',
          field: 'unitPrice',
          rule: 'greaterOrEqual',
          value: '0',
          message: '单价不能为负',
        },
      ],
    }
    expect(check('blueprint-rules.schema.json', badValue).valid).toBe(false)
  })

  it('负例：未知运算符仍被拒', () => {
    const unknown = {
      ...VALID_RULES,
      validation: [
        {
          id: 'so-price-nonneg',
          entity: 'SalesOrder',
          field: 'unitPrice',
          rule: 'atLeast',
          value: 0,
          message: '单价不能为负',
        },
      ],
    }
    expect(check('blueprint-rules.schema.json', unknown).valid).toBe(false)
  })

  it('负例：expression / eval / script / lambda / fn 有意拒绝', () => {
    for (const forbidden of ['expression', 'eval', 'script', 'lambda', 'fn']) {
      const result = check('blueprint-rules.schema.json', {
        ...VALID_RULES,
        [forbidden]: 'amount * 2',
      })
      expect(result.valid).toBe(false)
    }

    const withEvalOnRule = {
      ...VALID_RULES,
      validation: [
        {
          ...VALID_RULES.validation[0],
          expression: 'amount > 0',
        },
      ],
    }
    expect(check('blueprint-rules.schema.json', withEvalOnRule).valid).toBe(false)
  })
})

describe('blueprint-experience.schema.json', () => {
  it('正例：四类策略都合法，且字段挂在实体上', () => {
    expect(check('blueprint-experience.schema.json', VALID_EXPERIENCE).valid).toBe(true)
  })

  it('负例：layout / width / position / component 等布局字段有意拒绝', () => {
    for (const field of [
      'layout',
      'width',
      'position',
      'component',
      'style',
      'x',
      'y',
      'height',
      'css',
      'class',
      'render',
    ]) {
      const result = check('blueprint-experience.schema.json', {
        ...VALID_EXPERIENCE,
        [field]: 'grid',
      })
      expect(result.valid).toBe(false)
    }
  })

  it('负例：嵌套对象上的 layout 也被拒', () => {
    const nested = {
      ...VALID_EXPERIENCE,
      priority: [{ entity: 'PurchaseOrder', fields: ['amount'], layout: 'row' }],
    }
    expect(check('blueprint-experience.schema.json', nested).valid).toBe(false)
  })

  it('负例：未知 layer 键被拒', () => {
    expect(check('blueprint-experience.schema.json', { ...VALID_EXPERIENCE, forms: [] }).valid).toBe(
      false,
    )
  })
})

describe('blueprint-license.schema.json', () => {
  it('正例：完整授权声明', () => {
    expect(check('blueprint-license.schema.json', VALID_LICENSE).valid).toBe(true)
  })

  it('正例：空 grantedTo（平台自用）且无 expiresAt / signature', () => {
    expect(
      check('blueprint-license.schema.json', {
        license: 'blueprint-license/v1',
        grantedTo: [],
        resell: false,
        issuer: 'sapbase-platform',
      }).valid,
    ).toBe(true)
  })

  it('负例：expiresAt 形状非法', () => {
    expect(
      check('blueprint-license.schema.json', { ...VALID_LICENSE, expiresAt: 'tomorrow' }).valid,
    ).toBe(false)
    expect(
      check('blueprint-license.schema.json', { ...VALID_LICENSE, expiresAt: '2027-09-25' }).valid,
    ).toBe(false)
  })

  it('负例：grantedTo 非数组', () => {
    expect(
      check('blueprint-license.schema.json', { ...VALID_LICENSE, grantedTo: 'org-1111' }).valid,
    ).toBe(false)
  })

  it('负例：未知 layer 键被拒', () => {
    expect(check('blueprint-license.schema.json', { ...VALID_LICENSE, watermark: true }).valid).toBe(
      false,
    )
  })
})
