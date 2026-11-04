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
  | 'OUTPUT_GATE_STRUCTURE'
  | 'OUTPUT_BATCH_INCONSISTENT'
  | 'OUTPUT_ORDER_DEPENDENT'
  | 'ATOMIC_FAILED'

export class AtomicRuntimeError extends Error {
  constructor(
    readonly code: AtomicRuntimeErrorCode,
    message: string,
    /**
     * 协议级错误码（形如 `atomic.output.O2`），来自 `docs/protocols/atomic-output-audit.md`。
     *
     * 为什么要两个码：`code` 是运行时错误面（HTTP 映射、契约 `errors` 声明都对着它），
     * `protocolCode` 说的是"被哪一条**协议判据**拦下的"。闸 3 命中时必须两者都有 ——
     * 调用方要能精确判断"是闸 3 拦的、拦在哪一条"，而不是收到一句"执行失败"。
     */
    readonly protocolCode?: string,
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
  OUTPUT_GATE_STRUCTURE: 422,
  OUTPUT_BATCH_INCONSISTENT: 422,
  OUTPUT_ORDER_DEPENDENT: 422,
  ATOMIC_FAILED: 422,
}

export interface HttpErrorPayload {
  statusCode: number
  code: AtomicRuntimeErrorCode
  /** 协议级错误码（仅协议判据拦下的错误带此字段）。 */
  protocolCode?: string
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
    ...(error.protocolCode ? { protocolCode: error.protocolCode } : {}),
  }
}

/**
 * 闸 3 的判据编号 → 运行时错误码。
 *
 * 映射表只此一份：判据文本改了（新增编号），这里必须同步补一行，
 * 漏了就会在编译期报错（Record 覆盖全部编号），而不是运行期悄悄少一个码。
 */
export const OUTPUT_GATE_ERROR_CODE: Record<
  'O1' | 'O2' | 'O3' | 'O4' | 'O5',
  AtomicRuntimeErrorCode
> = {
  O1: 'OUTPUT_GATE_STRUCTURE',
  O2: 'OUTPUT_OUT_OF_RANGE',
  O3: 'OUTPUT_LIMIT_EXCEEDED',
  O4: 'OUTPUT_BATCH_INCONSISTENT',
  O5: 'OUTPUT_ORDER_DEPENDENT',
}
