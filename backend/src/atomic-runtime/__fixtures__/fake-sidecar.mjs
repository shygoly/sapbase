#!/usr/bin/env node
/**
 * 协议级假 sidecar：用于客户端单测（不依赖 Rust 二进制与真 Wasm）。
 *
 * 用 FAKE_SIDECAR_MODE 切换行为，覆盖客户端的每条失败路径：
 *   ok（默认）| mismatch | badload | slowcall | crashonload | crashoncall
 * 输出与真 sidecar 逐字段一致（t/id/code/...），因此客户端无需为测试开洞。
 */
import { createInterface } from 'node:readline'

const mode = process.env.FAKE_SIDECAR_MODE ?? 'ok'
const out = (message) => process.stdout.write(`${JSON.stringify(message)}\n`)

createInterface({ input: process.stdin }).on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let request
  try {
    request = JSON.parse(trimmed)
  } catch {
    out({ t: 'error', id: 0, code: 'BAD_REQUEST', message: 'bad json' })
    return
  }

  switch (request.t) {
    case 'hello':
      if (mode === 'mismatch') {
        out({ t: 'error', id: 0, code: 'PROTOCOL_MISMATCH', message: '宿主协议 1 ≠ sidecar 协议 99' })
        return
      }
      out({ t: 'ready', protocol: 1, engine: 'wasmtime', wasmtime: 'fake-0.0.1' })
      return
    case 'ping':
      out({ t: 'pong', id: request.id })
      return
    case 'load':
      if (mode === 'crashonload') process.exit(7)
      if (mode === 'badload') {
        out({ t: 'error', id: request.id, code: 'BAD_MODULE', message: '不是合法模块' })
        return
      }
      out({ t: 'ok', id: request.id, cached: Boolean(globalThis.__loaded) })
      globalThis.__loaded = true
      return
    case 'call':
      if (mode === 'crashoncall') process.exit(9)
      if (mode === 'slowcall') return
      out({
        t: 'result',
        id: request.id,
        rc: 0,
        out: Buffer.from(Int32Array.from([1, 2, 3]).buffer).toString('base64'),
        fuel_used: 42,
      })
      return
    default:
      out({ t: 'error', id: request.id ?? 0, code: 'BAD_REQUEST', message: `unknown ${request.t}` })
  }
})
