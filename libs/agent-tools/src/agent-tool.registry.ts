import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { missingPermissions } from '@sap/platform-release/atomic-runtime/atomic-permissions'
import { AtomicExecutor } from '@sap/platform-release/atomic-runtime/atomic-executor.service'
import { RevocationListService } from '@sap/platform-release/atomic-runtime/revocation-list.service'
import { AtomicRegistryService } from '@sap/platform-release/atomic-registry/atomic-registry.service'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { BlueprintService } from '@sap/platform-release/blueprint/blueprint.service'
import { validateToolArguments } from '@sap/platform-core/common/protocol/chat-protocol-validator'
import type { AgentFeedbackPort, AgentModuleRegistryPort } from './agent-tools.ports'
import type { BusinessAppExecutionContext } from '@speckit/shared-schemas'
import {
  type AgentToolContract,
  type ToolCatalog,
  loadToolCatalog,
} from './contracts-loader'
import {
  ConfirmationTokenService,
  digestToolArgs,
} from './confirmation-token.service'
import { ReleasesService } from '@sap/platform-release/releases/releases.service'
import type { DataScopeGuard } from '@sap/platform-core/data-scope/data-scope.guard'
import { wrapUntrustedData } from '@sap/agent-kernel'
import { assertAgentProfile, type AgentProfile } from './agent-profile'

const ALLOWED_ATOMIC_KINDS = new Set(['calculation', 'query'])

export type { AgentProfile } from './agent-profile'

export function isAgentAllowed(tool: { allowedAgents?: string[] }, profile: AgentProfile): boolean {
  const allowed = tool.allowedAgents
  if (!allowed || allowed.length === 0) return true
  return allowed.includes('*') || allowed.includes(profile)
}

export interface AgentToolInvokeInput {
  name: string
  args: Record<string, unknown>
  confirmationToken?: string
  organizationId?: string
  actor: string
  grantedPermissions: readonly string[]
  appContext?: BusinessAppExecutionContext
  idempotencyKey?: string
}

export interface AgentToolConfirmInput {
  name: string
  args: Record<string, unknown>
  organizationId?: string
  actor: string
  appContext?: BusinessAppExecutionContext
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
  private readonly writeCache = new Map<string, unknown>()

  constructor(
    private readonly blueprints: BlueprintService,
    private readonly modules: AgentModuleRegistryPort,
    private readonly executor: AtomicExecutor,
    private readonly revocations: RevocationListService,
    private readonly atomics: AtomicRegistryService,
    private readonly auditLogs: AuditLogsService,
    private readonly tokens: ConfirmationTokenService,
    private readonly feedback: AgentFeedbackPort,
    private readonly releases: ReleasesService,
    /**
     * 可选：声明了 `dataScope` 的工具必须经过它。
     * 未注入时按 fail-closed 处理（见 invoke），避免"忘了装配 = 范围失效"。
     */
    private readonly dataScopeGuard?: DataScopeGuard,
  ) {}

  catalog(): ToolCatalog {
    return loadToolCatalog()
  }

  async confirm(input: AgentToolConfirmInput) {
    return this.confirmWithProfile('piagent-runtime', input)
  }

  /** 仅供受控 MCP/宿主桥使用；profile 必须来自服务端可信来源。 */
  async confirmAs(profile: AgentProfile, input: AgentToolConfirmInput) {
    return this.confirmWithProfile(assertAgentProfile(profile), input)
  }

  private async confirmWithProfile(profile: AgentProfile, input: AgentToolConfirmInput) {
    const organizationId = this.requireOrganizationId(input.organizationId)
    const tool = this.requireTool(input.name, this.catalog())
    this.assertAgent(tool, profile)
    if (tool.confirmation !== 'required') {
      throw new BadRequestException(
        `工具 ${tool.name} 不需要确认令牌（confirmation=${tool.confirmation}）`,
      )
    }
    this.assertArgs(tool, input.args)
    this.assertAppContext(input.appContext, organizationId)
    return this.tokens.issue({
      organizationId,
      appInstallationId: input.appContext?.appInstallationId,
      tool: tool.name,
      args: input.args,
      actor: input.actor,
    })
  }

  async invoke(
    input: AgentToolInvokeInput,
    catalog: ToolCatalog = loadToolCatalog(),
  ): Promise<{ ok: true; tool: string; result: unknown }> {
    return this.invokeWithProfile('piagent-runtime', input, catalog)
  }

  /** 仅供受控 MCP/宿主桥使用；profile 必须来自服务端可信来源。 */
  async invokeAs(
    profile: AgentProfile,
    input: AgentToolInvokeInput,
    catalog: ToolCatalog = loadToolCatalog(),
  ): Promise<{ ok: true; tool: string; result: unknown }> {
    return this.invokeWithProfile(assertAgentProfile(profile), input, catalog)
  }

  private async invokeWithProfile(
    profile: AgentProfile,
    input: AgentToolInvokeInput,
    catalog: ToolCatalog,
  ): Promise<{ ok: true; tool: string; result: unknown }> {
    const organizationId = this.requireOrganizationId(input.organizationId)
    const tool = this.requireTool(input.name, catalog)
    this.assertAgent(tool, profile)
    this.assertArgs(tool, input.args)
    this.assertAppContext(input.appContext, organizationId)

    const cacheKey =
      tool.write && input.idempotencyKey
        ? `${organizationId}:${tool.name}:${input.idempotencyKey}`
        : null
    if (cacheKey && this.writeCache.has(cacheKey)) {
      return this.writeCache.get(cacheKey) as { ok: true; tool: string; result: unknown }
    }
    const missing = missingPermissions([tool.permission], input.grantedPermissions)
    if (missing.length > 0) {
      throw new ForbiddenException(
        `缺少权限：${missing.join(', ')}（契约声明的权限点必须全部满足）`,
      )
    }

    // 数据范围在确认令牌消费之前判定：越权调用不能烧掉一次确认。
    await this.assertDataScope(tool, input, organizationId)

    if (tool.confirmation === 'required') {
      if (!input.confirmationToken) {
        throw new ForbiddenException(
          `写工具 ${tool.name} 需要确认令牌（智能体不能自己确认）`,
        )
      }
      await this.tokens.consume({
        token: input.confirmationToken,
        organizationId,
        appInstallationId: input.appContext?.appInstallationId,
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
        appInstallationId: input.appContext?.appInstallationId,
        appKey: input.appContext?.appKey,
        traceId: input.appContext?.traceId,
      })
      const response = {
        ok: true as const,
        tool: tool.name,
        result: this.wrapResultIfUntrusted(tool, result),
      }
      if (cacheKey) this.writeCache.set(cacheKey, response)
      return response
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
        appInstallationId: input.appContext?.appInstallationId,
        appKey: input.appContext?.appKey,
        traceId: input.appContext?.traceId,
        reason: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * 工具契约声明了 dataScope 就必须过范围闸：
   *   - 未声明：不额外过滤（旧行为）
   *   - 声明了但运行时没装配 guard：拒绝（fail-closed，不能静默放开）
   *   - guard 判定 none：拒绝
   */
  private async assertDataScope(
    tool: AgentToolContract,
    input: AgentToolInvokeInput,
    organizationId: string,
  ): Promise<void> {
    const declared = tool.dataScope
    if (!declared) return
    if (!this.dataScopeGuard) {
      throw new ForbiddenException(
        `工具 ${tool.name} 声明了数据范围，但运行时未装配 DataScopeGuard，拒绝执行`,
      )
    }
    await this.dataScopeGuard.assertAllowed({
      organizationId,
      resourceKey: declared.resourceKey,
      action: declared.action,
      declared: true,
      actor: {
        userId: input.actor,
        roleKeys: [],
        groupKeys: [],
        permissions: [...input.grantedPermissions],
      },
    })
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

  private assertBuilderEnabled(profile: AgentProfile): void {
    if (profile === 'piagent-builder' && process.env.BUILDER_ENABLED === 'false') {
      throw new ForbiddenException('Builder 智能体不允许直接操作 ai_modules 表')
    }
  }

  private assertAgent(tool: AgentToolContract, profile: AgentProfile): void {
    const allowed = tool.allowedAgents
    if (!allowed || allowed.length === 0) return
    if (allowed.includes('*') || allowed.includes(profile)) return
    throw new ForbiddenException(
      `智能体 ${profile} 不允许调用工具 ${tool.name}（allowedAgents=${allowed.join(',')}）`,
    )
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

  private assertAppContext(
    appContext: BusinessAppExecutionContext | undefined,
    organizationId: string,
  ): void {
    if (appContext && appContext.organizationId !== organizationId) {
      throw new ForbiddenException('应用上下文与组织上下文不一致')
    }
  }

  private assertArgs(tool: AgentToolContract, args: Record<string, unknown>): void {
    const check = validateToolArguments(tool, args)
    if (!check.valid) {
      throw new BadRequestException(
        `参数不合法：${check.errors.join('; ')}`,
      )
    }
  }

  /** 不可信工具结果必须带 source/nonce 边界，不能以裸对象进入模型上下文。 */
  private wrapResultIfUntrusted(tool: AgentToolContract, result: unknown): unknown {
    if (!tool.untrustedResult) return result
    const content =
      typeof result === 'string' ? result : JSON.stringify(result ?? null)
    return wrapUntrustedData({
      content,
      source: `tool:${tool.name}`,
      nonce: randomUUID(),
    })
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
      case 'builder_feedback_list':
        return this.feedback.list(
          organizationId,
          typeof args.appKey === 'string' ? args.appKey : undefined,
          typeof args.status === 'string' ? args.status : undefined,
        )
      case 'builder_proposal_create':
        return this.releases.createProposal({
          organizationId,
          appKey: String(args.appKey),
          draftId: String(args.draftId),
          type: String(args.type),
          title: String(args.title),
          summary: String(args.summary),
          diff: (args.diff as Record<string, unknown>) ?? {},
          evidence: Array.isArray(args.evidence) ? args.evidence : [],
          risk: (args.risk as Record<string, unknown>) ?? {},
          testPlan: (args.testPlan as Record<string, unknown>) ?? {},
          rollbackPlan: (args.rollbackPlan as Record<string, unknown>) ?? {},
          createdByAgent: 'piagent-builder',
          createdBy: null,
        })
      case 'builder_proposal_validate':
        return this.releases.validateProposal(
          String(args.proposalId),
          organizationId,
          {
            blueprintId: typeof args.blueprintId === 'string' ? args.blueprintId : undefined,
            previewUrl: typeof args.previewUrl === 'string' ? args.previewUrl : undefined,
          },
        )
      case 'builder_changelog_draft':
        return {
          status: 'draft',
          changelog: {
            'zh-CN': Array.isArray(args.changes) ? args.changes : [{ type: 'changed', title: String(args.title), detail: String(args.summary) }],
          },
          note: 'draft only; human review required before publish',
        }
      case 'builder_release_preview':
        return {
          token: this.releases.issuePreviewToken({
            userId: 'piagent-builder',
            organizationId,
            releaseId: String(args.releaseId),
            roles: Array.isArray(args.roles) ? args.roles.map(String) : [],
          }),
        }
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
    appInstallationId?: string
    appKey?: string
    traceId?: string
    releaseId?: string | null
    reason?: string
  }): Promise<void> {
    const redactedArgs = redactToolArgs(detail.args, detail.sensitiveArgs)
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
        ...(detail.appInstallationId
          ? { appInstallationId: detail.appInstallationId }
          : {}),
        ...(detail.appKey ? { appKey: detail.appKey } : {}),
        ...(detail.traceId ? { traceId: detail.traceId } : {}),
        ...(detail.releaseId ? { releaseId: detail.releaseId } : {}),
        ...(detail.reason ? { reason: detail.reason } : {}),
      },
    })
  }
}

const SECRET_KEY = /token|secret|password|authorization|api[_-]?key|credential|cookie/i

/** 审计参数脱敏：声明键 + 常见密钥键；递归对象/数组，不修改原对象。 */
export function redactToolArgs(
  args: Record<string, unknown>,
  sensitiveArgs: string[],
  depth = 0,
): Record<string, unknown> {
  const hidden = new Set(sensitiveArgs)
  const redactValue = (value: unknown, key: string): unknown => {
    if (hidden.has(key) || SECRET_KEY.test(key)) return '***'
    if (depth >= 6 || value === null || value === undefined) return value
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return redactToolArgs(item as Record<string, unknown>, sensitiveArgs, depth + 1)
        }
        return redactValue(item, `${key}[${index}]`)
      })
    }
    if (typeof value === 'object') {
      return redactToolArgs(value as Record<string, unknown>, sensitiveArgs, depth + 1)
    }
    return value
  }
  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => [key, redactValue(value, key)]),
  )
}
