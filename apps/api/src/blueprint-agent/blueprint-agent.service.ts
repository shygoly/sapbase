import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { AIModelsService } from '../ai-models/ai-models.service'
import { BlueprintService } from '../blueprint/blueprint.service'

export interface AgentActor {
  id?: string
  role?: string | null
  permissions?: string[]
}

@Injectable()
export class BlueprintAgentService {
  constructor(
    private readonly blueprints: BlueprintService,
    private readonly models: AIModelsService,
  ) {}

  async run(
    packageId: string,
    organizationId: string,
    actor: AgentActor,
    agentKey: string,
    input: string,
    confirm = false,
  ) {
    if (!input || input.trim().length === 0) {
      throw new BadRequestException('input 必填')
    }
    const loaded = await this.blueprints.load(packageId, { tenantId: organizationId })
    const agents = (
      loaded.compiled as unknown as {
        agents?: {
          items: Array<{
            key: string
            name: string
            prompt: string
            model?: string
            tools: string[]
            roles: string[]
            confirmWrites?: boolean
            dataScope?: string
          }>
        }
      }
    ).agents
    const agent = agents?.items.find((item) => item.key === agentKey)
    if (!agent) throw new NotFoundException(`Agent 未定义：${agentKey}`)
    const role = actor.role ?? ''
    if (role !== 'Admin' && !agent.roles.includes(role)) {
      throw new ForbiddenException(`角色 ${role || '(none)'} 无权调用 ${agentKey}`)
    }
    if (agent.confirmWrites === true && confirm !== true) {
      return {
        agentKey,
        status: 'requires-confirmation',
        requiresConfirmation: true,
        tools: agent.tools,
      }
    }
    const model = await this.models.findDefault()
    if (!model) throw new BadRequestException('未配置默认 AI 模型')
    const response = await this.models.generate(model, {
      system: agent.prompt,
      user: input,
      maxTokens: Number(process.env.EDUCATION_AGENT_MAX_TOKENS ?? 1200),
      temperature: 0.2,
      timeoutMs: Number(process.env.EDUCATION_AGENT_TIMEOUT_MS ?? 120_000),
    })
    const draft = extractText(response)
    return {
      agentKey,
      status: 'draft',
      requiresConfirmation: agent.confirmWrites === true,
      model: model.name,
      tools: agent.tools,
      dataScope: agent.dataScope ?? null,
      draft,
    }
  }
}

function extractText(response: unknown): string {
  const value = response as {
    choices?: Array<{ message?: { content?: string } }>
    content?: Array<{ text?: string }>
  }
  const openai = value.choices?.[0]?.message?.content
  if (typeof openai === 'string') return openai
  const anthropic = value.content?.map((item) => item.text ?? '').join('')
  if (anthropic && anthropic.length > 0) return anthropic
  return JSON.stringify(response).slice(0, 4000)
}
