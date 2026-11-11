import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { randomUUID } from 'node:crypto'
import { Asset } from '@sap/platform-core/assets/asset.entity'
import { OBJECT_STORAGE, type ObjectStorage } from '@sap/platform-core/assets/object-storage'
import { Inject } from '@nestjs/common'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import {
  DocumentCandidate,
  DocumentParseRun,
  DocumentSection,
} from './document.entities'
import { DocumentParserRegistry, assertDocumentLimits } from './document-parser'
import { RuleStructureExtractor, type StructureExtractor } from './structure-extractor'

export interface DocumentActor {
  id: string
}

@Injectable()
export class DocumentIntelligenceService {
  constructor(
    @InjectRepository(DocumentParseRun)
    private readonly runs: Repository<DocumentParseRun>,
    @InjectRepository(DocumentSection)
    private readonly sections: Repository<DocumentSection>,
    @InjectRepository(DocumentCandidate)
    private readonly candidates: Repository<DocumentCandidate>,
    @InjectRepository(Asset)
    private readonly assets: Repository<Asset>,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly parsers: DocumentParserRegistry,
    private readonly extractor: RuleStructureExtractor,
    private readonly dataSource: DataSource,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async createRun(
    organizationId: string,
    actor: DocumentActor,
    input: { assetId: string; options?: Record<string, unknown> },
  ): Promise<DocumentParseRun> {
    const asset = await this.assets.findOne({
      where: { id: input.assetId, organizationId },
    })
    if (!asset) throw new NotFoundException('文档资产不存在')
    if (asset.status !== 'ready') throw new ConflictException(`资产未就绪：${asset.status}`)
    const run = await this.runs.save(
      this.runs.create({
        organizationId,
        assetId: asset.id,
        status: 'queued',
        stage: null,
        progress: 0,
        parser: null,
        sourceName: asset.originalName,
        pageCount: 0,
        draftVersion: 1,
        confirmedVersion: null,
        error: null,
        options: input.options ?? {},
        createdBy: actor.id,
      }),
    )
    await this.audit(organizationId, actor.id, 'document.run', {
      runId: run.id,
      assetId: asset.id,
      mimeType: asset.mimeType,
    })
    return run
  }

  async processRun(
    organizationId: string,
    runId: string,
    onProgress?: (stage: string, progress: number) => Promise<void>,
  ): Promise<DocumentParseRun> {
    const run = await this.getRun(organizationId, runId)
    const asset = await this.assets.findOne({
      where: { id: run.assetId, organizationId },
    })
    if (!asset) throw new NotFoundException('文档资产不存在')
    run.status = 'running'
    run.stage = 'loading'
    run.progress = 5
    run.error = null
    await this.runs.save(run)
    await onProgress?.('loading', 5)

    try {
      const parser = this.parsers.resolve(asset.mimeType, asset.originalName)
      const buffer = await this.storage.get(asset.objectKey)
      assertDocumentLimits(buffer, 0)
      run.parser = parser.name
      run.stage = 'parsing'
      run.progress = 25
      await this.runs.save(run)
      await onProgress?.('parsing', 25)
      const parsed = await parser.parse(buffer)
      assertDocumentLimits(buffer, parsed.pages.length)
      run.pageCount = parsed.pages.length
      run.stage = 'extracting'
      run.progress = 65
      await this.runs.save(run)
      await onProgress?.('extracting', 65)
      const structured = await this.extractor.extract(parsed)

      await this.dataSource.transaction(async (manager) => {
        await manager.delete(DocumentSection, { organizationId, runId })
        await manager.delete(DocumentCandidate, { organizationId, runId })
        for (const section of structured.sections) {
          await manager.save(
            DocumentSection,
            manager.create(DocumentSection, {
              organizationId,
              runId,
              key: section.key,
              parentKey: section.parentKey,
              title: section.title,
              level: section.level,
              ordinal: section.ordinal,
              content: section.content,
              pageNumber: section.pageNumber,
              anchor: section.anchor,
              metadata: section.metadata,
            }),
          )
        }
        for (const candidate of structured.candidates) {
          await manager.save(
            DocumentCandidate,
            manager.create(DocumentCandidate, {
              organizationId,
              runId,
              key: candidate.key,
              sectionKey: candidate.sectionKey,
              kind: candidate.kind,
              title: candidate.title,
              body: candidate.body,
              confidence: candidate.confidence.toFixed(2),
              anchor: candidate.anchor,
              status: 'pending',
              metadata: candidate.metadata,
            }),
          )
        }
        run.status = 'succeeded'
        run.stage = 'done'
        run.progress = 100
        run.draftVersion = run.draftVersion || 1
        await manager.save(DocumentParseRun, run)
      })
      await this.audit(organizationId, run.createdBy ?? 'system', 'document.run', {
        runId,
        status: 'succeeded',
        parser: parser.name,
        pages: parsed.pages.length,
        sections: structured.sections.length,
        candidates: structured.candidates.length,
      })
      return run
    } catch (error) {
      run.status = 'failed'
      run.stage = 'failed'
      run.error = error instanceof Error ? error.message : String(error)
      await this.runs.save(run)
      await this.audit(organizationId, run.createdBy ?? 'system', 'document.run', {
        runId,
        status: 'failed',
        error: run.error,
      })
      throw error
    }
  }

  async getRun(organizationId: string, id: string): Promise<DocumentParseRun> {
    const run = await this.runs.findOne({ where: { id, organizationId } })
    if (!run) throw new NotFoundException('解析运行不存在')
    return run
  }

  async listRuns(organizationId: string): Promise<DocumentParseRun[]> {
    return this.runs.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    })
  }

  async getSections(organizationId: string, runId: string): Promise<DocumentSection[]> {
    await this.getRun(organizationId, runId)
    return this.sections.find({
      where: { organizationId, runId },
      order: { ordinal: 'ASC' },
    })
  }

  async getCandidates(organizationId: string, runId: string): Promise<DocumentCandidate[]> {
    await this.getRun(organizationId, runId)
    return this.candidates.find({
      where: { organizationId, runId },
      order: { createdAt: 'ASC' },
    })
  }

  async getDraft(organizationId: string, runId: string) {
    const run = await this.getRun(organizationId, runId)
    return {
      run,
      sections: await this.getSections(organizationId, runId),
      candidates: await this.getCandidates(organizationId, runId),
    }
  }

  async updateCandidate(
    organizationId: string,
    actor: DocumentActor,
    id: string,
    input: Partial<Pick<DocumentCandidate, 'title' | 'body' | 'status' | 'confidence'>>,
  ): Promise<DocumentCandidate> {
    const row = await this.candidates.findOne({ where: { id, organizationId } })
    if (!row) throw new NotFoundException('候选不存在')
    if (input.status && !['pending', 'accepted', 'rejected'].includes(input.status)) {
      throw new BadRequestException('status 非法')
    }
    Object.assign(row, input)
    const saved = await this.candidates.save(row)
    await this.bumpDraft(organizationId, row.runId)
    await this.audit(organizationId, actor.id, 'document.edit', {
      runId: row.runId,
      candidateId: id,
      change: 'candidate',
    })
    return saved
  }

  async confirmCandidates(
    organizationId: string,
    actor: DocumentActor,
    runId: string,
    keys?: string[],
  ): Promise<{ accepted: number }> {
    const run = await this.getRun(organizationId, runId)
    const query = this.candidates
      .createQueryBuilder()
      .update(DocumentCandidate)
      .set({ status: 'accepted' })
      .where('"organizationId" = :organizationId AND "runId" = :runId', {
        organizationId,
        runId,
      })
      .andWhere('"status" = :status', { status: 'pending' })
    if (keys && keys.length > 0) query.andWhere('"key" = ANY(:keys)', { keys })
    const result = await query.execute()
    await this.bumpDraft(organizationId, run.id)
    await this.audit(organizationId, actor.id, 'document.edit', {
      runId,
      change: 'confirm-candidates',
      accepted: result.affected ?? 0,
    })
    return { accepted: result.affected ?? 0 }
  }

  async mergeSections(
    organizationId: string,
    actor: DocumentActor,
    runId: string,
    input: { sourceKey: string; targetKey: string },
  ) {
    const [source, target] = await Promise.all([
      this.sections.findOne({ where: { organizationId, runId, key: input.sourceKey } }),
      this.sections.findOne({ where: { organizationId, runId, key: input.targetKey } }),
    ])
    if (!source || !target) throw new NotFoundException('章节不存在')
    target.content = `${target.content}\n${source.content}`.trim()
    target.metadata = {
      ...target.metadata,
      mergedFrom: [...((target.metadata.mergedFrom as string[]) ?? []), source.key],
      sourceAnchors: [
        ...((target.metadata.sourceAnchors as Array<Record<string, unknown>>) ?? []),
        source.anchor,
      ],
    }
    await this.sections.save(target)
    await this.candidates.update(
      { organizationId, runId, sectionKey: source.key },
      { sectionKey: target.key },
    )
    await this.sections.delete({ id: source.id, organizationId })
    await this.bumpDraft(organizationId, runId)
    await this.audit(organizationId, actor.id, 'document.edit', {
      runId,
      change: 'merge',
      sourceKey: source.key,
      targetKey: target.key,
    })
    return target
  }

  async splitSection(
    organizationId: string,
    actor: DocumentActor,
    runId: string,
    input: { sectionKey: string; at: number; title?: string },
  ) {
    const source = await this.sections.findOne({
      where: { organizationId, runId, key: input.sectionKey },
    })
    if (!source) throw new NotFoundException('章节不存在')
    if (input.at <= 0 || input.at >= source.content.length) {
      throw new BadRequestException('at 必须在章节内容范围内')
    }
    const left = source.content.slice(0, input.at)
    const right = source.content.slice(input.at)
    source.content = left
    const key = `s-${randomUUID().slice(0, 8)}`
    const created = await this.sections.save(
      this.sections.create({
        organizationId,
        runId,
        key,
        parentKey: source.parentKey,
        title: input.title ?? `${source.title}（续）`,
        level: source.level,
        ordinal: source.ordinal + 1,
        content: right,
        pageNumber: source.pageNumber,
        anchor: {
          ...source.anchor,
          offset: Number(source.anchor.offset ?? 0) + input.at,
          quote: right.slice(0, 200),
        },
        metadata: { ...source.metadata, splitFrom: source.key },
      }),
    )
    await this.sections.save(source)
    await this.bumpDraft(organizationId, runId)
    await this.audit(organizationId, actor.id, 'document.edit', {
      runId,
      change: 'split',
      sourceKey: source.key,
      newKey: key,
    })
    return created
  }

  async reorderSections(
    organizationId: string,
    actor: DocumentActor,
    runId: string,
    keys: string[],
  ) {
    for (const [index, key] of keys.entries()) {
      await this.sections.update({ organizationId, runId, key }, { ordinal: index })
    }
    await this.bumpDraft(organizationId, runId)
    await this.audit(organizationId, actor.id, 'document.edit', { runId, change: 'reorder' })
    return this.getSections(organizationId, runId)
  }

  async confirm(organizationId: string, actor: DocumentActor, runId: string) {
    const run = await this.getRun(organizationId, runId)
    if (run.status !== 'succeeded') throw new ConflictException('解析尚未完成')
    run.confirmedVersion = run.draftVersion
    const saved = await this.runs.save(run)
    await this.audit(organizationId, actor.id, 'document.edit', {
      runId,
      change: 'confirm',
      draftVersion: run.draftVersion,
    })
    return saved
  }

  async convert(
    organizationId: string,
    actor: DocumentActor,
    runId: string,
    input: {
      targetResourceKey: 'knowledge' | 'course' | 'section'
      packageId?: string
      entity?: string
    },
  ) {
    const run = await this.getRun(organizationId, runId)
    if (run.confirmedVersion !== run.draftVersion) {
      throw new ConflictException('必须确认当前 draftVersion 后才能转换')
    }
    const candidates = await this.candidates.find({
      where: { organizationId, runId, status: 'accepted' },
    })
    if (candidates.length === 0) throw new ConflictException('没有已确认候选')
    const converted: Array<{ candidateId: string; entityId: string }> = []
    for (const candidate of candidates) {
      if (candidate.targetEntityId) {
        if (candidate.targetResourceKey !== input.targetResourceKey) {
          throw new ConflictException(`候选 ${candidate.key} 已转换到其他资源`)
        }
        converted.push({ candidateId: candidate.id, entityId: candidate.targetEntityId })
        continue
      }
      let entityId: string
      if (input.targetResourceKey === 'knowledge') {
        entityId = randomUUID()
        await this.dataSource.query(
          `INSERT INTO public.agent_knowledge_entries
            (id,"createdAt","updatedAt","organizationId",scope,"scopeId","knowledgeKey",version,title,body,status,"releaseId","sensitiveReview")
           VALUES ($1,now(),now(),$2,'organization',$2,$3,1,$4,$5,'draft',NULL,$6::jsonb)`,
          [
            entityId,
            organizationId,
            `doc-${runId}-${candidate.key}`,
            candidate.title,
            candidate.body,
            JSON.stringify({
              source: 'document-intelligence',
              runId,
              anchor: candidate.anchor,
              untrusted: true,
            }),
          ],
        )
      } else {
        if (!input.packageId) throw new BadRequestException('course 转换必须提供 packageId')
        entityId = randomUUID()
        const entity = input.entity ?? 'CourseSection'
        await this.dataSource.query(
          `INSERT INTO public.blueprint_records
            (id,"createdAt","updatedAt","organizationId","blueprintId","blueprintVersion",entity,data,state,version)
           VALUES ($1,now(),now(),$2,$3,'1.0.0',$4,$5::jsonb,'active',1)`,
          [
            entityId,
            organizationId,
            input.packageId,
            entity,
            JSON.stringify({
              title: candidate.title,
              content: candidate.body,
              sourceRunId: runId,
              sourceAnchor: candidate.anchor,
              candidateKey: candidate.key,
            }),
          ],
        )
      }
      candidate.targetResourceKey = input.targetResourceKey
      candidate.targetEntityId = entityId
      candidate.convertedAt = new Date()
      await this.candidates.save(candidate)
      converted.push({ candidateId: candidate.id, entityId })
    }
    await this.audit(organizationId, actor.id, 'document.convert', {
      runId,
      targetResourceKey: input.targetResourceKey,
      converted: converted.length,
    })
    return { runId, targetResourceKey: input.targetResourceKey, converted }
  }

  async cancel(organizationId: string, actor: DocumentActor, runId: string) {
    const run = await this.getRun(organizationId, runId)
    if (run.status === 'succeeded') throw new ConflictException('已完成运行不能取消')
    run.status = 'cancelled'
    run.stage = 'cancelled'
    const saved = await this.runs.save(run)
    await this.audit(organizationId, actor.id, 'document.run', { runId, status: 'cancelled' })
    return saved
  }

  private async bumpDraft(organizationId: string, runId: string) {
    await this.runs.increment({ id: runId, organizationId }, 'draftVersion', 1)
  }

  private async audit(
    organizationId: string,
    actor: string,
    action: string,
    metadata: Record<string, unknown>,
  ) {
    await this.auditLogs.create({
      organizationId,
      action,
      resource: 'document',
      actor,
      status: 'success',
      metadata,
      source: 'document-intelligence',
    })
  }
}
