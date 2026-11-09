import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm'
import { compileScopeExpr, type CompileScopeOptions } from './scope-sql-compiler'
import type { ScopeExpr } from './data-scope.types'

export interface ApplyScopeOptions extends CompileScopeOptions {
  actorId: string
}

/**
 * 把 ScopeExpr 应用到 TypeORM QueryBuilder。
 * 调用方负责 alias 与实际表/列匹配；all 不加条件，none 直接 1=0。
 */
export function applyScopeToQueryBuilder<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  expr: ScopeExpr,
  options: ApplyScopeOptions,
): SelectQueryBuilder<T> {
  if (expr.op === 'all') return qb
  if (expr.op === 'none') return qb.andWhere('1=0')
  const compiled = compileScopeExpr(expr, options)
  return qb.andWhere(compiled.sql, compiled.params)
}
