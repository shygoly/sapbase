/**
 * 执行引擎接缝。
 *
 * 存在的理由：引擎是要换的（V8 → Wasmtime sidecar，见
 * openspec/changes/add-wasmtime-host）。把引擎收敛到这一个接口后，
 * 契约、ABI、闸、审计、权限、REST 全都不受换引擎影响。
 */
export interface EngineCall {
  /** 缓存键：模块哈希 —— 同一模块复用引擎内的已编译模块。 */
  key: string
  bytes: Uint8Array
  /** 列优先的整数投影（i32 little-endian）。 */
  input: Int32Array
  rows: number
  inOff: number
  outOff: number
  outLength: number
  /** 墙钟兜底（引擎内部还应有自己的 fuel/epoch 约束）。 */
  timeoutMs: number
  /** 指令预算（fuel 单位）。V8 引擎忽略此项。 */
  fuel?: number
}

export interface EngineResult {
  rc: number
  out: Int32Array
  /** 实际消耗的指令数（引擎支持时返回），用于审计与预算校准。 */
  fuelUsed?: number
  /** 该次结果是否由**回退引擎**产出（显式配置回退时才可能为 true，用于留痕）。 */
  engineFallback?: boolean
}

export interface WasmEngine {
  /** 引擎标识（写进审计）：`v8` | `wasmtime`。 */
  name(): string
  run(call: EngineCall): Promise<EngineResult>
  /** 释放资源（常驻进程 / Worker）。 */
  close(): Promise<void>
}

/** 引擎侧超时：调用超过墙钟上限。 */
export class WasmExecutionTimeout extends Error {}

/**
 * 引擎侧失败。`code` 保留引擎的原始原因（如 `FUEL_EXHAUSTED` / `EPOCH_TIMEOUT` / `TRAP`），
 * 便于写进审计 —— 对外错误码表不变（见 add-wasmtime-host 的决策 5）。
 */
export class WasmEngineFailure extends Error {
  constructor(
    message: string,
    readonly code: string = 'TRAP',
  ) {
    super(message)
    this.name = 'WasmEngineFailure'
  }
}
