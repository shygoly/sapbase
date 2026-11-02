export type AgentProfile = 'piagent-runtime' | 'piagent-builder'

export type SseEventType =
  | 'turn.start'
  | 'text.delta'
  | 'plan'
  | 'tool.start'
  | 'tool.result'
  | 'turn.end'
  | 'error'

export interface ContextEnvelope {
  envelope: 'context-envelope/v1'
  turnId: string
  user: { id: string; displayName?: string; roles: string[]; locale?: string }
  org: { id: string; name?: string }
  app?: {
    appKey: string
    installationId: string
    releaseId: string | null
    releaseVersion?: string
    channel?: string
  }
  permissions: string[]
  screen?: { route?: string; entity?: string; recordId?: string; selectedIds?: string[] }
  conversation?: { summary?: string; recentTurns?: number }
  knowledge: Array<{ id: string; version: number; title: string; snippet?: string; score?: number }>
  tools: Array<{ name: string; description: string; write: boolean; confirmation: string }>
  budget: { maxToolCalls: number; maxTokens: number; deadlineMs: number }
  policy: { tone: string; disallow: string[] }
}

export interface Budget {
  maxToolCalls: number
  maxTokens: number
  deadlineMs: number
}

export class BudgetGuard {
  private toolCalls = 0
  private tokens = 0
  private readonly startedAt = Date.now()

  constructor(private readonly budget: Budget) {}

  recordToolCall(): void {
    this.toolCalls += 1
    if (this.toolCalls > this.budget.maxToolCalls) {
      throw new Error('BUDGET_EXCEEDED:toolCalls')
    }
  }

  recordTokens(tokens: number): void {
    this.tokens += tokens
    if (this.tokens > this.budget.maxTokens) {
      throw new Error('BUDGET_EXCEEDED:tokens')
    }
  }

  assertDeadline(): void {
    if (Date.now() - this.startedAt > this.budget.deadlineMs) {
      throw new Error('BUDGET_EXCEEDED:deadline')
    }
  }

  snapshot() {
    return { toolCalls: this.toolCalls, tokens: this.tokens, elapsedMs: Date.now() - this.startedAt }
  }
}

export function wrapUntrustedData(input: {
  content: string
  source: string
  nonce: string
}): string {
  return [
    `<<<SAP_UNTRUSTED_DATA nonce="${input.nonce}" source="${input.source}">>>`,
    input.content,
    `<<<END_SAP_UNTRUSTED_DATA nonce="${input.nonce}">>>`,
  ].join('\n')
}

export function isNonceMatchedEnd(text: string, nonce: string): boolean {
  return text.includes(`<<<END_SAP_UNTRUSTED_DATA nonce="${nonce}">>>`)
}

export function resolveToolSubset<T extends { name: string; permission: string }>(
  tools: T[],
  permissions: readonly string[],
  limit = 8,
): T[] {
  const granted = new Set(permissions)
  return tools.filter((tool) => granted.has(tool.permission)).slice(0, limit)
}

export function compileContextEnvelope(input: {
  turnId: string
  user: ContextEnvelope['user']
  org: ContextEnvelope['org']
  app?: ContextEnvelope['app']
  permissions: string[]
  screen?: ContextEnvelope['screen']
  conversation?: ContextEnvelope['conversation']
  knowledge?: ContextEnvelope['knowledge']
  tools: Array<{ name: string; description: string; write: boolean; confirmation: string; permission: string }>
  budget?: Partial<Budget>
}): ContextEnvelope {
  const budget: Budget = {
    maxToolCalls: input.budget?.maxToolCalls ?? 8,
    maxTokens: input.budget?.maxTokens ?? 12_000,
    deadlineMs: input.budget?.deadlineMs ?? 30_000,
  }
  return {
    envelope: 'context-envelope/v1',
    turnId: input.turnId,
    user: input.user,
    org: input.org,
    ...(input.app ? { app: input.app } : {}),
    permissions: input.permissions,
    ...(input.screen ? { screen: input.screen } : {}),
    ...(input.conversation ? { conversation: input.conversation } : {}),
    knowledge: input.knowledge ?? [],
    tools: resolveToolSubset(input.tools, input.permissions).map((tool) => ({
      name: tool.name,
      description: tool.description,
      write: tool.write,
      confirmation: tool.confirmation,
    })),
    budget,
    policy: { tone: 'concise', disallow: ['raw_sql', 'html', 'unapproved_urls'] },
  }
}

export interface KnowledgeCandidate {
  id: string
  version: number
  title: string
  body: string
  status: 'draft' | 'published' | 'superseded'
  scope: 'global' | 'organization' | 'department' | 'user'
  scopeId?: string | null
  organizationId?: string | null
  releaseId?: string | null
}

export function filterKnowledge(
  entries: KnowledgeCandidate[],
  input: { organizationId: string; userId?: string; releaseId?: string | null; limit?: number },
): Array<{ id: string; version: number; title: string; snippet?: string }> {
  return entries
    .filter((entry) => entry.status === 'published')
    .filter((entry) => !entry.releaseId || !input.releaseId || entry.releaseId === input.releaseId)
    .filter((entry) => {
      if (entry.scope === 'global') return true
      if (entry.scope === 'organization') {
        return entry.organizationId === input.organizationId || entry.scopeId === input.organizationId
      }
      if (entry.scope === 'user') return entry.scopeId === input.userId
      return false
    })
    .slice(0, input.limit ?? 8)
    .map((entry) => ({
      id: entry.id,
      version: entry.version,
      title: entry.title,
      snippet: entry.body.slice(0, 160),
    }))
}
