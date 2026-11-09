import type { ScopeExpr, ScopeFieldRef, ScopeValue } from './data-scope.types'

export interface CompileScopeOptions {
  /** 当前资源行的 SQL 别名 */
  alias: string
  /** 当前资源行别名（用于 exists 内部的 row 引用） */
  rowAlias?: string
  organizationId: string
  /** 已有 SQL 参数个数；编译出的占位符从 offset+1 开始 */
  paramOffset?: number
  /** blueprint_records 表名，默认 public.blueprint_records */
  blueprintTable?: string
}

export interface CompiledScope {
  sql: string
  params: unknown[]
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

function ident(value: string, label: string): string {
  if (!IDENT.test(value)) {
    throw new Error(`非法 SQL 标识符（${label}）：${value}`)
  }
  return `"${value}"`
}

function quoteAlias(alias: string): string {
  return ident(alias, 'alias')
}

function valueRef(
  value: ScopeValue,
  options: CompileScopeOptions & { actorId: string },
  alias: string,
  params: unknown[],
): string {
  if (value.kind === 'literal') {
    if (value.value === null) return 'NULL'
    params.push(value.value)
    return `$${params.length + (options.paramOffset ?? 0)}`
  }
  if (value.kind === 'actor') {
    params.push(options.actorId)
    return `$${params.length + (options.paramOffset ?? 0)}`
  }
  // row
  const rowAlias = options.rowAlias ?? alias
  return `${quoteAlias(rowAlias)}.${ident(value.field, 'row field')}`
}

export function compileScopeExpr(
  expr: ScopeExpr,
  options: CompileScopeOptions & { actorId: string },
): CompiledScope {
  const params: unknown[] = []
  const opts = { ...options, rowAlias: options.rowAlias ?? options.alias }
  const sql = compile(expr, opts, opts.alias, params, 0)
  return { sql, params }
}

function compile(
  expr: ScopeExpr,
  options: CompileScopeOptions & { actorId: string },
  alias: string,
  params: unknown[],
  depth: number,
): string {
  switch (expr.op) {
    case 'all':
      return '1=1'
    case 'none':
      return '1=0'
    case 'eq': {
      const left = renderField(expr.field, alias)
      const value = valueRef(expr.value, options, alias, params)
      if (value === 'NULL') return `${left} IS NULL`
      return `${left} = ${value}`
    }
    case 'in': {
      const left = renderField(expr.field, alias)
      if (expr.values.length === 0) return '1=0'
      const values = expr.values.map((value) => valueRef(value, options, alias, params))
      return `${left} IN (${values.join(', ')})`
    }
    case 'exists': {
      if (depth > 4) throw new Error('ScopeExpr exists 嵌套过深')
      const existsAlias = `ds_exists_${depth + 1}`
      const sourceTable =
        expr.source.kind === 'entity'
          ? identTable(options.blueprintTable ?? 'public.blueprint_records')
          : identTable(expr.source.name)
      const whereParts: string[] = []
      if (expr.source.kind === 'entity') {
        params.push(expr.source.name)
        whereParts.push(`${quoteAlias(existsAlias)}.entity = $${params.length + (options.paramOffset ?? 0)}`)
        params.push(options.organizationId)
        whereParts.push(
          `${quoteAlias(existsAlias)}."organizationId" = $${params.length + (options.paramOffset ?? 0)}`,
        )
      }
      const inner = compile(expr.where, options, existsAlias, params, depth + 1)
      whereParts.push(inner)
      return `EXISTS (SELECT 1 FROM ${sourceTable} ${quoteAlias(existsAlias)} WHERE ${whereParts.join(' AND ')})`
    }
    case 'and': {
      const parts = expr.args
        .map((arg) => compile(arg, options, alias, params, depth))
        .filter((part) => part !== '1=1')
      if (parts.length === 0) return '1=1'
      if (parts.length === 1) return parts[0]
      return `(${parts.join(' AND ')})`
    }
    case 'or': {
      const parts = expr.args
        .map((arg) => compile(arg, options, alias, params, depth))
        .filter((part) => part !== '1=0')
      if (parts.length === 0) return '1=0'
      if (parts.length === 1) return parts[0]
      return `(${parts.join(' OR ')})`
    }
    case 'not':
      return `NOT (${compile(expr.arg, options, alias, params, depth)})`
  }
}

function renderField(field: ScopeFieldRef, alias: string): string {
  const table = quoteAlias(field.table ?? alias)
  if (field.kind === 'column') {
    return `${table}.${ident(field.column, 'column')}`
  }
  const segments = field.path.split('.')
  let sql = `${table}.${ident(field.column, 'jsonb column')}`
  for (const segment of segments) {
    const key = segment
    if (!IDENT.test(key)) throw new Error(`非法 JSONB 路径：${field.path}`)
    sql += `->>'${key}'`
  }
  return sql
}

function identTable(name: string): string {
  if (name.includes('.')) {
    const [schema, table] = name.split('.')
    return `${ident(schema, 'schema')}.${ident(table, 'table')}`
  }
  return ident(name, 'table')
}
