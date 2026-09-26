/**
 * 插件宿主进程 —— **子进程侧**。
 *
 * 这是插件唯一能呼吸的地方。它跑在 `node --permission` 下（见 `plugin-host-process.ts`），
 * 于是 `fs` / `child_process` / `worker_threads` 三条路**在运行时被拒绝**，
 * 而不是被源码正则"看着像有风险"。
 *
 * 协议：行分隔 JSON（与 `crates/wasm-host` 的 sidecar 同形态，少一套心智模型）
 *
 *   宿主 → 子进程   {"id":1,"op":"activate","payload":{"entry":"/abs/path.js"}}
 *                   {"id":2,"op":"invoke","payload":{"handler":"getX","args":[...]}}
 *                   {"kind":"capability-result","id":"c1","ok":true,"result":...}
 *   子进程 → 宿主   {"id":1,"ok":true,"result":{...}}
 *                   {"kind":"capability","id":"c1","capability":"database.read","args":{...}}
 *
 * `capability` 是插件向宿主**请求能力**的唯一出口：宿主按清单逐项校验，缺声明即拒
 * （见 `docs/protocols/plugin-sandbox.md` §2）。子进程自己不判断权限 —— 判定权在平台。
 *
 * 写法约束：本文件必须只含**可擦除的 TS 语法**（无 enum / 无参数属性 / 无 namespace），
 * 因为宿主是直接 `node <本文件>` 启动它的（Node 的类型剥离），不经编译。
 */
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline'

type HostRequest = {
  id: number
  op: 'activate' | 'invoke' | 'deactivate' | 'ping'
  payload?: Record<string, unknown>
}

type CapabilityReply = {
  kind: 'capability-result'
  id: string
  ok: boolean
  result?: unknown
  error?: string
}

let plugin: Record<string, unknown> = {}
let nextCapabilityId = 0
const pendingCapabilities = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>()

/** 与宿主通话：一行一条 JSON，不缓冲、不带额外字段。 */
function send(message: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(message) + '\n')
}

/**
 * 插件拿到的"宿主能力"出口。
 *
 * 注意它**不是**一个宽松的 RPC：插件能请求什么由宿主按清单决定；子进程只负责转发。
 * 名字叫 `callHost` 而不是 `hostApi`，是为了让插件作者一眼看出"这一步会过闸"。
 */
function callHost(capability: string, args: Record<string, unknown>): Promise<unknown> {
  const id = `c${++nextCapabilityId}`
  return new Promise((resolve, reject) => {
    pendingCapabilities.set(id, { resolve, reject })
    send({ kind: 'capability', id, capability, args })
  })
}

/** 插件可见的上下文：目前只有"请求能力"这一件事，其余能力都从它长出来。 */
function buildContext(pluginName: string) {
  return {
    pluginName,
    /** 读业务数据 —— 宿主会校验 manifest 的 database.tables / operations */
    query: (table: string, filter?: Record<string, unknown>) =>
      callHost('database.read', { table, filter }),
    /** 写业务数据 */
    mutate: (table: string, values: Record<string, unknown>) =>
      callHost('database.write', { table, values }),
    /** 调宿主端点 —— 宿主会校验 api.endpoints / methods */
    callApi: (path: string, method = 'GET', body?: unknown) =>
      callHost('api.call', { path, method, body }),
    /** 扩展模块 —— 宿主会校验 modules.extend */
    extendModule: (name: string) => callHost('modules.extend', { name }),
    /** 记一条日志（审计仍由宿主写，这里只是让插件能留下自己的话） */
    log: (message: string) => callHost('log.write', { message }),
  }
}

async function handle(request: HostRequest): Promise<void> {
  try {
    if (request.op === 'ping') {
      send({ id: request.id, ok: true, result: { pong: true, pid: process.pid } })
      return
    }

    if (request.op === 'activate') {
      const entry = String(request.payload?.entry ?? '')
      const pluginName = String(request.payload?.pluginName ?? 'unknown')
      // 动态导入：只允许读插件目录（--allow-fs-read），越界读会被 Node 拒绝
      const loaded = (await import(pathToFileURL(entry).href)) as Record<string, unknown>
      plugin = (loaded.default ?? loaded) as Record<string, unknown>
      const initialize = plugin.initialize
      if (typeof initialize === 'function') {
        await (initialize as (context: unknown) => unknown)(buildContext(pluginName))
      }
      send({
        id: request.id,
        ok: true,
        result: { exports: Object.keys(plugin).sort() },
      })
      return
    }

    if (request.op === 'invoke') {
      const handler = String(request.payload?.handler ?? '')
      const args = (request.payload?.args as unknown[] | undefined) ?? []
      const fn = plugin[handler]
      if (typeof fn !== 'function') {
        send({
          id: request.id,
          ok: false,
          error: { message: `插件未导出可调用的 ${handler}`, code: 'NO_SUCH_HANDLER' },
        })
        return
      }
      const result = await (fn as (...a: unknown[]) => unknown)(...args)
      send({ id: request.id, ok: true, result })
      return
    }

    if (request.op === 'deactivate') {
      const cleanup = plugin.cleanup
      if (typeof cleanup === 'function') await (cleanup as () => unknown)()
      plugin = {}
      send({ id: request.id, ok: true, result: {} })
      return
    }

    send({ id: request.id, ok: false, error: { message: `未知操作 ${request.op}` } })
  } catch (error) {
    const err = error as Error & { code?: string }
    send({
      id: request.id,
      ok: false,
      // 把 Node 的拒绝码（ERR_ACCESS_DENIED 等）原样带回去 —— 边界被触发时要留痕，
      // 不能让插件把越权失败伪装成普通异常
      error: { message: err.message, code: err.code ?? 'PLUGIN_ERROR' },
    })
  }
}

function main(): void {
  const lines = createInterface({ input: process.stdin })
  lines.on('line', (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let parsed: HostRequest | CapabilityReply
    try {
      parsed = JSON.parse(trimmed) as HostRequest | CapabilityReply
    } catch {
      send({ id: -1, ok: false, error: { message: '协议错误：不是合法 JSON' } })
      return
    }

    if ((parsed as CapabilityReply).kind === 'capability-result') {
      const reply = parsed as CapabilityReply
      const pending = pendingCapabilities.get(reply.id)
      if (pending) {
        pendingCapabilities.delete(reply.id)
        if (reply.ok) pending.resolve(reply.result)
        else pending.reject(new Error(reply.error ?? '能力请求被宿主拒绝'))
      }
      return
    }

    void handle(parsed as HostRequest)
  })
}

main()
