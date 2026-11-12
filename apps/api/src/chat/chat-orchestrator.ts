/**
 * 编排：意图 → 选工具 → 计划。执行一律走 AgentToolRegistry（不新造第二条路径）。
 * 写工具（confirmation=required）在本层绝不 invoke。
 */
import { Inject, Injectable, Optional } from '@nestjs/common'
import { BudgetGuard } from '@sap/agent-kernel'
import { AgentToolRegistry } from '../agent-tools/agent-tool.registry'
import { AgentToolMcpBridge } from '../agent-tools/mcp/agent-tool-mcp.bridge'
import type { ChatContext, ChatResult, IntentParser } from './chat.types'
import { INTENT_PARSER } from './chat.types'
import { buildInteractionPlan } from './interaction-plan-builder'
import { CatalogToolSelector } from './tool-selector'

const NO_SUCH_CAPABILITY = '没有这个能力'

@Injectable()
export class ChatOrchestrator {
  constructor(
    @Inject(INTENT_PARSER) private readonly parser: IntentParser,
    private readonly registry: AgentToolRegistry,
    // 可选：transport=direct 时桥会直接委托网关；不注入也保持原有行为（测试可只传前两个）。
    @Optional() private readonly bridge?: AgentToolMcpBridge,
  ) {}

  async handleMessage(message: string, context: ChatContext): Promise<ChatResult> {
    let observation = ''
    let lastIntentId = ''
    let lastResult: ChatResult | null = null
    const guard = new BudgetGuard(
      context.budget ?? {
        maxToolCalls: 8,
        maxTokens: 12_000,
        deadlineMs: 30_000,
      },
    )

    for (let step = 0; step < 3; step += 1) {
      guard.assertDeadline()
      const intent = await this.parser.parse({
        message: observation ? `${message}\n??: ${observation}` : message,
        context,
      })
      if (!intent) {
        if (lastResult) return lastResult
        const degraded =
          process.env.AGENT_LLM_ENABLED === 'true'
            ? '抱歉，我没理解这句话。可以换种说法，或直接说明要查的业务对象（如订单、供应商）。'
            : NO_SUCH_CAPABILITY
        return { kind: 'refusal', message: degraded }
      }
      if (intent.id === lastIntentId) return lastResult ?? { kind: 'refusal', message: NO_SUCH_CAPABILITY, intent: intent.label }
      lastIntentId = intent.id

      const selector = new CatalogToolSelector(this.registry.catalog())
      const tool = selector.select(intent.tool)
      if (!tool) return { kind: 'refusal', message: NO_SUCH_CAPABILITY, intent: intent.label }

      if (tool.confirmation === 'required') {
        const plan = buildInteractionPlan({
          toolName: tool.name,
          args: intent.args,
          intentLabel: intent.label,
          catalog: this.registry.catalog(),
        })
        return { kind: 'plan', plan, intent: intent.label }
      }

      guard.recordToolCall()
      guard.assertDeadline()
      const invoked = this.bridge
        ? await this.bridge.invoke({
            name: tool.name,
            args: intent.args,
            organizationId: context.organizationId,
            actor: context.actor,
            grantedPermissions: context.grantedPermissions,
            appContext: context.appContext,
          })
        : await this.registry.invoke({
            name: tool.name,
            args: intent.args,
            organizationId: context.organizationId,
            actor: context.actor,
            grantedPermissions: context.grantedPermissions,
            appContext: context.appContext,
          })

      const plan = buildInteractionPlan({
        toolName: tool.name,
        args: intent.args,
        intentLabel: intent.label,
        result: invoked.result,
        catalog: this.registry.catalog(),
      })
      lastResult = { kind: 'plan', plan, intent: intent.label }
      observation = `tool ${tool.name}: ${String(JSON.stringify(invoked.result)).slice(0, 500)}`
    }
    return lastResult ?? { kind: 'refusal', message: NO_SUCH_CAPABILITY }
  }
}
