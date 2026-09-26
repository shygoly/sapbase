/**
 * 插件宿主进程 —— **宿主侧**。
 *
 * 职责有三（判据文本见 `docs/protocols/plugin-sandbox.md` §1）：
 *   1. **探测**运行时权限模型是否可用；不可用即拒（fail-closed，绝不退回同进程 require）
 *   2. 用 `node --permission --allow-fs-read=<插件目录>` 启动子进程，走行分隔 JSON 协议
 *   3. 能力请求中转：插件请求宿主能力时，先把请求交给**判定者**（清单声明 all-of），
 *      通过才代为执行 —— 子进程自己不判权限（判定权在平台）
 *
 * 与 `crates/wasm-host` 的 sidecar 客户端同构：一插件一进程、超时终止、崩溃后不静默降级。
 */
import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline'

export interface PluginHostOptions {
  /** 插件目录（唯一被允许读取的路径）。 */
  pluginDir: string
  /** 插件入口（相对 pluginDir 的路径，来自清单 entry.backend）。 */
  entry: string
  pluginName: string
  /** 单次请求超时（毫秒）。 */
  timeoutMs?: number
  /** Node 二进制（默认 process.execPath）。可注入是为了让"运行时不支持权限模型"这条路径可测。 */
  nodeBinary?: string
  /** 能力判定者：返回 null 表示允许，返回字符串表示拒绝原因。 */
  authorize?: (capability: string, args: Record<string, unknown>) => string | null
  /** 能力执行者：authorize 通过后真正去做（查库 / 调端点 / 扩展模块）。 */
  executeCapability?: (capability: string, args: Record<string, unknown>) => Promise<unknown>
  /** 命中审计出口（能力请求 / 越权 / 进程事件）。 */
  onAudit?: (event: {
    action: string
    capability?: string
    allowed?: boolean
    reason?: string
    status?: 'success' | 'failure'
  }) => void | Promise<void>
}

export interface HostInvokeResult {
  ok: boolean
  result?: unknown
  error?: { message: string; code?: string }
}

export class PluginHostError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'PERMISSION_MODEL_UNAVAILABLE'
      | 'HOST_ENTRY_MISSING'
      | 'PLUGIN_DIR_MISSING'
      | 'SPAWN_FAILED'
      | 'TIMEOUT'
      | 'PROTOCOL_ERROR'
      | 'NOT_STARTED'
      | 'EXITED',
  ) {
    super(message)
    this.name = 'PluginHostError'
  }
}

/**
 * 宿主入口脚本的位置。
 *
 * 两种运行形态：ts-jest / ts-node 下是 `.ts`（Node 的类型剥离能直接跑），
 * `nest build` 之后是 `.js`。按存在性挑，不写死后缀。
 */
export function hostEntryPath(baseDir: string = __dirname): string {
  for (const candidate of ['plugin-host-entry.js', 'plugin-host-entry.ts']) {
    const path = resolve(baseDir, candidate)
    if (existsSync(path)) return path
  }
  throw new PluginHostError(
    `找不到插件宿主入口（${baseDir}/plugin-host-entry.{js,ts}）`,
    'HOST_ENTRY_MISSING',
  )
}

/**
 * 探测当前 Node 是否支持权限模型（`--permission`）。
 *
 * 为什么必须探测而不是"try 一下"：这两个结果的含义完全不同 ——
 * 支持就是真边界；不支持就必须**拒绝加载插件**，而不是退回同进程 require
 * （那等于"没有边界"，却让人以为有）。
 */
export function isPermissionModelAvailable(nodeBinary = process.execPath): boolean {
  const probe = spawnSync(
    nodeBinary,
    ['--permission', '--allow-fs-read=/nonexistent', '-e', 'process.exit(0)'],
    { stdio: 'ignore' },
  )
  return probe.status === 0
}

const DEFAULT_TIMEOUT_MS = 5000

export class PluginHostProcess {
  private child: ChildProcessWithoutNullStreams | null = null
  private nextId = 0
  private readonly pending = new Map<number, (result: HostInvokeResult) => void>()
  private exited: string | null = null

  constructor(private readonly options: PluginHostOptions) {}

  /** 已启动且未退出。 */
  get running(): boolean {
    return this.child !== null && this.exited === null
  }

  /**
   * 启动子进程并激活插件。
   *
   * 抛错一律是 fail-closed：探测不过、入口缺失、spawn 失败都直接拒，
   * **不提供**"那就在宿主进程里 require 吧"的路径。
   */
  async start(): Promise<{ exports: string[] }> {
    if (!isPermissionModelAvailable(this.nodeBinary)) {
      throw new PluginHostError(
        `当前 Node（${process.version}）不支持 --permission，拒绝加载插件：` +
          '没有边界就不要假装有边界（不退回同进程 require）',
        'PERMISSION_MODEL_UNAVAILABLE',
      )
    }

    const entryPath = hostEntryPath()
    // 用**真实路径**放行：macOS 的 tmpdir 是符号链接（/var → /private/var），
    // 而 Node 的权限模型按解析后的真实路径判 —— 只给符号链接路径会处处 ERR_ACCESS_DENIED。
    // 一条目录路径即可覆盖其下所有文件（含子目录），无需通配。
    if (!existsSync(this.options.pluginDir)) {
      throw new PluginHostError(
        `插件目录不存在：${this.options.pluginDir}`,
        'PLUGIN_DIR_MISSING',
      )
    }
    const pluginDir = realpathSync(this.options.pluginDir)
    const entryFile = resolve(pluginDir, this.options.entry)
    try {
      this.child = spawn(
        this.nodeBinary,
        [
          '--permission',
          // 只允许读插件目录：插件自己的代码与资源够用，越界读会被 Node 拒绝
          `--allow-fs-read=${pluginDir}`,
          entryPath,
        ],
        { stdio: ['pipe', 'pipe', 'pipe'] },
      )
    } catch (error) {
      throw new PluginHostError(
        `启动插件子进程失败：${(error as Error).message}`,
        'SPAWN_FAILED',
      )
    }

    const lines = createInterface({ input: this.child.stdout })
    lines.on('line', (line) => {
      void this.onLine(line)
    })
    this.child.on('exit', (code, signal) => {
      this.exited = `code=${code ?? 'null'} signal=${signal ?? 'null'}`
      for (const [, resolvePending] of this.pending) {
        resolvePending({
          ok: false,
          error: { message: `插件进程已退出（${this.exited}）`, code: 'EXITED' },
        })
      }
      this.pending.clear()
    })
    this.child.stderr.on('data', (chunk: Buffer) => {
      this.options.onAudit?.({
        action: 'plugin.host.stderr',
        reason: chunk.toString().slice(0, 500),
      })
    })

    const activated = await this.request('activate', { entry: entryFile, pluginName: this.options.pluginName })
    if (!activated.ok) {
      throw new PluginHostError(
        `插件激活失败：${activated.error?.message ?? '未知原因'}`,
        'SPAWN_FAILED',
      )
    }
    return activated.result as { exports: string[] }
  }

  /** 调用插件导出的处理函数。 */
  async invoke(handler: string, args: unknown[] = []): Promise<HostInvokeResult> {
    return this.request('invoke', { handler, args })
  }

  /** 停用并结束子进程。 */
  async stop(): Promise<void> {
    if (!this.child) return
    try {
      if (this.exited === null) await this.request('deactivate', {})
    } catch {
      // 停用失败不影响"必须结束进程"这件事
    }
    this.child.kill('SIGKILL')
    this.child = null
  }

  private request(op: string, payload: Record<string, unknown>): Promise<HostInvokeResult> {
    const child = this.child
    if (!child || this.exited !== null) {
      return Promise.resolve({
        ok: false,
        error: {
          message: this.exited ? `插件进程已退出（${this.exited}）` : '插件进程尚未启动',
          code: this.exited ? 'EXITED' : 'NOT_STARTED',
        },
      })
    }

    const id = ++this.nextId
    return new Promise<HostInvokeResult>((resolvePending) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        child.kill('SIGKILL')
        // 立刻把进程标记为不可用：我们刚 SIGKILL 了它，不能等到 exit 事件才承认
        // （否则"超时后还能继续用"这种错觉会漏到调用方）
        this.exited = 'killed-after-timeout'
        this.options.onAudit?.({ action: 'plugin.host.timeout', reason: `${op} 超时` })
        resolvePending({
          ok: false,
          error: { message: `${op} 超时（${this.timeoutMs}ms），进程已终止`, code: 'TIMEOUT' },
        })
      }, this.timeoutMs)

      this.pending.set(id, (result) => {
        clearTimeout(timer)
        resolvePending(result)
      })
      child.stdin.write(JSON.stringify({ id, op, payload }) + '\n')
    })
  }

  private get timeoutMs(): number {
    return this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  private get nodeBinary(): string {
    return this.options.nodeBinary ?? process.execPath
  }

  private async onLine(line: string): Promise<void> {
    const trimmed = line.trim()
    if (!trimmed) return
    let message: Record<string, unknown>
    try {
      message = JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      this.options.onAudit?.({ action: 'plugin.host.protocol-error', reason: trimmed.slice(0, 200) })
      return
    }

    // 插件的"能力请求"：先判定，再执行。判定权在平台，子进程无权自证。
    if (message.kind === 'capability') {
      void this.handleCapability(
        String(message.id),
        String(message.capability),
        (message.args ?? {}) as Record<string, unknown>,
      )
      return
    }

    const resolvePending = this.pending.get(Number(message.id))
    if (!resolvePending) return
    this.pending.delete(Number(message.id))

    const ok = message.ok === true
    const error = message.error as { message: string; code?: string } | undefined
    // 调用成功与失败都留痕：越权被**子进程边界**拦下时（ERR_ACCESS_DENIED）走的就是这条 ——
    // 它不经过能力中介，所以不能只指望 plugin.capability.denied 那种事件
    // **先留痕，再应答**：审计写完才让调用方拿到结果 —— 否则"被拒了但查不到"
    // 这种竞态会让留痕变成运气
    await this.options.onAudit?.({
      action: ok ? 'plugin.invoke' : 'plugin.invoke.failed',
      status: ok ? 'success' : 'failure',
      reason: error ? `${error.code ?? 'ERROR'}: ${error.message}` : undefined,
    })
    resolvePending({ ok, result: message.result, error })
  }

  private async handleCapability(
    id: string,
    capability: string,
    args: Record<string, unknown>,
  ): Promise<void> {
    const denial = this.options.authorize?.(capability, args) ?? null
    if (denial) {
      await this.options.onAudit?.({
        action: 'plugin.capability.denied',
        capability,
        allowed: false,
        reason: denial,
      })
      this.replyCapability(id, false, undefined, denial)
      return
    }

    try {
      const result = await this.options.executeCapability?.(capability, args)
      await this.options.onAudit?.({ action: 'plugin.capability.allowed', capability, allowed: true })
      this.replyCapability(id, true, result)
    } catch (error) {
      const message = (error as Error).message
      this.options.onAudit?.({
        action: 'plugin.capability.failed',
        capability,
        allowed: true,
        reason: message,
      })
      this.replyCapability(id, false, undefined, message)
    }
  }

  private replyCapability(
    id: string,
    ok: boolean,
    result?: unknown,
    error?: string,
  ): void {
    this.child?.stdin.write(
      JSON.stringify({ kind: 'capability-result', id, ok, result, error }) + '\n',
    )
  }
}
