/**
 * 判定点求值器：自写确定性解释器，不用 eval / new Function。
 *
 * 两套入口共用同一套词法与优先级：
 *   - `approval.when`：顶层必须是布尔条件；算术只出现在比较操作数两侧
 *   - `computed.expr`：算术表达式，得到派生值
 *
 * 金额走 money.ts 定点；中间不舍入，写盘才 roundTo。
 */

import {
  addAligned,
  compare,
  DEFAULT_MONEY_SCALE,
  div,
  type FixedDecimal,
  formatFixed,
  MoneyError,
  mul,
  parseFixed,
  subAligned,
} from './money'
export type ExpressionParseResult =
  | { ok: true; identifiers: string[] }
  | { ok: false; error: string }

type Token =
  | { kind: 'ident'; value: string }
  | { kind: 'number'; value: string }
  | { kind: 'string'; value: string }
  | { kind: 'op'; value: string }

const TWO_CHAR_OPS = ['>=', '<=', '==', '!=', '&&', '||'] as const
const ONE_CHAR_OPS = new Set(['>', '<', '(', ')', '+', '-', '*', '/'])
const COMPARE_OPS = new Set(['>', '>=', '<', '<=', '==', '!='])

type Ast =
  | { kind: 'ident'; name: string }
  | { kind: 'number'; raw: string }
  | { kind: 'string'; value: string }
  | { kind: 'unary'; op: '-'; expr: Ast }
  | { kind: 'arith'; op: '+' | '-' | '*' | '/'; left: Ast; right: Ast }
  | { kind: 'cmp'; op: string; left: Ast; right: Ast }
  | { kind: 'logic'; op: '&&' | '||'; left: Ast; right: Ast }

export type EvalFieldType = {
  type: string
  scale?: number
  /** 字段声明的货币；仅 money 字段有。模板侧已被编译期拦住，这条是防御性的。 */
  currency?: string
}

export type EvalContext = {
  values: Record<string, unknown>
  types?: Record<string, EvalFieldType>
}

export type EvalOk<T> = { ok: true; value: T }
export type EvalFail = { ok: false; error: string }
export type EvalResult<T> = EvalOk<T> | EvalFail

export type RuntimeValue =
  | { tag: 'decimal'; value: FixedDecimal; currency?: string }
  | { tag: 'int'; value: bigint }
  | { tag: 'number'; value: number }
  | { tag: 'string'; value: string }
  | { tag: 'boolean'; value: boolean }

export class EvalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EvalError'
  }
}

export function parseConditionSyntax(source: string): ExpressionParseResult {
  return parseToResult(source, 'condition')
}

export function parseComputedSyntax(source: string): ExpressionParseResult {
  return parseToResult(source, 'computed')
}

/**
 * 判定条件求值。顶层必须是布尔条件；`'amount + 1'` 在这里也是非法。
 */
export function evaluateCondition(source: string, ctx: EvalContext): EvalResult<boolean> {
  try {
    const ast = parseAst(source, 'condition')
    const value = evalAst(ast, ctx)
    if (value.tag !== 'boolean') {
      throw new EvalError(`条件求值结果不是布尔：${describeValue(value)}`)
    }
    return { ok: true, value: value.value }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

/**
 * 计算字段求值。结果可以是定点金额或整数；调用方写盘时再按字段标度舍入。
 */
export function evaluateComputed(source: string, ctx: EvalContext): EvalResult<RuntimeValue> {
  try {
    const ast = parseAst(source, 'computed')
    return { ok: true, value: evalAst(ast, ctx) }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

export function runtimeToUnknown(value: RuntimeValue): unknown {
  switch (value.tag) {
    case 'decimal':
      return formatFixed(value.value)
    case 'int':
      return Number(value.value)
    case 'number':
      return value.value
    case 'string':
      return value.value
    case 'boolean':
      return value.value
  }
}

export function asDecimal(value: RuntimeValue): FixedDecimal {
  if (value.tag === 'decimal') return value.value
  if (value.tag === 'int') return parseFixed(value.value.toString(), 0)
  throw new EvalError(`期望定点金额，实际 ${describeValue(value)}`)
}

function parseToResult(source: string, mode: 'condition' | 'computed'): ExpressionParseResult {
  try {
    const ast = parseAst(source, mode)
    return { ok: true, identifiers: collectIdents(ast) }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

function parseAst(source: string, mode: 'condition' | 'computed'): Ast {
  const tokens = mode === 'computed' ? tokenizeComputed(source) : tokenizeCondition(source)
  if (tokens.length === 0) throw new Error('表达式为空')
  let index = 0
  const peek = (): Token | undefined => tokens[index]
  const consume = (): Token => {
    const token = tokens[index]
    if (!token) throw new Error('表达式不完整')
    index += 1
    return token
  }

  const parsePrimary = (): Ast => {
    const token = peek()
    if (!token) throw new Error('表达式不完整')
    if (token.kind === 'op' && token.value === '(') {
      consume()
      const inner = mode === 'computed' ? parseAdd() : parseOr()
      const close = consume()
      if (close.kind !== 'op' || close.value !== ')') {
        throw new Error(`期望 ')'，实际 ${close.value}`)
      }
      return inner
    }
    if (token.kind === 'ident') {
      consume()
      return { kind: 'ident', name: token.value }
    }
    if (token.kind === 'number') {
      consume()
      return { kind: 'number', raw: token.value }
    }
    if (mode === 'condition' && token.kind === 'string') {
      consume()
      return { kind: 'string', value: token.value.slice(1, -1) }
    }
    throw new Error(`非法记号：${token.value}`)
  }

  const parseUnary = (): Ast => {
    if (peek()?.kind === 'op' && peek()?.value === '-') {
      consume()
      return { kind: 'unary', op: '-', expr: parseUnary() }
    }
    return parsePrimary()
  }

  const parseMul = (): Ast => {
    let left = parseUnary()
    while (peek()?.kind === 'op' && (peek()?.value === '*' || peek()?.value === '/')) {
      const op = consume().value as '*' | '/'
      left = { kind: 'arith', op, left, right: parseUnary() }
    }
    return left
  }

  const parseAdd = (): Ast => {
    let left = parseMul()
    while (peek()?.kind === 'op' && (peek()?.value === '+' || peek()?.value === '-')) {
      const op = consume().value as '+' | '-'
      left = { kind: 'arith', op, left, right: parseMul() }
    }
    return left
  }

  const parseComparison = (): Ast => {
    const left = parseAdd()
    const token = peek()
    if (token?.kind === 'op' && COMPARE_OPS.has(token.value)) {
      consume()
      return { kind: 'cmp', op: token.value, left, right: parseAdd() }
    }
    return left
  }

  const parseAnd = (): Ast => {
    let left = parseComparison()
    while (peek()?.kind === 'op' && peek()?.value === '&&') {
      consume()
      left = { kind: 'logic', op: '&&', left, right: parseComparison() }
    }
    return left
  }

  const parseOr = (): Ast => {
    let left = parseAnd()
    while (peek()?.kind === 'op' && peek()?.value === '||') {
      consume()
      left = { kind: 'logic', op: '||', left, right: parseAnd() }
    }
    return left
  }

  const ast = mode === 'computed' ? parseAdd() : parseOr()
  if (index !== tokens.length) {
    throw new Error(`表达式末尾有多余记号：${tokens[index].value}`)
  }
  if (mode === 'condition' && !isBooleanish(ast)) {
    throw new Error('顶层必须是布尔条件，裸算术不是判定条件')
  }
  return ast
}

function isBooleanish(ast: Ast): boolean {
  switch (ast.kind) {
    case 'cmp':
    case 'logic':
      return true
    case 'ident':
    case 'number':
    case 'string':
      return true
    default:
      return false
  }
}

function collectIdents(ast: Ast): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const walk = (node: Ast): void => {
    switch (node.kind) {
      case 'ident':
        if (!seen.has(node.name)) {
          seen.add(node.name)
          out.push(node.name)
        }
        return
      case 'unary':
        walk(node.expr)
        return
      case 'arith':
      case 'cmp':
      case 'logic':
        walk(node.left)
        walk(node.right)
        return
      default:
        return
    }
  }
  walk(ast)
  return out
}

function tokenizeCondition(source: string): Token[] {
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
    if (ch >= '0' && ch <= '9') {
      const match = source.slice(i).match(/^\d+(\.\d+)?/)
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

function tokenizeComputed(source: string): Token[] {
  const tokens: Token[] = []
  const ops = new Set(['+', '-', '*', '/', '(', ')'])
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1
      continue
    }
    if (ops.has(ch)) {
      tokens.push({ kind: 'op', value: ch })
      i += 1
      continue
    }
    if (ch >= '0' && ch <= '9') {
      const match = source.slice(i).match(/^\d+(\.\d+)?/)
      if (!match) throw new Error(`无法解析的数字：${ch}`)
      tokens.push({ kind: 'number', value: match[0] })
      i += match[0].length
      continue
    }
    if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch === '_') {
      const match = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/)
      if (!match) throw new Error(`无法解析的标识符：${ch}`)
      tokens.push({ kind: 'ident', value: match[0] })
      i += match[0].length
      continue
    }
    throw new Error(`非法字符：${ch}`)
  }
  return tokens
}

function evalAst(ast: Ast, ctx: EvalContext): RuntimeValue {
  switch (ast.kind) {
    case 'ident':
      return loadIdent(ast.name, ctx)
    case 'number':
      return loadNumberLiteral(ast.raw)
    case 'string':
      return { tag: 'string', value: ast.value }
    case 'unary': {
      const inner = evalAst(ast.expr, ctx)
      return neg(inner)
    }
    case 'arith':
      return evalArith(ast.op, evalAst(ast.left, ctx), evalAst(ast.right, ctx))
    case 'cmp':
      return { tag: 'boolean', value: evalCmp(ast.op, evalAst(ast.left, ctx), evalAst(ast.right, ctx)) }
    case 'logic': {
      const left = evalAst(ast.left, ctx)
      if (left.tag !== 'boolean') {
        throw new EvalError(`逻辑运算要求布尔操作数，左侧是 ${describeValue(left)}`)
      }
      if (ast.op === '&&' && !left.value) return { tag: 'boolean', value: false }
      if (ast.op === '||' && left.value) return { tag: 'boolean', value: true }
      const right = evalAst(ast.right, ctx)
      if (right.tag !== 'boolean') {
        throw new EvalError(`逻辑运算要求布尔操作数，右侧是 ${describeValue(right)}`)
      }
      return { tag: 'boolean', value: ast.op === '&&' ? left.value && right.value : left.value || right.value }
    }
  }
}

function loadIdent(name: string, ctx: EvalContext): RuntimeValue {
  if (!(name in ctx.values) && name.includes('.')) {
    const field = name.split('.')[1]
    if (field && field in ctx.values) {
      return coerceValue(name, ctx.values[field], ctx.types?.[name] ?? ctx.types?.[field])
    }
  }
  if (!(name in ctx.values)) {
    throw new EvalError(`表达式引用了不存在的字段 ${name}`)
  }
  return coerceValue(name, ctx.values[name], ctx.types?.[name])
}

function loadNumberLiteral(raw: string): RuntimeValue {
  if (/^-?\d+$/.test(raw)) {
    return { tag: 'int', value: BigInt(raw) }
  }
  const frac = raw.split('.')[1] ?? ''
  return { tag: 'decimal', value: parseFixed(raw, frac.length) }
}

function coerceValue(name: string, value: unknown, type?: EvalFieldType): RuntimeValue {
  if (value === undefined || value === null) {
    throw new EvalError(`字段 ${name} 没有值`)
  }
  const declared = type?.type
  if (declared === 'decimal') {
    return {
      tag: 'decimal',
      value: parseDecimalInput(value, type?.scale ?? DEFAULT_MONEY_SCALE, name),
      currency: type?.currency,
    }
  }
  if (declared === 'i32') {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new EvalError(`字段 ${name} 期望 i32 整数`)
    }
    return { tag: 'int', value: BigInt(value) }
  }
  if (declared === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new EvalError(`字段 ${name} 期望 number`)
    }
    if (Number.isInteger(value)) return { tag: 'int', value: BigInt(value) }
    return { tag: 'number', value }
  }
  if (declared === 'boolean' || typeof value === 'boolean') {
    if (typeof value !== 'boolean') throw new EvalError(`字段 ${name} 期望 boolean`)
    return { tag: 'boolean', value }
  }
  if (declared === 'text' || declared === 'enum' || declared === 'date' || declared === 'datetime') {
    if (typeof value !== 'string') throw new EvalError(`字段 ${name} 期望字符串`)
    return { tag: 'string', value }
  }
  if (typeof value === 'boolean') return { tag: 'boolean', value }
  if (typeof value === 'string') {
    if (/^-?\d+$/.test(value)) return { tag: 'int', value: BigInt(value) }
    if (/^-?\d+\.\d+$/.test(value)) {
      return { tag: 'decimal', value: parseFixed(value, value.split('.')[1].length) }
    }
    return { tag: 'string', value }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value)) return { tag: 'int', value: BigInt(value) }
    return { tag: 'number', value }
  }
  if (typeof value === 'bigint') return { tag: 'int', value }
  throw new EvalError(`字段 ${name} 的值无法参与求值`)
}

export function parseDecimalInput(value: unknown, scale: number, label = 'decimal'): FixedDecimal {
  if (typeof value === 'string') {
    if (!/^-?\d+(\.\d+)?$/.test(value)) {
      throw new EvalError(`${label} 不是合法小数串`)
    }
    return parseFixed(value, scale)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return parseFixed(integerishDecimalText(value), scale)
  }
  throw new EvalError(`${label} 既不是小数串也不是有限 number`)
}

function integerishDecimalText(value: number): string {
  if (Number.isInteger(value)) return String(value)
  const text = String(value)
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    throw new EvalError(`number ${value} 无法无损转成十进制文本`)
  }
  return text
}

function neg(value: RuntimeValue): RuntimeValue {
  switch (value.tag) {
    case 'decimal':
      return { tag: 'decimal', value: { units: -value.value.units, scale: value.value.scale } }
    case 'int':
      return { tag: 'int', value: -value.value }
    case 'number':
      return { tag: 'number', value: -value.value }
    default:
      throw new EvalError(`不能对 ${describeValue(value)} 取负`)
  }
}

function currencyOf(value: RuntimeValue): string | undefined {
  return value.tag === 'decimal' ? value.currency : undefined
}

function assertCurrencyCompat(op: '+' | '-' | '*' | '/', left: RuntimeValue, right: RuntimeValue): void {
  if (op !== '+' && op !== '-') return
  const leftCcy = currencyOf(left)
  const rightCcy = currencyOf(right)
  if (leftCcy && rightCcy && leftCcy !== rightCcy) {
    throw new EvalError(`currency-mismatch：${leftCcy} 与 ${rightCcy} 不得相加`)
  }
}

function withCurrency(value: RuntimeValue, left: RuntimeValue, right: RuntimeValue): RuntimeValue {
  if (value.tag !== 'decimal') return value
  return { ...value, currency: currencyOf(left) ?? currencyOf(right) }
}

function evalArith(op: '+' | '-' | '*' | '/', left: RuntimeValue, right: RuntimeValue): RuntimeValue {
  assertCurrencyCompat(op, left, right)
  if (left.tag === 'number' || right.tag === 'number') {
    if (left.tag === 'decimal' || right.tag === 'decimal') {
      throw new EvalError('decimal 不能与非整数 number 混算（精度来源不明）')
    }
    const a = asJsNumber(left)
    const b = asJsNumber(right)
    switch (op) {
      case '+':
        return { tag: 'number', value: a + b }
      case '-':
        return { tag: 'number', value: a - b }
      case '*':
        return { tag: 'number', value: a * b }
      case '/':
        if (b === 0) throw new EvalError('除数为 0')
        return { tag: 'number', value: a / b }
    }
  }

  const leftDec = asPromotedDecimal(left)
  const rightDec = asPromotedDecimal(right)
  if (leftDec && rightDec) {
    try {
      switch (op) {
        case '+':
          return withCurrency({ tag: 'decimal', value: addAligned(leftDec, rightDec) }, left, right)
        case '-':
          return withCurrency({ tag: 'decimal', value: subAligned(leftDec, rightDec) }, left, right)
        case '*':
          return withCurrency({ tag: 'decimal', value: mul(leftDec, rightDec) }, left, right)
        case '/':
          return withCurrency({ tag: 'decimal', value: div(leftDec, rightDec) }, left, right)
      }
    } catch (error) {
      if (error instanceof MoneyError) throw new EvalError(error.message)
      throw error
    }
  }

  if (left.tag === 'int' && right.tag === 'int') {
    switch (op) {
      case '+':
        return { tag: 'int', value: left.value + right.value }
      case '-':
        return { tag: 'int', value: left.value - right.value }
      case '*':
        return { tag: 'int', value: left.value * right.value }
      case '/':
        return { tag: 'decimal', value: div(parseFixed(left.value.toString(), 0), parseFixed(right.value.toString(), 0)) }
    }
  }

  throw new EvalError(`不能对 ${describeValue(left)} 与 ${describeValue(right)} 做 ${op}`)
}

function asPromotedDecimal(value: RuntimeValue): FixedDecimal | null {
  if (value.tag === 'decimal') return value.value
  if (value.tag === 'int') return parseFixed(value.value.toString(), 0)
  return null
}

function asJsNumber(value: RuntimeValue): number {
  if (value.tag === 'number') return value.value
  if (value.tag === 'int') return Number(value.value)
  throw new EvalError(`无法把 ${describeValue(value)} 当成 JS number`)
}

function evalCmp(op: string, left: RuntimeValue, right: RuntimeValue): boolean {
  if (left.tag === 'string' || right.tag === 'string') {
    if (left.tag !== 'string' || right.tag !== 'string') {
      throw new EvalError('字符串只能与字符串比较')
    }
    if (op === '==') return left.value === right.value
    if (op === '!=') return left.value !== right.value
    throw new EvalError(`字符串不支持比较运算符 ${op}`)
  }
  if (left.tag === 'boolean' || right.tag === 'boolean') {
    if (left.tag !== 'boolean' || right.tag !== 'boolean') {
      throw new EvalError('布尔只能与布尔比较')
    }
    if (op === '==') return left.value === right.value
    if (op === '!=') return left.value !== right.value
    throw new EvalError(`布尔不支持比较运算符 ${op}`)
  }

  if (left.tag === 'number' || right.tag === 'number') {
    if (left.tag === 'decimal' || right.tag === 'decimal') {
      const other = left.tag === 'decimal' ? right : left
      if (other.tag === 'int' || (other.tag === 'number' && Number.isInteger(other.value))) {
        // 整数 number 可提升；非整数 number 与 decimal 混比拒
      } else {
        throw new EvalError('decimal 不能与非整数 number 比较（精度来源不明）')
      }
      const leftDec = asPromotedDecimal(left)
      const rightDec = asPromotedDecimal(right)
      if (leftDec && rightDec) return cmpFixed(op, leftDec, rightDec)
    }
    return cmpJs(op, asJsNumber(left), asJsNumber(right))
  }

  const leftDec = asPromotedDecimal(left)
  const rightDec = asPromotedDecimal(right)
  if (leftDec && rightDec) return cmpFixed(op, leftDec, rightDec)

  throw new EvalError(`不能比较 ${describeValue(left)} 与 ${describeValue(right)}`)
}

function cmpFixed(op: string, left: FixedDecimal, right: FixedDecimal): boolean {
  const rel = compare(left, right)
  switch (op) {
    case '>':
      return rel > 0
    case '>=':
      return rel >= 0
    case '<':
      return rel < 0
    case '<=':
      return rel <= 0
    case '==':
      return rel === 0
    case '!=':
      return rel !== 0
    default:
      throw new EvalError(`未知比较运算符 ${op}`)
  }
}

function cmpJs(op: string, left: number, right: number): boolean {
  switch (op) {
    case '>':
      return left > right
    case '>=':
      return left >= right
    case '<':
      return left < right
    case '<=':
      return left <= right
    case '==':
      return left === right
    case '!=':
      return left !== right
    default:
      throw new EvalError(`未知比较运算符 ${op}`)
  }
}

function describeValue(value: RuntimeValue): string {
  switch (value.tag) {
    case 'decimal':
      return `decimal(${formatFixed(value.value)})`
    case 'int':
      return `int(${value.value.toString()})`
    case 'number':
      return `number(${value.value})`
    case 'string':
      return `string(${value.value})`
    case 'boolean':
      return `boolean(${value.value})`
  }
}
