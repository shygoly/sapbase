/**
 * 审批 `when` 的受限表达式：只做词法/句法校验并抽取字段引用，**不求值**。
 * 求值属 runtime；编译期一旦求值，就从"确定性判据"滑向"半个解释器"。
 *
 * 语法见 docs/protocols/blueprint-delivery.md §2.2。
 */

export type ExpressionParseResult =
  | { ok: true; identifiers: string[] }
  | { ok: false; error: string }

type Token =
  | { kind: 'ident'; value: string }
  | { kind: 'number'; value: string }
  | { kind: 'string'; value: string }
  | { kind: 'op'; value: string }

const TWO_CHAR_OPS = ['>=', '<=', '==', '!=', '&&', '||'] as const
const ONE_CHAR_OPS = new Set(['>', '<', '(', ')'])

export function parseRestrictedExpression(source: string): ExpressionParseResult {
  let tokens: Token[]
  try {
    tokens = tokenize(source)
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }

  const identifiers = tokens.filter((token) => token.kind === 'ident').map((token) => token.value)
  let index = 0

  const peek = (): Token | undefined => tokens[index]
  const consume = (): Token => {
    const token = tokens[index]
    if (!token) throw new Error('表达式不完整')
    index += 1
    return token
  }

  const parsePrimary = (): void => {
    const token = peek()
    if (!token) throw new Error('表达式不完整')
    if (token.kind === 'op' && token.value === '(') {
      consume()
      parseOr()
      const close = consume()
      if (close.kind !== 'op' || close.value !== ')') {
        throw new Error(`期望 ')'，实际 ${close.value}`)
      }
      return
    }
    if (token.kind === 'ident' || token.kind === 'number' || token.kind === 'string') {
      consume()
      return
    }
    throw new Error(`非法记号：${token.value}`)
  }

  const parseComparison = (): void => {
    parsePrimary()
    const token = peek()
    if (
      token?.kind === 'op' &&
      (token.value === '>' ||
        token.value === '>=' ||
        token.value === '<' ||
        token.value === '<=' ||
        token.value === '==' ||
        token.value === '!=')
    ) {
      consume()
      parsePrimary()
    }
  }

  const parseAnd = (): void => {
    parseComparison()
    while (peek()?.kind === 'op' && peek()?.value === '&&') {
      consume()
      parseComparison()
    }
  }

  const parseOr = (): void => {
    parseAnd()
    while (peek()?.kind === 'op' && peek()?.value === '||') {
      consume()
      parseAnd()
    }
  }

  try {
    if (tokens.length === 0) return { ok: false, error: '表达式为空' }
    parseOr()
    if (index !== tokens.length) {
      return { ok: false, error: `表达式末尾有多余记号：${tokens[index].value}` }
    }
    return { ok: true, identifiers }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1
      continue
    }

    const two = source.slice(i, i + 2)
    if ((TWO_CHAR_OPS as readonly string[]).includes(two)) {
      tokens.push({ kind: 'op', value: two })
      i += 2
      continue
    }
    if (ONE_CHAR_OPS.has(ch)) {
      tokens.push({ kind: 'op', value: ch })
      i += 1
      continue
    }

    if (ch === '"' || ch === "'") {
      const end = source.indexOf(ch, i + 1)
      if (end < 0) throw new Error('字符串字面量未闭合')
      tokens.push({ kind: 'string', value: source.slice(i, end + 1) })
      i = end + 1
      continue
    }

    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const match = source.slice(i).match(/^-?\d+(\.\d+)?/)
      if (!match) throw new Error(`无法解析的数字：${ch}`)
      tokens.push({ kind: 'number', value: match[0] })
      i += match[0].length
      continue
    }

    if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch === '_') {
      const match = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?/)
      if (!match) throw new Error(`无法解析的标识符：${ch}`)
      tokens.push({ kind: 'ident', value: match[0] })
      i += match[0].length
      continue
    }

    throw new Error(`非法字符：${ch}`)
  }
  return tokens
}
