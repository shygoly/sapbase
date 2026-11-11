import { Injectable, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash } from 'node:crypto'
import { IsNull, Repository } from 'typeorm'
import { Asset } from '@sap/platform-core/assets/asset.entity'
import { Announcement } from '../notifications/announcement.entity'
import { AIModule } from '../ai-modules/ai-module.entity'
import { AgentKnowledgeEntry } from '../agent-knowledge/entities/agent-knowledge-entry.entity'
import { SearchDocument } from './search-document.entity'

export const SEARCH_RESOURCE_KEYS = [
  'announcement',
  'asset',
  'ai_module',
  'agent_knowledge',
] as const
export type SearchResourceKey = (typeof SEARCH_RESOURCE_KEYS)[number]

export interface SearchQueryInput {
  q?: string
  types?: string[]
  tags?: string[]
  from?: Date | null
  to?: Date | null
  page?: number
  pageSize?: number
}

export interface SearchHit {
  id: string
  resourceKey: string
  resourceId: string
  title: string
  snippet: string
  tags: string[]
  metadata: Record<string, unknown>
  rank: number
  indexedAt: Date
}

export interface SearchResult {
  items: SearchHit[]
  total: number
  page: number
  pageSize: number
  tookMs: number
}

const MAX_PAGE_SIZE = 50
const MAX_PAGE = 500

/**
 * PostgreSQL v1 搜索：tsvector + trigram 兜底，不引入外部搜索集群。
 * 索引只存可展示字段；内容 hash 未变时不重写。
 */
@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(SearchDocument)
    private readonly documents: Repository<SearchDocument>,
    @InjectRepository(Announcement)
    private readonly announcements: Repository<Announcement>,
    @InjectRepository(Asset)
    private readonly assets: Repository<Asset>,
    @InjectRepository(AIModule)
    private readonly aiModules: Repository<AIModule>,
    @InjectRepository(AgentKnowledgeEntry)
    private readonly knowledge: Repository<AgentKnowledgeEntry>,
  ) {}

  async upsert(input: {
    organizationId: string
    resourceKey: SearchResourceKey
    resourceId: string
    title: string
    body?: string
    tags?: string[]
    metadata?: Record<string, unknown>
  }): Promise<{ indexed: boolean; skipped: boolean }> {
    if (!input.organizationId) throw new BadRequestException('organizationId is required')
    if (!SEARCH_RESOURCE_KEYS.includes(input.resourceKey)) {
      throw new BadRequestException(`未知资源类型：${input.resourceKey}`)
    }
    const title = (input.title ?? '').trim()
    if (!title) throw new BadRequestException('title is required')
    const body = input.body ?? ''
    const tags = [...new Set((input.tags ?? []).filter(Boolean))].slice(0, 50)
    const metadata = input.metadata ?? {}
    const contentHash = createHash('sha256')
      .update(JSON.stringify({ title, body, tags, metadata }))
      .digest('hex')

    const rows: Array<{ id: string }> = await this.documents.query(
      `INSERT INTO public.search_documents
        ("organizationId", "resourceKey", "resourceId", title, body, tags, metadata, "contentHash", "indexedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, now(), now(), now())
       ON CONFLICT ("organizationId", "resourceKey", "resourceId")
       DO UPDATE SET
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         tags = EXCLUDED.tags,
         metadata = EXCLUDED.metadata,
         "contentHash" = EXCLUDED."contentHash",
         "indexedAt" = now(),
         "updatedAt" = now()
       WHERE search_documents."contentHash" <> EXCLUDED."contentHash"
       RETURNING id`,
      [
        input.organizationId,
        input.resourceKey,
        input.resourceId,
        title,
        body,
        JSON.stringify(tags),
        JSON.stringify(metadata),
        contentHash,
      ],
    )
    return { indexed: rows.length > 0, skipped: rows.length === 0 }
  }

  async remove(
    organizationId: string,
    resourceKey: SearchResourceKey,
    resourceId: string,
  ): Promise<void> {
    await this.documents.delete({ organizationId, resourceKey, resourceId })
  }

  async query(organizationId: string, input: SearchQueryInput = {}): Promise<SearchResult> {
    const started = Date.now()
    const page = Math.min(MAX_PAGE, Math.max(1, Number(input.page) || 1))
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(input.pageSize) || 20))
    const q = (input.q ?? '').trim().slice(0, 200)
    const like = `%${q}%`
    const types = input.types?.filter((type) => SEARCH_RESOURCE_KEYS.includes(type as never))
    const tags = input.tags?.filter(Boolean)
    const from = input.from ?? null
    const to = input.to ?? null

    const rows: Array<Record<string, any>> = await this.documents.query(
      `WITH q AS (SELECT plainto_tsquery('simple', $2) AS query)
       SELECT d.id,
              d."resourceKey" AS "resourceKey",
              d."resourceId" AS "resourceId",
              d.title,
              d.tags,
              d.metadata,
              d."indexedAt" AS "indexedAt",
              ts_rank(
                to_tsvector('simple', coalesce(d.title, '') || ' ' || coalesce(d.body, '')),
                q.query
              ) AS rank,
              ts_headline(
                'simple',
                d.title || ' ' || coalesce(d.body, ''),
                q.query,
                'StartSel=[[[, StopSel=]]], MaxFragments=2, MinWords=5, MaxWords=18'
              ) AS snippet,
              COUNT(*) OVER() AS total
         FROM public.search_documents d, q
        WHERE d."organizationId" = $1
          AND (
            to_tsvector('simple', coalesce(d.title, '') || ' ' || coalesce(d.body, '')) @@ q.query
            OR d.title ILIKE $3
            OR d.body ILIKE $3
          )
          AND ($4::text[] IS NULL OR d."resourceKey" = ANY($4::text[]))
          AND ($5::text[] IS NULL OR d.tags ?| $5::text[])
          AND ($6::timestamptz IS NULL OR d."indexedAt" >= $6)
          AND ($7::timestamptz IS NULL OR d."indexedAt" <= $7)
        ORDER BY rank DESC, d."indexedAt" DESC
        LIMIT $8 OFFSET $9`,
      [
        organizationId,
        q,
        like,
        types && types.length > 0 ? types : null,
        tags && tags.length > 0 ? tags : null,
        from,
        to,
        pageSize,
        (page - 1) * pageSize,
      ],
    )

    const total = rows.length > 0 ? Number(rows[0].total) : 0
    return {
      items: rows.map((row) => ({
        id: String(row.id),
        resourceKey: String(row.resourceKey),
        resourceId: String(row.resourceId),
        title: String(row.title),
        snippet: String(row.snippet ?? ''),
        tags: Array.isArray(row.tags) ? row.tags : [],
        metadata: row.metadata ?? {},
        rank: Number(row.rank ?? 0),
        indexedAt: row.indexedAt,
      })),
      total,
      page,
      pageSize,
      tookMs: Date.now() - started,
    }
  }

  /** 按资源类型从真实表重新装配文档；找不到/已删除时移除索引。 */
  async indexResource(
    organizationId: string,
    resourceKey: SearchResourceKey,
    resourceId: string,
  ): Promise<{ indexed: boolean }> {
    if (resourceKey === 'announcement') {
      const row = await this.announcements.findOne({
        where: { id: resourceId, organizationId, deletedAt: IsNull() },
      })
      if (!row) {
        await this.remove(organizationId, resourceKey, resourceId)
        return { indexed: false }
      }
      const result = await this.upsert({
        organizationId,
        resourceKey,
        resourceId,
        title: row.title,
        body: row.body,
        tags: ['announcement', row.status, row.audienceType],
        metadata: { status: row.status, publishedAt: row.publishedAt },
      })
      return { indexed: result.indexed }
    }

    if (resourceKey === 'asset') {
      const row = await this.assets.findOne({ where: { id: resourceId, organizationId } })
      if (!row || row.status === 'deleted') {
        await this.remove(organizationId, resourceKey, resourceId)
        return { indexed: false }
      }
      const result = await this.upsert({
        organizationId,
        resourceKey,
        resourceId,
        title: row.originalName,
        body: String(row.metadata?.description ?? ''),
        tags: ['asset', row.kind, row.status],
        metadata: { kind: row.kind, status: row.status, mimeType: row.mimeType },
      })
      return { indexed: result.indexed }
    }

    if (resourceKey === 'ai_module') {
      const row = await this.aiModules.findOne({ where: { id: resourceId, organizationId } })
      if (!row) {
        await this.remove(organizationId, resourceKey, resourceId)
        return { indexed: false }
      }
      const result = await this.upsert({
        organizationId,
        resourceKey,
        resourceId,
        title: row.name,
        body: [row.description, row.naturalLanguagePrompt].filter(Boolean).join('\n'),
        tags: ['ai_module', row.status, ...(row.metadata?.entities ?? [])],
        metadata: { status: row.status, version: row.version },
      })
      return { indexed: result.indexed }
    }

    const entry = await this.knowledge.findOne({ where: { id: resourceId } })
    if (!entry || entry.status !== 'published') {
      await this.remove(organizationId, resourceKey, resourceId)
      return { indexed: false }
    }
    if (entry.organizationId && entry.organizationId !== organizationId) {
      await this.remove(organizationId, resourceKey, resourceId)
      return { indexed: false }
    }
    const result = await this.upsert({
      organizationId,
      resourceKey,
      resourceId,
      title: entry.title,
      body: entry.body,
      tags: ['knowledge', entry.scope, entry.knowledgeKey],
      metadata: { scope: entry.scope, version: entry.version },
    })
    return { indexed: result.indexed }
  }

  async reindexAll(organizationId: string): Promise<Record<SearchResourceKey, number>> {
    const counts: Record<SearchResourceKey, number> = {
      announcement: 0,
      asset: 0,
      ai_module: 0,
      agent_knowledge: 0,
    }
    const announcements = await this.announcements.find({
      where: { organizationId, deletedAt: IsNull() },
      select: ['id'],
    })
    for (const row of announcements) {
      const result = await this.indexResource(organizationId, 'announcement', row.id)
      if (result.indexed) counts.announcement += 1
    }
    const assets = await this.assets.find({ where: { organizationId }, select: ['id'] })
    for (const row of assets) {
      const result = await this.indexResource(organizationId, 'asset', row.id)
      if (result.indexed) counts.asset += 1
    }
    const aiModules = await this.aiModules.find({
      where: { organizationId },
      select: ['id'],
    })
    for (const row of aiModules) {
      const result = await this.indexResource(organizationId, 'ai_module', row.id)
      if (result.indexed) counts.ai_module += 1
    }
    const entries = await this.knowledge.find({
      where: { organizationId, status: 'published' },
      select: ['id'],
    })
    for (const row of entries) {
      const result = await this.indexResource(organizationId, 'agent_knowledge', row.id)
      if (result.indexed) counts.agent_knowledge += 1
    }
    return counts
  }
}
