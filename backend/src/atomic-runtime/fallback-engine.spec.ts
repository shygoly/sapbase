// 引擎回退：只有显式配置才启用；只对引擎级故障生效；粘性切换且留痕。
import { FallbackEngine, isEngineLevelFailure } from './fallback-engine'
import {
  type EngineCall,
  type EngineResult,
  type WasmEngine,
  WasmEngineFailure,
  WasmExecutionTimeout,
} from './wasm-engine'

class FakeEngine implements WasmEngine {
  calls = 0
  closed = false
  constructor(
    private readonly label: string,
    private readonly behavior: () => Promise<EngineResult>,
  ) {}
  name(): string {
    return this.label
  }
  async run(_call: EngineCall): Promise<EngineResult> {
    this.calls += 1
    return this.behavior()
  }
  async close(): Promise<void> {
    this.closed = true
  }
}

const CALL: EngineCall = {
  key: 'a'.repeat(64),
  bytes: new Uint8Array(8),
  input: Int32Array.from([1]),
  rows: 1,
  inOff: 0,
  outOff: 4,
  outLength: 1,
  timeoutMs: 1000,
}

const ok = (value: number): (() => Promise<EngineResult>) => async () => ({
  rc: 0,
  out: Int32Array.from([value]),
})

const failWith = (
  create: () => Error,
): (() => Promise<EngineResult>) => async () => {
  throw create()
}

describe('isEngineLevelFailure', () => {
  it.each([
    ['PROTOCOL_MISMATCH', true],
    ['ENGINE_EXIT', true],
    ['BAD_PROTOCOL', true],
    ['FUEL_UNSUPPORTED', true],
    ['FUEL_EXHAUSTED', false],
    ['EPOCH_TIMEOUT', false],
    ['TRAP', false],
    ['BAD_MODULE', false],
    ['UNKNOWN_MODULE', false],
  ])('%s → %s', (code, expected) => {
    expect(isEngineLevelFailure(new WasmEngineFailure('x', code))).toBe(expected)
  })

  it('超时不触发回退（可能是模块死循环所致）', () => {
    expect(isEngineLevelFailure(new WasmExecutionTimeout('慢'))).toBe(false)
  })
})

describe('FallbackEngine', () => {
  it('主引擎正常时不碰回退引擎', async () => {
    const primary = new FakeEngine('wasmtime', ok(7))
    const fallback = new FakeEngine('v8', ok(9))
    const engine = new FallbackEngine(primary, fallback)

    const result = await engine.run(CALL)
    expect(Array.from(result.out)).toEqual([7])
    expect(result.engineFallback).toBeUndefined()
    expect(engine.name()).toBe('wasmtime')
    expect(fallback.calls).toBe(0)
  })

  it('引擎级故障 → 回退并重试一次，结果标记 engineFallback', async () => {
    const primary = new FakeEngine(
      'wasmtime',
      failWith(() => new WasmEngineFailure('进程没了', 'ENGINE_EXIT')),
    )
    const fallback = new FakeEngine('v8', ok(9))
    const engine = new FallbackEngine(primary, fallback)

    const result = await engine.run(CALL)
    expect(Array.from(result.out)).toEqual([9])
    expect(result.engineFallback).toBe(true)
    expect(engine.isFallbackActive()).toBe(true)
    expect(engine.name()).toBe('v8')
    expect(primary.closed).toBe(true)
  })

  it('回退是粘性的：后续调用直接用回退引擎，不再打扰主引擎', async () => {
    const primary = new FakeEngine(
      'wasmtime',
      failWith(() => new WasmEngineFailure('协议不匹配', 'PROTOCOL_MISMATCH')),
    )
    const fallback = new FakeEngine('v8', ok(9))
    const engine = new FallbackEngine(primary, fallback)

    await engine.run(CALL)
    await engine.run(CALL)
    expect(primary.calls).toBe(1)
    expect(fallback.calls).toBe(2)
  })

  it.each(['FUEL_EXHAUSTED', 'EPOCH_TIMEOUT', 'TRAP'])(
    '模块级故障（%s）**不**触发回退，错误原样上抛',
    async (code) => {
      const primary = new FakeEngine(
        'wasmtime',
        failWith(() => new WasmEngineFailure('模块有问题', code)),
      )
      const fallback = new FakeEngine('v8', ok(9))
      const engine = new FallbackEngine(primary, fallback)

      await expect(engine.run(CALL)).rejects.toMatchObject({ code })
      expect(engine.isFallbackActive()).toBe(false)
      expect(fallback.calls).toBe(0)
    },
  )

  it('超时不触发回退', async () => {
    const primary = new FakeEngine(
      'wasmtime',
      failWith(() => new WasmExecutionTimeout('卡住')),
    )
    const fallback = new FakeEngine('v8', ok(9))
    const engine = new FallbackEngine(primary, fallback)

    await expect(engine.run(CALL)).rejects.toBeInstanceOf(WasmExecutionTimeout)
    expect(fallback.calls).toBe(0)
  })

  it('close 会同时关闭两个引擎', async () => {
    const primary = new FakeEngine('wasmtime', ok(1))
    const fallback = new FakeEngine('v8', ok(2))
    await new FallbackEngine(primary, fallback).close()
    expect(primary.closed).toBe(true)
    expect(fallback.closed).toBe(true)
  })
})
