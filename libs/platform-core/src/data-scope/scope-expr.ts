import type { ScopeExpr, ScopeFieldRef, ScopeSourceRef, ScopeValue } from './data-scope.types'

export const ALL: ScopeExpr = { op: 'all' }
export const NONE: ScopeExpr = { op: 'none' }

export function eq(field: ScopeFieldRef, value: ScopeValue): ScopeExpr {
  return { op: 'eq', field, value }
}

export function inList(field: ScopeFieldRef, values: readonly ScopeValue[]): ScopeExpr {
  if (values.length === 0) return NONE
  return { op: 'in', field, values: [...values] }
}

export function exists(source: ScopeSourceRef, where: ScopeExpr): ScopeExpr {
  return { op: 'exists', source, where }
}

export function and(...args: readonly ScopeExpr[]): ScopeExpr {
  const flat: ScopeExpr[] = []
  for (const arg of args) {
    if (arg.op === 'all') continue
    if (arg.op === 'none') return NONE
    if (arg.op === 'and') flat.push(...arg.args)
    else flat.push(arg)
  }
  if (flat.length === 0) return ALL
  if (flat.length === 1) return flat[0]
  return { op: 'and', args: flat }
}

export function or(...args: readonly ScopeExpr[]): ScopeExpr {
  const flat: ScopeExpr[] = []
  for (const arg of args) {
    if (arg.op === 'none') continue
    if (arg.op === 'all') return ALL
    if (arg.op === 'or') flat.push(...arg.args)
    else flat.push(arg)
  }
  if (flat.length === 0) return NONE
  if (flat.length === 1) return flat[0]
  return { op: 'or', args: flat }
}

export function not(arg: ScopeExpr): ScopeExpr {
  if (arg.op === 'all') return NONE
  if (arg.op === 'none') return ALL
  if (arg.op === 'not') return arg.arg
  return { op: 'not', arg }
}
