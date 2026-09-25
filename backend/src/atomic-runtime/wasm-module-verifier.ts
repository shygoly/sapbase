import { Injectable } from '@nestjs/common'
import { staticGate } from '@speckit/wasm-modules'
import { AtomicRuntimeError } from './atomic-runtime.error'
import { WasmModuleLoader } from './wasm-module-loader'

/** 闸 1 报告（结构见 wasm-modules 的 StaticGateReport）。 */
export interface GateReport {
  byteLength: number
  exports: string[]
  checks: string[]
}

/**
 * 执行前校验：**先验哈希，再过闸 1**，结论按哈希缓存。
 *
 * 与导入侧复用同一份 `staticGate`（元语不变量 12：一份判定逻辑只写一次）。
 * 通过后缓存结论 —— 同一个模块在进程内只校验一次，热路径不被重复解析拖累。
 */
@Injectable()
export class WasmModuleVerifier {
  private readonly verdicts = new Map<string, GateReport>()

  verify(bytes: Uint8Array, expectedSha256: string): GateReport {
    const actual = WasmModuleLoader.hash(bytes)
    if (actual !== expectedSha256) {
      throw new AtomicRuntimeError(
        'MODULE_HASH_MISMATCH',
        `模块字节与绑定的哈希不符：实测 ${actual} ≠ 绑定 ${expectedSha256}`,
      )
    }

    const cached = this.verdicts.get(actual)
    if (cached) return cached

    try {
      const report = staticGate(bytes) as unknown as GateReport
      this.verdicts.set(actual, report)
      return report
    } catch (error) {
      throw new AtomicRuntimeError(
        'MODULE_REJECTED_BY_GATE',
        `静态闸不通过：${(error as Error).message}`,
      )
    }
  }

  clearCache(): void {
    this.verdicts.clear()
  }
}
