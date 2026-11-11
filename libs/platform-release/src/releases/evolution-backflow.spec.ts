import { checkUpgradeConflicts, redactBackflow, scanBackflow } from './evolution-backflow'

describe('evolution backflow redaction', () => {
  it('命中客户名称/金额/单据号/人员/手机/邮箱并脱敏', () => {
    const text =
      '客户：山禾制造；联系人：张三；金额 CNY 12,000.50；单号 SO-20261111001；电话 13800138000；邮箱 a@b.com'
    const findings = scanBackflow(text)
    expect(findings.map((item) => item.type).sort()).toEqual(
      ['amount', 'customer-name', 'email', 'order-number', 'person-name', 'phone'].sort(),
    )
    const result = redactBackflow(text)
    expect(result.safe).toBe(false)
    expect(result.text).not.toContain('山禾制造')
    expect(result.text).not.toContain('张三')
    expect(result.text).not.toContain('13800138000')
    expect(result.text).not.toContain('a@b.com')
    expect(result.text).toContain('[CUSTOMER]')
    expect(result.text).toContain('[AMOUNT]')
    expect(result.text).toContain('[ORDER_NO]')
  })

  it('无敏感内容时 safe=true 且文本不变', () => {
    const result = redactBackflow('字段 label 改为 客户名称，状态机 draft → active')
    expect(result.safe).toBe(true)
    expect(result.findings).toEqual([])
    expect(result.text).toBe('字段 label 改为 客户名称，状态机 draft → active')
  })
})

describe('evolution upgrade conflicts', () => {
  it('同一路径双方都改且值不同 → 冲突并保留两份值', () => {
    const result = checkUpgradeConflicts({
      base: { form: { title: 'A', amount: 1 } },
      instance: { form: { title: 'Instance', amount: 1 } },
      next: { form: { title: 'Platform', amount: 1 } },
    })
    expect(result.compatible).toBe(false)
    expect(result.conflicts).toEqual([
      {
        path: 'form.title',
        base: 'A',
        instance: 'Instance',
        next: 'Platform',
        reason: 'both-modified',
      },
    ])
  })

  it('只有一侧改动时自动合并', () => {
    const result = checkUpgradeConflicts({
      base: { form: { title: 'A', amount: 1 } },
      instance: { form: { title: 'Instance', amount: 1 } },
      next: { form: { title: 'A', amount: 2 } },
    })
    expect(result.compatible).toBe(true)
    expect(result.resolved).toEqual({ form: { title: 'Instance', amount: 2 } })
  })

  it('双方改成相同值不算冲突', () => {
    const result = checkUpgradeConflicts({
      base: { field: { label: 'A' } },
      instance: { field: { label: 'B' } },
      next: { field: { label: 'B' } },
    })
    expect(result.compatible).toBe(true)
  })
})
