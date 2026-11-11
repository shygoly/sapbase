import type { ReviewCheckProvider, ReviewCheckResult } from '../review/review-check'

const FAIL_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /system prompt/i,
  /self[- ]harm/i,
  /制作炸弹|爆炸物/,
  /exploit|sql injection/i,
]
const WARN_PATTERNS = [/\b1[3-9]\d{9}\b/, /\b\d{17}[\dXx]\b/, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i]

/**
 * 内容安全 provider：输入/输出检测共用。
 * 命中违规 → fail；命中敏感信息 → warn；异常/未知由 ReviewCheckService fail-closed。
 */
export async function contentSafetyCheck(
  input: Record<string, unknown>,
): Promise<ReviewCheckResult> {
  const text = String(input.text ?? input.content ?? '')
  const fail = FAIL_PATTERNS.filter((pattern) => pattern.test(text))
  if (fail.length > 0) {
    return {
      status: 'fail',
      evidence: { provider: 'content-safety', reason: 'unsafe-content', matches: fail.length },
    }
  }
  const warn = WARN_PATTERNS.filter((pattern) => pattern.test(text))
  if (warn.length > 0) {
    return {
      status: 'warn',
      evidence: { provider: 'content-safety', reason: 'sensitive-data', matches: warn.length },
    }
  }
  return {
    status: 'pass',
    evidence: { provider: 'content-safety', reason: 'clean', mode: input.mode ?? 'unknown' },
  }
}

export const contentSafetyProvider: ReviewCheckProvider = {
  name: 'content-safety',
  check: contentSafetyCheck,
}
