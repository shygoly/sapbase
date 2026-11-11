import {
  checkUpgradeConflicts,
  redactBackflow,
  scanBackflow,
} from '@sap/platform-release/releases/evolution-backflow'

describe('evolution backflow (compat)', () => {
  it('脱敏客户名称/金额/单据号/人员/手机/邮箱', () => {
    const text =
      '客户：山禾制造；联系人：张三；金额 CNY 12,000.50；单号 SO-20261111001；电话 13800138000；邮箱 a@b.com'
    const findings = scanBackflow(text)
    expect(findings.length).toBeGreaterThanOrEqual(6)
    const result = redactBackflow(text)
    expect(result.safe).toBe(false)
    expect(result.text).toContain('[CUSTOMER]')
    expect(result.text).toContain('[AMOUNT]')
    expect(result.text).toContain('[ORDER_NO]')
    expect(result.text).not.toContain('13800138000')
  })

  it('无敏感内容 safe=true', () => {
    expect(redactBackflow('字段 label 改名').safe).toBe(true)
  })

  it('三方合并：双方改同一路径不同值 → 冲突阻塞', () => {
    const result = checkUpgradeConflicts({
      base: { form: { title: 'A' } },
      instance: { form: { title: 'Instance' } },
      next: { form: { title: 'Platform' } },
    })
    expect(result.compatible).toBe(false)
    expect(result.conflicts[0]).toMatchObject({ path: 'form.title', reason: 'both-modified' })
  })

  it('三方合并：单侧改动自动采用', () => {
    const result = checkUpgradeConflicts({
      base: { form: { title: 'A', amount: 1 } },
      instance: { form: { title: 'Instance', amount: 1 } },
      next: { form: { title: 'A', amount: 2 } },
    })
    expect(result.compatible).toBe(true)
    expect(result.resolved).toEqual({ form: { title: 'Instance', amount: 2 } })
  })
})
