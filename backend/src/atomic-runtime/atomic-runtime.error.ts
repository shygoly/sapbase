/**
 * 运行时错误码 —— 契约里声明的错误面（见 atomic-contract.schema.json 的 `errors`）。
 *
 * 为什么要有独立错误类型：M4 的控制器要把它们映射成 HTTP 状态码，
 * 而**绝不能**把失败悄悄变成"回退到内置实现"（元语不变量 4）。
 */
export type AtomicRuntimeErrorCode =
  | 'MODULE_NOT_FOUND'
  | 'MODULE_HASH_MISMATCH'
  | 'MODULE_REJECTED_BY_GATE'
  | 'MODULE_REVOKED'
  | 'UNSUPPORTED_IMPLEMENTATION'
  | 'INVALID_INPUT'
  | 'PERMISSION_DENIED'
  | 'EXECUTION_TIMEOUT'
  | 'OUTPUT_LIMIT_EXCEEDED'
  | 'OUTPUT_OUT_OF_RANGE'
  | 'ATOMIC_FAILED'

export class AtomicRuntimeError extends Error {
  constructor(
    readonly code: AtomicRuntimeErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AtomicRuntimeError'
  }
}

/** 错误码 → HTTP 状态码。控制器必须走这里，不自行映射、不吞错。 */
const HTTP_STATUS_BY_CODE: Record<AtomicRuntimeErrorCode, number> = {
  MODULE_NOT_FOUND: 404,
  MODULE_HASH_MISMATCH: 422,
  MODULE_REJECTED_BY_GATE: 422,
  MODULE_REVOKED: 422,
  UNSUPPORTED_IMPLEMENTATION: 501,
  INVALID_INPUT: 400,
  PERMISSION_DENIED: 403,
  EXECUTION_TIMEOUT: 504,
  OUTPUT_LIMIT_EXCEEDED: 422,
  OUTPUT_OUT_OF_RANGE: 422,
  ATOMIC_FAILED: 422,
}

export interface HttpErrorPayload {
  statusCode: number
  code: AtomicRuntimeErrorCode
  message: string
}

/**
 * 把运行时错误映射成 HTTP 载荷。
 *
 * 三个语义组：404 找不到；400/504 调用方或环境问题；**422 = 模块本身不可信 / 不可用**
 * （哈希不符、闸不过、已吊销、输出越界、原子返回非 0）。
 * 无论哪一组，都**不会**变成"回退到内置实现后返回 200"。
 */
export function toHttpError(error: AtomicRuntimeError): HttpErrorPayload {
  return {
    statusCode: HTTP_STATUS_BY_CODE[error.code],
    code: error.code,
    message: error.message,
  }
}
