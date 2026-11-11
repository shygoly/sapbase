import { ReviewCheckRegistry } from './review-check'

/**
 * 内置机器检测 provider。
 *
 * `basic`：对文本做基础敏感信息检查（手机号 / 身份证 / 邮箱）。
 * 命中返回 warn（可人工确认），不直接 fail；provider 异常/未知仍由
 * `ReviewCheckService` fail-closed 成 fail。
 */
export function createDefaultReviewCheckRegistry(): ReviewCheckRegistry {
  const registry = new ReviewCheckRegistry()
  registry.register({
    name: 'basic',
    async check(input: Record<string, unknown>) {
      const text = String(input.text ?? input.content ?? '')
      const findings: string[] = []
      if (/\b1[3-9]\d{9}\b/.test(text)) findings.push('phone')
      if (/\b\d{17}[\dXx]\b/.test(text)) findings.push('id-card')
      if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) findings.push('email')
      if (findings.length > 0) {
        return {
          status: 'warn' as const,
          evidence: { provider: 'basic', findings, message: '文本包含敏感信息，需人工确认' },
        }
      }
      return { status: 'pass' as const, evidence: { provider: 'basic', findings: [] } }
    },
  })
  return registry
}
