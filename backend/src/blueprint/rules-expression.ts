/**
 * 审批 `when` 与计算字段 `expr` 的词法/句法入口：只抽取字段引用，**不求值**。
 * 求值在 expression-evaluator.ts（P2），编译期一旦求值就从"确定性判据"滑向"半个解释器"。
 *
 * 两套入口共用同一套 token/优先级，但顶层类型不同：
 *   - `parseRestrictedExpression`（`approval.when`）：顶层必须是布尔条件；
 *     算术只允许出现在比较操作数两侧。因此 `'quantity * unitPrice > 100000'` 合法，
 *     `'amount + 1'` 仍非法（不是条件）——既有负例继续钉住。
 *   - `parseComputedExpression`（`computed.expr`）：算术表达式。
 */

import {
  parseComputedSyntax,
  parseConditionSyntax,
  type ExpressionParseResult,
} from './expression-evaluator'

export type { ExpressionParseResult }

export function parseRestrictedExpression(source: string): ExpressionParseResult {
  return parseConditionSyntax(source)
}

export function parseComputedExpression(source: string): ExpressionParseResult {
  return parseComputedSyntax(source)
}
