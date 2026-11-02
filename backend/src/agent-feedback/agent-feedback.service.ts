import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, IsNull, Repository } from 'typeorm'
import { AgentFeedback } from './entities/agent-feedback.entity'
import { wrapUntrustedData } from '@sap/agent-kernel'
import { randomUUID } from 'node:crypto'

const MASK_PATTERNS = [
  { pattern: /\b1[3-9]\d{9}\b/g, replace: '***PHONE***' },
  { pattern: /\b\d{17}[\dXx]\b/g, replace: '***ID***' },
  { pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replace: '***EMAIL***' },
]

@Injectable()
export class AgentFeedbackService {
  constructor(@InjectRepository(AgentFeedback) private readonly feedback: Repository<AgentFeedback>) {}

  mask(text: string | undefined | null): string | null {
    if (!text) return null
    let out = text
    for (const item of MASK_PATTERNS) out = out.replace(item.pattern, item.replace)
    return out
  }

  async create(input: {
    organizationId: string
    userId: string
    appKey: string
    releaseId?: string | null
    cohort?: Record<string, unknown> | null
    role?: string | null
    screen?: Record<string, unknown> | null
    traceId?: string | null
    toolCallIds?: string[]
    category: string
    content?: string
  }): Promise<AgentFeedback> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const duplicate = await this.feedback.findOne({
      where: {
        organizationId: input.organizationId,
        appKey: input.appKey,
        contentMasked: this.mask(input.content) ? this.mask(input.content)! : IsNull(),
        createdAt: Between(since, new Date()),
      },
    })
    if (duplicate) return duplicate
    return this.feedback.save(
      this.feedback.create({
        organizationId: input.organizationId,
        userId: input.userId,
        appKey: input.appKey,
        releaseId: input.releaseId ?? null,
        cohort: input.cohort ?? null,
        role: input.role ?? null,
        screen: input.screen ?? null,
        traceId: input.traceId ?? null,
        toolCallIds: input.toolCallIds ?? [],
        category: input.category,
        contentMasked: this.mask(input.content),
        status: 'new',
      }),
    )
  }

  async list(organizationId: string, appKey?: string, status?: string): Promise<AgentFeedback[]> {
    const where: Record<string, unknown> = { organizationId }
    if (appKey) where.appKey = appKey
    if (status) where.status = status
    return this.feedback.find({ where, order: { createdAt: 'DESC' }, take: 100 })
  }

  triage(rows: AgentFeedback[]) {
    const topics = new Map<string, { topicKey: string; count: number; evidence: string[]; roles: Set<string> }>()
    for (const row of rows) {
      const key = `${row.appKey}:${row.category}`
      const topic = topics.get(key) ?? {
        topicKey: key,
        count: 0,
        evidence: [],
        roles: new Set<string>(),
      }
      topic.count += 1
      topic.evidence.push(row.id)
      if (row.role) topic.roles.add(row.role)
      topics.set(key, topic)
    }
    return [...topics.values()].map((topic) => ({
      topicKey: topic.topicKey,
      count: topic.count,
      evidence: topic.evidence,
      roles: [...topic.roles],
    }))
  }

  asUntrusted(row: AgentFeedback): string {
    return wrapUntrustedData({
      content: row.contentMasked ?? '',
      source: `feedback:${row.id}`,
      nonce: randomUUID(),
    })
  }
}
