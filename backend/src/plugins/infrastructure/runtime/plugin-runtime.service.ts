import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { Plugin } from '../../domain/entities/plugin.entity'
import type { IPluginContext } from '../../domain/services/i-plugin-context'
import { PluginContextProvider } from './plugin-context-provider.service'
import { PluginHostProcess } from './plugin-host-process'
import { AuditLogsService } from '../../../audit-logs/audit-logs.service'
import { createAuthorizer } from '../security/plugin-capability-broker'

export interface PluginRuntime {
  plugin: Plugin
  /**
   * 沙箱宿主进程：**插件的代码只在它里面跑**。
   *
   * 这里曾经是 `instance: any` —— 插件被 `require` 进 API 进程，与宿主同权限。
   * 现在宿主进程承接一切：调用、能力请求、超时、终止（见 plugin-host-process.ts）。
   */
  host: PluginHostProcess
  context: IPluginContext
  apiRoutes: Array<{
    path: string
    method: string
    handler: (req: unknown, res: unknown) => Promise<unknown>
  }>
}

/**
 * Plugin entry point interface
 * Plugins should export a default function or class that implements this
 */
export interface PluginEntryPoint {
  /**
   * Initialize the plugin with context
   * Called when plugin is activated
   */
  initialize?: (context: IPluginContext) => Promise<void> | void

  /**
   * Cleanup plugin resources
   * Called when plugin is deactivated
   */
  cleanup?: () => Promise<void> | void

  /**
   * Get API route handlers
   * Returns a map of route paths to handler functions
   */
  getApiHandlers?: () => Record<
    string,
    (req: any, res: any, next?: any) => Promise<any> | any
  >
}

@Injectable()
export class PluginRuntimeService implements OnModuleDestroy {
  private readonly logger = new Logger(PluginRuntimeService.name)
  private readonly activePlugins = new Map<string, PluginRuntime>()

  constructor(
    private readonly contextProvider: PluginContextProvider,
    private readonly auditLogs: AuditLogsService,
  ) {}

  /**
   * 激活插件：**在受限子进程里**把它跑起来。
   *
   * 三件与旧实现的关键区别（旧实现在这里用 `require` 把插件装进 API 进程）：
   *   1. 能力由**清单声明**决定：`createAuthorizer` 逐项 all-of 判定，缺声明即拒
   *   2. 加载失败**不再静默降级**（旧代码会"Using minimal runtime"继续跑）——
   *      静默降级等于把"插件没跑起来"伪装成"插件在跑"（元语不变量 4）
   *   3. 路由处理器是**代理**：它们把调用转给子进程，而不是在宿主里直接执行插件代码
   */
  async loadPlugin(plugin: Plugin): Promise<PluginRuntime> {
    const context = this.contextProvider.createContext(plugin)
    const host = this.createHost(plugin)
    const activated = await host.start()

    // 路由处理器一律是"转发到子进程"的代理；插件**不能**在宿主里注册自己的函数
    const apiRoutes: PluginRuntime['apiRoutes'] = (
      plugin.manifest.api?.routes ?? []
    ).map((route) => ({
      path: route.path,
      method: route.method.toLowerCase(),
      handler: async () => {
        const result = await host.invoke(route.handler)
        if (!result.ok) {
          throw new Error(result.error?.message ?? `插件处理 ${route.path} 失败`)
        }
        return result.result
      },
    }))

    const runtime: PluginRuntime = { plugin, host, context, apiRoutes }
    this.activePlugins.set(plugin.id, runtime)
    this.logger.log(
      `插件 ${plugin.name} 已在受限子进程里激活（导出：${activated.exports.join(', ')}）`,
    )
    return runtime
  }

  /**
   * 在沙箱里调用插件的一个导出（生命周期钩子走这里）。
   *
   * 已激活的插件复用它的宿主进程；未激活（安装/卸载钩子）时起一个**临时**宿主进程，
   * 用完就停 —— 钩子也是插件代码，不能在宿主进程里 require。
   */
  async invokeHook(
    plugin: Plugin,
    hookName: string,
  ): Promise<{ ok: boolean; result?: unknown; error?: { message: string; code?: string } }> {
    const active = this.activePlugins.get(plugin.id)
    if (active) return active.host.invoke(hookName)

    const host = this.createHost(plugin)
    try {
      await host.start()
      return await host.invoke(hookName)
    } finally {
      await host.stop()
    }
  }

  private createHost(plugin: Plugin): PluginHostProcess {
    return new PluginHostProcess({
      pluginDir: plugin.installPath,
      entry: plugin.manifest.entry.backend,
      pluginName: plugin.name,
      // 判定权在平台：清单声明 → 权限点 → all-of
      authorize: createAuthorizer(plugin.name, plugin.manifest.permissions ?? {}),
      executeCapability: async (capability, args) => {
        // v1 只实现"不改数据、不出网"的这一条；其余能力需要各自的执行器（另立变更）。
        // 这里明确抛错而不是返回 undefined —— "没实现"与"越权"必须能分开看。
        if (capability === 'log.write') {
          this.logger.log(`[plugin ${plugin.name}] ${String(args.message ?? '')}`)
          return { ok: true }
        }
        throw new Error(
          `宿主尚未提供 ${capability} 的执行器（本变更只做边界与能力中介）`,
        )
      },
      onAudit: async (event) => {
        // 审计出口与原子同一条：能力拒绝与放行**都落 audit_logs**。
        // 只打日志不算留痕 —— 日志会轮转、也查不了"哪个插件做过什么"。
        // 返回 promise：宿主会等它写完再应答（先留痕，再返回结果）
        await this.auditLogs
          .create({
            action: event.action,
            resource: 'plugin',
            resourceId: plugin.id,
            actor: 'plugin-host',
            status: event.status ?? (event.allowed === false ? 'failure' : 'success'),
            organizationId: plugin.organizationId,
            metadata: {
              pluginName: plugin.name,
              pluginVersion: plugin.version,
              capability: event.capability,
              allowed: event.allowed,
              reason: event.reason,
            },
          })
          .catch((error: Error) => {
            // 审计写失败也要说一声，只是不能因此把插件调用炸掉（原子那条线同样处理）
            this.logger.error(`插件 ${plugin.name} 审计写入失败：${error.message}`)
          })
      },
    })
  }

  /**
   * 进程活着，插件就没停 —— 应用关停时必须把它们结束掉，否则会留下孤儿进程
   * （这也是"边界"的一部分：我们起的进程，我们负责收）。
   */
  async onModuleDestroy(): Promise<void> {
    for (const [pluginId, runtime] of this.activePlugins) {
      try {
        await runtime.host.stop()
      } catch (error) {
        this.logger.error(`停用插件 ${runtime.plugin.name} 失败：${(error as Error).message}`)
      }
      this.activePlugins.delete(pluginId)
    }
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const runtime = this.activePlugins.get(pluginId)
    if (runtime) {
      // 停用 = 让子进程跑完 cleanup 再结束它；无论成败都必须结束（进程不能留）
      try {
        await runtime.host.stop()
      } catch (error) {
        this.logger.error(
          `Error during plugin ${runtime.plugin.name} shutdown:`,
          error,
        )
      }

      this.activePlugins.delete(pluginId)
      this.logger.log(`Plugin ${runtime.plugin.name} unloaded`)
    }
  }

  getRuntime(pluginId: string): PluginRuntime | undefined {
    return this.activePlugins.get(pluginId)
  }

  getAllRuntimes(): PluginRuntime[] {
    return Array.from(this.activePlugins.values())
  }

  getApiRoutes(): Array<{
    pluginId: string
    path: string
    method: string
    handler: Function
  }> {
    const routes: Array<{
      pluginId: string
      path: string
      method: string
      handler: Function
    }> = []

    for (const [pluginId, runtime] of this.activePlugins.entries()) {
      for (const route of runtime.apiRoutes) {
        routes.push({
          pluginId,
          path: route.path,
          method: route.method,
          handler: route.handler,
        })
      }
    }

    return routes
  }
}
