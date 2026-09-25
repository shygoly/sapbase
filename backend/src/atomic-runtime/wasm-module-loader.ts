import { Inject, Injectable } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { AtomicRuntimeError } from './atomic-runtime.error'

/** 模块产物目录的注入令牌（默认取 wasm-modules/build，可用环境变量覆盖）。 */
export const ATOMIC_MODULES_DIR = Symbol('ATOMIC_MODULES_DIR')

/**
 * 按**哈希**加载模块字节。
 *
 * 文件名形如 `available-inventory-54c7674e402c.wasm`（原子类型 + 哈希前 12 位），
 * 因此定位靠哈希前缀，**校验靠全量哈希**（在 Verifier 里做，不在这里）——
 * 文件名只是索引，不是证据。
 */
@Injectable()
export class WasmModuleLoader {
  private readonly cache = new Map<string, Uint8Array>()

  constructor(@Inject(ATOMIC_MODULES_DIR) private readonly modulesDir: string) {}

  load(expectedSha256: string): Uint8Array {
    const cached = this.cache.get(expectedSha256)
    if (cached) return cached

    if (!existsSync(this.modulesDir)) {
      throw new AtomicRuntimeError(
        'MODULE_NOT_FOUND',
        `模块目录不存在：${this.modulesDir}`,
      )
    }

    const prefix = expectedSha256.slice(0, 12)
    const name = readdirSync(this.modulesDir).find(
      (f) => f.endsWith(`-${prefix}.wasm`) && !f.includes('/'),
    )
    if (!name) {
      throw new AtomicRuntimeError(
        'MODULE_NOT_FOUND',
        `模块目录里找不到哈希前缀为 ${prefix} 的产物：${this.modulesDir}`,
      )
    }

    const bytes = new Uint8Array(readFileSync(join(this.modulesDir, name)))
    this.cache.set(expectedSha256, bytes)
    return bytes
  }

  /** 该目录下所有模块（哈希前 12 位 → 文件名），供导入与排查使用。 */
  list(): Array<{ prefix: string; file: string }> {
    if (!existsSync(this.modulesDir)) return []
    return readdirSync(this.modulesDir)
      .filter((f) => f.endsWith('.wasm'))
      .map((file) => ({
        prefix: file.replace(/\.wasm$/, '').split('-').pop() as string,
        file,
      }))
  }

  /** 供测试断言：清空缓存后必须重新读盘。 */
  clearCache(): void {
    this.cache.clear()
  }

  static hash(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex')
  }
}
