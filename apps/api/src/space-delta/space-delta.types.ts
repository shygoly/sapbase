export type SpaceDeltaProtocol = 'space-delta/v2'
export type SpaceDeltaOperationKind =
  | 'add'
  | 'update'
  | 'remove'
  | 'replace'
  | 'link'
  | 'unlink'
  | 'reorder'

export interface SpaceDeltaOperation {
  op: SpaceDeltaOperationKind
  /** 只允许声明层路径；最终结构/manifest/IR/source 等不可直接写。 */
  path: string
  value?: unknown
  from?: string
  to?: string
  type?: string
}

export interface SpaceDelta {
  protocol: SpaceDeltaProtocol
  baseVersion: string
  operations: SpaceDeltaOperation[]
}

export type SpaceDeltaSecurityLevel = 'L1' | 'L2' | 'L3'

export interface SpaceDeltaValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
  securityLevel: SpaceDeltaSecurityLevel
}

export interface SpaceDeltaConflict {
  code:
    | 'base-version-mismatch'
    | 'duplicate-add'
    | 'remove-vs-mutate'
    | 'link-vs-unlink'
    | 'duplicate-operation'
  path: string
  operations: number[]
  message: string
}

export interface BoundedRepairResult {
  ok: boolean
  delta?: SpaceDelta
  errors: string[]
  attempts: number
  history: Array<{ attempt: number; errors: string[] }>
}
