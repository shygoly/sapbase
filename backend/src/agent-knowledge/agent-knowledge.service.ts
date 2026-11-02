import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { AgentKnowledgeEntry } from './entities/agent-knowledge-entry.entity'
import { AgentSkillVersion } from './entities/agent-skill-version.entity'

const SENSITIVE_PATTERNS = [
  /\b1[3-9]\d{9}\b/,
  /\b\d{17}[\dXx]\b/,
  /[\w.+-]+@[\w-]+\.[\w.-]+/,
]

@Injectable()
export class AgentKnowledgeService {
  constructor(
    @InjectRepository(AgentKnowledgeEntry) private readonly entries: Repository<AgentKnowledgeEntry>,
    @InjectRepository(AgentSkillVersion) private readonly skills: Repository<AgentSkillVersion>,
  ) {}

  detectSensitive(text: string): string[] {
    return SENSITIVE_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source)
  }

  async createDraft(input: {
    organizationId: string | null
    scope: 'global' | 'organization' | 'department' | 'user'
    scopeId?: string | null
    knowledgeKey: string
    title: string
    body: string
    releaseId?: string | null
  }): Promise<AgentKnowledgeEntry> {
    const latest = await this.entries.findOne({
      where: {
        scope: input.scope,
        scopeId: input.scopeId ? input.scopeId : IsNull(),
        knowledgeKey: input.knowledgeKey,
      },
      order: { version: 'DESC' },
    })
    return this.entries.save(
      this.entries.create({
        organizationId: input.organizationId,
        scope: input.scope,
        scopeId: input.scopeId ?? null,
        knowledgeKey: input.knowledgeKey,
        version: (latest?.version ?? 0) + 1,
        title: input.title,
        body: input.body,
        status: 'draft',
        releaseId: input.releaseId ?? null,
        sensitiveReview: {},
      }),
    )
  }

  async publish(input: {
    id: string
    organizationId: string | null
    confirmedSensitive: boolean
  }): Promise<AgentKnowledgeEntry> {
    const entry = await this.entries.findOne({ where: { id: input.id } })
    if (!entry) throw new NotFoundException('知识条目不存在')
    if (entry.organizationId && entry.organizationId !== input.organizationId) {
      throw new ConflictException('知识条目不属于当前组织')
    }
    const hits = this.detectSensitive(entry.body)
    if (hits.length > 0 && !input.confirmedSensitive) {
      throw new ConflictException({
        code: 'SENSITIVE_CONTENT',
        message: '检测到敏感信息，必须逐条确认后才能发布',
        hits,
      })
    }
    await this.entries.update(
      {
        scope: entry.scope,
        scopeId: entry.scopeId ? entry.scopeId : IsNull(),
        knowledgeKey: entry.knowledgeKey,
        status: 'published',
      },
      { status: 'superseded' },
    )
    entry.status = 'published'
    entry.sensitiveReview = { confirmed: true, hits }
    return this.entries.save(entry)
  }

  async listPublished(input: {
    organizationId: string
    releaseId?: string | null
    limit?: number
  }): Promise<AgentKnowledgeEntry[]> {
    const rows = await this.entries.find({
      where: [
        { scope: 'global', status: 'published' },
        { scope: 'organization', scopeId: input.organizationId, status: 'published' },
      ],
      order: { createdAt: 'DESC' },
      take: input.limit ?? 20,
    })
    return rows.filter((row) => !input.releaseId || !row.releaseId || row.releaseId === input.releaseId)
  }

  async rollback(input: { id: string; organizationId: string | null }): Promise<AgentKnowledgeEntry> {
    const source = await this.entries.findOne({ where: { id: input.id } })
    if (!source) throw new NotFoundException('知识条目不存在')
    return this.createDraft({
      organizationId: input.organizationId,
      scope: source.scope,
      scopeId: source.scopeId,
      knowledgeKey: source.knowledgeKey,
      title: source.title,
      body: source.body,
      releaseId: source.releaseId,
    })
  }

  async registerSkill(input: {
    organizationId: string | null
    skillKey: string
    digest: string
    releaseId?: string | null
  }): Promise<AgentSkillVersion> {
    const latest = await this.skills.findOne({ where: { skillKey: input.skillKey }, order: { version: 'DESC' } })
    return this.skills.save(
      this.skills.create({
        organizationId: input.organizationId,
        skillKey: input.skillKey,
        version: (latest?.version ?? 0) + 1,
        digest: input.digest,
        status: 'draft',
        releaseId: input.releaseId ?? null,
      }),
    )
  }
}
