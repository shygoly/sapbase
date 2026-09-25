// sidecar 客户端：握手、load 缓存、调用往返、超时杀进程、崩溃不回退、健康探针。
// 用协议级假 sidecar（__fixtures__/fake-sidecar.mjs）—— 不依赖 Rust 二进制，失败路径可控。
import { resolve } from 'node:path'
import { WasmtimeSidecarClient } from './wasmtime-sidecar.client'
import { WasmEngineFailure, WasmExecutionTimeout } from './wasm-engine'

const FAKE = resolve(__dirname, '__fixtures__/fake-sidecar.mjs')

function client(mode: string, options: { defaultFuel?: number } = {}) {
  process.env.FAKE_SIDECAR_MODE = mode
  return new WasmtimeSidecarClient(FAKE, options)
}

const call = (key = 'a'.repeat(64), timeoutMs = 2000) => ({
  key,
  bytes: new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]),
  input: Int32Array.from([1, 2, 3, 4]),
  rows: 2,
  inOff: 0,
  outOff: 16,
  outLength: 3,
  timeoutMs,
})

describe('WasmtimeSidecarClient', () => {
  afterEach(() => {
    delete process.env.FAKE_SIDECAR_MODE
  })

  it('握手成功后调用往返正确（含 fuel_used）', async () => {
    const sidecar = client('ok')
    try {
      const result = await sidecar.run(call())
      expect(result.rc).toBe(0)
      expect(Array.from(result.out)).toEqual([1, 2, 3])
      expect(result.fuelUsed).toBe(42)
      expect(sidecar.version()).toBe('fake-0.0.1')
    } finally {
      await sidecar.close()
    }
  })

  it('同一模块连续多次调用都成功（进程内缓存模块）', async () => {
    const sidecar = client('ok')
    try {
      await sidecar.run(call())
      await sidecar.run(call())
      const third = await sidecar.run(call())
      expect(third.rc).toBe(0)
    } finally {
      await sidecar.close()
    }
  })

  it('协议版本不匹配 → 拒绝启用该引擎（fail-closed，不回退）', async () => {
    const sidecar = client('mismatch')
    try {
      await expect(sidecar.run(call())).rejects.toMatchObject({
        code: 'PROTOCOL_MISMATCH',
      })
    } finally {
      await sidecar.close()
    }
  })

  it('引擎拒绝加载模块 → 保留原始原因码（供审计）', async () => {
    const sidecar = client('badload')
    try {
      await expect(sidecar.run(call())).rejects.toBeInstanceOf(WasmEngineFailure)
      await expect(sidecar.run(call())).rejects.toMatchObject({
        code: 'BAD_MODULE',
      })
    } finally {
      await sidecar.close()
    }
  })

  it('调用超时 → 杀掉卡死进程；换成正常引擎后新调用可成功', async () => {
    const stuck = client('slowcall')
    try {
      await expect(
        sidecarRun(stuck, call('b'.repeat(64), 300)),
      ).rejects.toBeInstanceOf(WasmExecutionTimeout)
    } finally {
      await stuck.close()
    }

    const recovered = client('ok')
    try {
      const result = await recovered.run(call())
      expect(result.rc).toBe(0)
    } finally {
      await recovered.close()
    }
  })

  it('加载期进程崩溃 → 在途调用失败且不回退（ENGINE_EXIT）', async () => {
    const sidecar = client('crashonload')
    try {
      await expect(sidecar.run(call())).rejects.toMatchObject({
        code: 'ENGINE_EXIT',
      })
    } finally {
      await sidecar.close()
    }
  })

  it('调用期进程崩溃 → 在途调用失败且不回退（ENGINE_EXIT）', async () => {
    const sidecar = client('crashoncall')
    try {
      await expect(sidecar.run(call())).rejects.toMatchObject({
        code: 'ENGINE_EXIT',
      })
    } finally {
      await sidecar.close()
    }
  })

  it('健康探针：握手 + ping 成功时报 ok 与引擎版本', async () => {
    const sidecar = client('ok')
    try {
      const health = await sidecar.health()
      expect(health).toMatchObject({ ok: true, version: 'fake-0.0.1' })
    } finally {
      await sidecar.close()
    }
  })

  it('健康探针：引擎不可用时返回 ok:false 而不抛错', async () => {
    const sidecar = new WasmtimeSidecarClient('/nonexistent/wasm-host')
    try {
      const health = await sidecar.health()
      expect(health.ok).toBe(false)
      expect(health.error).toBeTruthy()
    } finally {
      await sidecar.close()
    }
  })
})

/** 便于对"卡死的引擎"设更短的调用超时（与正常调用区分）。 */
function sidecarRun(
  sidecar: WasmtimeSidecarClient,
  input: ReturnType<typeof call>,
) {
  return sidecar.run(input)
}
