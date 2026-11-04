import { Logger, type OnModuleDestroy } from '@nestjs/common'
import {
  type EngineCall,
  type EngineResult,
  type WasmEngine,
  WasmEngineFailure,
  WasmExecutionTimeout,
} from './wasm-engine'

/**
 * 属于**引擎自身**的故障码 —— 只有这些才允许触发回退。
 *
 * 为什么模块级故障不在其中：`FUEL_EXHAUSTED` / `EPOCH_TIMEOUT` / `TRAP` / `BAD_MODULE`
 * 说明**这份模块**有问题（超预算、陷阱、非法），换引擎等于把"这份代码不该跑"降级成
 * "换台机器跑" —— 那是元语不变量 4 明确禁止的静默降级。
 */
export const ENGINE_LEVEL_CODES = new Set([
  'PROTOCOL_MISMATCH',
  'BAD_PROTOCOL',
  'ENGINE_EXIT',
  'FUEL_UNSUPPORTED',
])

export function isEngineLevelFailure(error: unknown): boolean {
  return (
    error instanceof WasmEngineFailure && ENGINE_LEVEL_CODES.has(error.code)
  )
}

/**
 * 引擎回退装饰器。
 *
 * 默认**不启用**：只有显式配置 `ATOMIC_ENGINE_FALLBACK` 时才会被装配进来。
 * 启用后的语义：
 *   · 仅当主引擎出现**引擎级**故障时切换，且切换是**粘性**的（本进程内不再回主引擎）
 *   · 回退后该次调用立即用回退引擎重试一次，结果标 `engineFallback: true`
 *   · 每次回退都记 WARN；审计里带 `engineFallback` 字段（"留痕"是这条路径存在的条件）
 *   · 超时**不**触发回退：超时可能是模块死循环所致，换引擎会掩盖真实原因
 */
export class FallbackEngine implements WasmEngine, OnModuleDestroy {
  private readonly logger = new Logger(FallbackEngine.name)
  private active: WasmEngine
  private fellBack = false

  constructor(
    private readonly primary: WasmEngine,
    private readonly fallback: WasmEngine,
  ) {
    this.active = primary
  }

  name(): string {
    return this.active.name()
  }

  /** 是否已经切到回退引擎（供审计与诊断）。 */
  isFallbackActive(): boolean {
    return this.fellBack
  }

  async run(call: EngineCall): Promise<EngineResult> {
    if (this.fellBack) return this.active.run(call)

    try {
      return await this.primary.run(call)
    } catch (error) {
      if (error instanceof WasmExecutionTimeout || !isEngineLevelFailure(error)) {
        throw error
      }
      this.fellBack = true
      this.active = this.fallback
      this.logger.warn(
        `主引擎不可用（${(error as WasmEngineFailure).code}），已回退到 ${this.fallback.name()}；` +
          `该次调用将在审计中标记 engineFallback`,
      )
      await this.primary.close().catch(() => undefined)
      const result = await this.fallback.run(call)
      return { ...result, engineFallback: true }
    }
  }

  async close(): Promise<void> {
    await Promise.all([
      this.primary.close().catch(() => undefined),
      this.fallback.close().catch(() => undefined),
    ])
  }

  async onModuleDestroy(): Promise<void> {
    await this.close()
  }
}
