import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { missingPermissions } from '../atomic-runtime/atomic-permissions'
import { AtomicExecutor } from '../atomic-runtime/atomic-executor.service'
import { RevocationListService } from '../atomic-runtime/revocation-list.service'
import { AtomicRegistryService } from '../atomic-registry/atomic-registry.service'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { BlueprintService } from '../blueprint/blueprint.service'
import { validateToolArguments } from '../chat/chat-protocol-validator'
import { ModuleRegistryService } from '../module-registry/module-registry.service'
import {
  type AgentToolContract,
  type ToolCatalog,
  loadToolCatalog,
} from './contracts-loader'
import {
  ConfirmationTokenService,
  digestToolArgs,
} from './confirmation-token.service'

const ALLOWED_ATOMIC_KINDS = new Set(['calculation', 'query'])

export interface AgentToolInvokeInput {
  name: string
  args: Record<string, unknown>
  confirmationToken?: string
  organizationId?: string
  actor: string
  grantedPermissions: readonly string[]
}

export interface AgentToolConfirmInput {
  name: string
  args: Record<string, unknown>
  organizationId?: string
  actor: string
}

/**
 * 工具调用链（顺序固定，任一步不过即拒，不部分执行、不回退换工具）：
 *
 *   契约查得到？ → 参数形状合法？ → 权限 all-of 满足？ →（写操作）令牌有效？
 *     → 执行 → 审计（成功与失败都写）
 *
 * 审计记 `chat.tool.invoked`。不要在工具层再写一条 `atomic.invoke`：
 * 那是原子 REST 端点的事。两层记的是两件事，不要合成一份判定。
 */
@Injectable()
export class AgentToolRegistry {
  constructor(
    private readonly blueprints: BlueprintService,
    private readonly modules: ModuleRegistryService,
    private readonly executor: AtomicExecutor,
    private readonly revocations: RevocationListService,
    private readonly atomics: AtomicRegistryService,
    private readonly auditLogs: AuditLogsService,
    private readonly tokens: ConfirmationTokenService,
  ) {}

  catalog(): ToolCatalog {
    return loadToolCatalog()
  }

  async confirm(input: AgentToolConfirmInput) {
    const organizationId = this.requireOrganizationId(input.organizationId)
    const tool = this.requireTool(input.name, this.catalog())
    if (tool.confirmation !== 'required') {
      throw new BadRequestException(
        `工具 ${tool.name} 不需要确认令牌（confirmation=${tool.confirmation}）`,
      )
    }
    this.assertArgs(tool, input.args)
    return this.tokens.issue({
      organizationId,
      tool: tool.name,
      args: input.args,
      actor: input.actor,
    })
  }

  async invoke(input: AgentToolInvokeInput, catalog: ToolCatalog = loadToolCatalog()) {
    const organizationId = this.requireOrganizationId(input.organizationId)
    const tool = this.requireTool(input.name, catalog)
    this.assertArgs(tool, input.args)

    const missing = missingPermissions([tool.permission], input.grantedPermissions)
    if (missing.length > 0) {
      throw new ForbiddenException(
        `缺少权限：${missing.join(', ')}（契约声明的权限点必须全部满足）`,
      )
    }

    if (tool.confirmation === 'required') {
      if (!input.confirmationToken) {
        throw new ForbiddenException(
          `写工具 ${tool.name} 需要确认令牌（智能体不能自己确认）`,
        )
      }
      await this.tokens.consume({
        token: input.confirmationToken,
        organizationId,
        tool: tool.name,
        argsDigest: digestToolArgs(input.args),
      })
    }

    const argsDigest = digestToolArgs(input.args)
    const startedAt = Date.now()
    try {
      const result = await this.execute(tool, input.args, organizationId, input.grantedPermissions)
      await this.audit({
        actor: input.actor,
        organizationId,
        tool: tool.name,
        args: input.args,
        sensitiveArgs: tool.sensitiveArgs ?? [],
        argsDigest,
        elapsedMs: Date.now() - startedAt,
        status: 'success',
      })
      return { ok: true as const, tool: tool.name, result }
    } catch (error) {
      await this.audit({
        actor: input.actor,
        organizationId,
        tool: tool.name,
        args: input.args,
        sensitiveArgs: tool.sensitiveArgs ?? [],
        argsDigest,
        elapsedMs: Date.now() - startedAt,
        status: 'failure',
        reason: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  private requireOrganizationId(organizationId: string | undefined): string {
    // AuditLog 是租户实体（organizationId 非空）：没有组织上下文就没法留痕，
    // 此时**拒绝调用**而不是写一条残缺审计（元语不变量 4：fail-closed）。
    if (!organizationId) {
      throw new HttpException(
        {
          statusCode: 400,
          code: 'INVALID_INPUT',
          message: '缺少组织上下文（organizationId），无法记录审计，拒绝执行',
        },
        400,
      )
    }
    return organizationId
  }

  private requireTool(name: string, catalog: ToolCatalog): AgentToolContract {
    const tool = catalog.tools.find((item) => item.name === name)
    if (!tool) {
      // 白名单契约：未声明即不存在。必须说"没有这个能力"，不能说成"权限不足"——
      // 后者会诱使智能体改试别的工具。见 docs/protocols/chat-erp.md §2。
      throw new NotFoundException(
        `没有这个能力：${name}（工具面是白名单契约，未声明即不存在）`,
      )
    }
    return tool
  }

  private assertArgs(tool: AgentToolContract, args: Record<string, unknown>): void {
    const check = validateToolArguments(tool, args)
    if (!check.valid) {
      throw new BadRequestException(
        `参数不合法：${check.errors.join('; ')}`,
      )
    }
  }

  private async execute(
    tool: AgentToolContract,
    args: Record<string, unknown>,
    organizationId: string,
    grantedPermissions: readonly string[],
  ): Promise<unknown> {
    switch (tool.name) {
      case 'erp_blueprint_list':
        return this.blueprints.list()
      case 'erp_blueprint_manifest':
        return this.blueprints.manifestOf(String(args.id))
      case 'erp_blueprint_compile':
        // 契约把编译声明为 write=false（v1 按读处理），那它就必须**真的不写**：
        // stamp=true 会把 IR 摘要写回包内清单，那是一条绕过"写操作必须确认"的通道。
        // 所以这里硬编码 false，并且契约的参数表里**根本没有** stamp ——
        // 「能让能力不存在的地方，不要用提示词禁止」（本变更执行约定 3）。
        return this.blueprints.compile(String(args.id), { stamp: false })
      case 'erp_atomic_invoke':
        return this.invokeAtomic(args, grantedPermissions)
      case 'erp_module_list':
        return this.modules.findAll(organizationId)
      case 'erp_module_export':
        return this.modules.exportBlueprint(String(args.id), organizationId, {
          dir: typeof args.dir === 'string' ? args.dir : undefined,
          out: typeof args.out === 'string' ? args.out : undefined,
        })
      default:
        throw new NotFoundException(
          `没有这个能力：${tool.name}（契约有名字但运行时没有落点）`,
        )
    }
  }

  private async invokeAtomic(
    args: Record<string, unknown>,
    grantedPermissions: readonly string[],
  ) {
    const atomicType = String(args.atomicType)
    const version = typeof args.version === 'string' ? args.version : '*'
    const records = Array.isArray(args.records)
      ? (args.records as Array<Record<string, number>>)
      : []
    const timeoutMs = typeof args.timeoutMs === 'number' ? args.timeoutMs : undefined

    // v1 只放 calculation / query。这是执行前的硬拒，不是"提示词禁止"：
    // 提示词换一版就会失效；未声明的 kind 在运行时必须不存在。
    const { contract } = await this.atomics.resolve(atomicType, version)
    if (contract.kind && !ALLOWED_ATOMIC_KINDS.has(contract.kind)) {
      throw new BadRequestException(
        `v1 只放行 calculation/query 类原子，当前 kind=${contract.kind}（执行前硬拒，不是提示词禁止）`,
      )
    }

    return this.executor.invoke({
      atomicType,
      version,
      records,
      timeoutMs,
      // 权限来自调用者 JWT，不要相信请求体里的权限。
      grantedPermissions,
      // 每次调用前同步一次名单：命中即拒、不回退（与原子控制器同一条）。
      revocationList: this.revocations.refresh().list,
    })
  }

  /**
   * 每次工具调用（成功或失败）恰好一条 `chat.tool.invoked`。
   * organizationId 记在记录本身，不塞进 metadata。
   * sensitiveArgs 列出的参数在 metadata 里脱敏成 '***'。
   */
  private async audit(detail: {
    actor: string
    organizationId: string
    tool: string
    args: Record<string, unknown>
    sensitiveArgs: string[]
    argsDigest: string
    elapsedMs: number
    status: 'success' | 'failure'
    reason?: string
  }): Promise<void> {
    const redactedArgs = redactArgs(detail.args, detail.sensitiveArgs)
    const sensitiveMap = Object.fromEntries(
      detail.sensitiveArgs.map((key) => [key, '***']),
    )
    await this.auditLogs.create({
      action: 'chat.tool.invoked',
      resource: 'agent-tool',
      resourceId: undefined,
      actor: detail.actor,
      status: detail.status,
      organizationId: detail.organizationId,
      metadata: {
        tool: detail.tool,
        argsDigest: detail.argsDigest,
        elapsedMs: detail.elapsedMs,
        args: redactedArgs,
        sensitiveArgs: sensitiveMap,
        ...(detail.reason ? { reason: detail.reason } : {}),
      },
    })
  }
}

function redactArgs(
  args: Record<string, unknown>,
  sensitiveArgs: string[],
): Record<string, unknown> {
  if (sensitiveArgs.length === 0) return args
  const hidden = new Set(sensitiveArgs)
  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => [key, hidden.has(key) ? '***' : value]),
  )
}
