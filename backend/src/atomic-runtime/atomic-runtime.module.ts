import { Logger, Module } from '@nestjs/common'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { AtomicRegistryModule } from '../atomic-registry/atomic-registry.module'
import { AtomicRegistryService } from '../atomic-registry/atomic-registry.service'
import { AtomicExecutor } from './atomic-executor.service'
import { AtomicRuntimeController } from './atomic-runtime.controller'
import { type WasmEngine } from './wasm-engine'
import { ATOMIC_MODULES_DIR, WasmModuleLoader } from './wasm-module-loader'
import { WasmModuleVerifier } from './wasm-module-verifier'
import { WasmInstancePool } from './wasm-instance-pool'
import { WasmtimeSidecarClient } from './wasmtime-sidecar.client'
import { FallbackEngine } from './fallback-engine'

import {
  REVOCATION_LIST_PATH,
  RevocationListService,
} from './revocation-list.service'

/** 引擎注入令牌。 */
export const WASM_ENGINE = Symbol('WASM_ENGINE')

/** 模块产物目录：默认仓库根的 `wasm-modules/build`，可用 `ATOMIC_MODULES_DIR` 覆盖。 */
const modulesDir =
  process.env.ATOMIC_MODULES_DIR ?? resolve(__dirname, '../../../wasm-modules/build')

/** 吊销名单文件：默认与模块产物同目录，可用 `ATOMIC_REVOCATION_LIST` 覆盖。 */
const revocationListPath =
  process.env.ATOMIC_REVOCATION_LIST ??
  resolve(__dirname, '../../../wasm-modules/build/revocations.json')

/**
 * 引擎选择：`ATOMIC_ENGINE=v8`（默认）或 `wasmtime`。
 *
 * 迁移期默认仍是 v8 —— 提案本身不改变现状（见 add-wasmtime-host 的决策）。
 * 引擎不可用时报错而不是静默换引擎；只有显式 `ATOMIC_ENGINE_FALLBACK` 才允许回退。
 */
function buildEngine(): WasmEngine {
  // 默认引擎：wasmtime（S6 翻转）。工程上必须先把二进制构建出来 —— 缺失时
  // 不静默回退，而是在启动日志与调用错误里给出可诊断信息。
  const kind = (process.env.ATOMIC_ENGINE ?? 'wasmtime').trim().toLowerCase()
  if (kind === 'wasmtime') {
    const binary =
      process.env.ATOMIC_ENGINE_BINARY ??
      resolve(__dirname, '../../../crates/wasm-host/target/release/wasm-host')
    if (!existsSync(binary)) {
      // 启动即提示（不阻断进程）：原子接口会在调用时给出可诊断的错误
      new Logger('AtomicRuntime').error(
        `ATOMIC_ENGINE=wasmtime 但引擎二进制不存在：${binary}` +
          `（构建：cargo build --release -p wasm-host）`,
      )
    }
    const primary = new WasmtimeSidecarClient(binary, {
      defaultFuel: Number(process.env.ATOMIC_DEFAULT_FUEL ?? 1_000_000),
    })
    // 回退必须显式开启；开启后仅对**引擎级**故障生效，且审计留 engineFallback
    const fallbackKind = (process.env.ATOMIC_ENGINE_FALLBACK ?? '')
      .trim()
      .toLowerCase()
    if (fallbackKind === 'v8') {
      return new FallbackEngine(primary, new WasmInstancePool())
    }
    return primary
  }
  return new WasmInstancePool()
}

@Module({
  imports: [AtomicRegistryModule, AuditLogsModule],
  controllers: [AtomicRuntimeController],
  providers: [
    { provide: ATOMIC_MODULES_DIR, useValue: modulesDir },
    { provide: REVOCATION_LIST_PATH, useValue: revocationListPath },
    WasmModuleLoader,
    WasmModuleVerifier,
    WasmInstancePool,
    { provide: WASM_ENGINE, useFactory: buildEngine },
    RevocationListService,
    {
      provide: AtomicExecutor,
      useFactory: (
        registry: AtomicRegistryService,
        loader: WasmModuleLoader,
        verifier: WasmModuleVerifier,
        engine: WasmEngine,
      ) => new AtomicExecutor(registry, loader, verifier, engine),
      inject: [AtomicRegistryService, WasmModuleLoader, WasmModuleVerifier, WASM_ENGINE],
    },
  ],
  exports: [AtomicExecutor, RevocationListService],
})
export class AtomicRuntimeModule {}
