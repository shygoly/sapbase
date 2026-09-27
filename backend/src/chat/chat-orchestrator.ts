/**
 * 编排：意图 → 选工具 → 计划。执行一律走 AgentToolRegistry（不新造第二条路径）。
 * 写工具（confirmation=required）在本层绝不 invoke。
 */
import { Inject, Injectable } from '@nestjs/common'
import { AgentToolRegistry } from '../agent-tools/agent-tool.registry'
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
  ) {}

  async handleMessage(message: string, context: ChatContext): Promise<ChatResult> {
    const intent = await this.parser.parse({ message, context })
    if (!intent) {
      return { kind: 'refusal', message: NO_SUCH_CAPABILITY }
    }

    const selector = new CatalogToolSelector(this.registry.catalog())
    const tool = selector.select(intent.tool)
    if (!tool) {
      return { kind: 'refusal', message: NO_SUCH_CAPABILITY, intent: intent.label }
    }

    if (tool.confirmation === 'required') {
      const plan = buildInteractionPlan({
        toolName: tool.name,
        args: intent.args,
        intentLabel: intent.label,
        catalog: this.registry.catalog(),
      })
      return { kind: 'plan', plan, intent: intent.label }
    }

    const invoked = await this.registry.invoke({
      name: tool.name,
      args: intent.args,
      organizationId: context.organizationId,
      actor: context.actor,
      grantedPermissions: context.grantedPermissions,
    })

    const plan = buildInteractionPlan({
      toolName: tool.name,
      args: intent.args,
      intentLabel: intent.label,
      result: invoked.result,
      catalog: this.registry.catalog(),
    })
    return { kind: 'plan', plan, intent: intent.label }
  }
}
