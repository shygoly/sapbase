import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AIModule as AIModuleOrm, AIModuleStatus as AIModuleStatusOrm } from '../../../ai-modules/ai-module.entity'
import { AIModule, AIModuleStatus } from '../../domain/entities'
import type { IAIModuleRepository } from '../../domain/repositories'

@Injectable()
export class AIModuleRepository implements IAIModuleRepository {
  constructor(
    @InjectRepository(AIModuleOrm)
    private readonly repo: Repository<AIModuleOrm>,
  ) {}

  async findById(id: string, organizationId: string): Promise<AIModule | null> {
    const row = await this.repo.findOne({
      where: { id, organizationId },
    })
    if (!row) return null
    return this.toDomain(row)
  }

  async findAll(organizationId: string, status?: string): Promise<AIModule[]> {
    const where: any = { organizationId }
    if (status) {
      where.status = this.mapStatusFromDomain(status as AIModuleStatus)
    }
    const rows = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
    })
    return rows.map((row) => this.toDomain(row))
  }

  async save(module: AIModule): Promise<void> {
    const existing = await this.repo.findOne({
      where: { id: module.id, organizationId: module.organizationId },
    })

    const status = this.mapStatus(module.status)

    if (existing) {
      existing.name = module.name
      ;(existing as any).description = module.description ?? undefined
      ;(existing as any).naturalLanguagePrompt = module.naturalLanguagePrompt ?? undefined
      existing.patchContent = module.patchContent as any
      existing.status = status
      existing.version = module.version
      ;(existing as any).aiModelId = module.aiModelId ?? undefined
      ;(existing as any).createdById = module.createdById ?? undefined
      ;(existing as any).reviewedById = module.reviewedById ?? undefined
      ;(existing as any).reviewedAt = module.reviewedAt ?? undefined
      ;(existing as any).reviewComments = module.reviewComments ?? undefined
      ;(existing as any).publishedAt = module.publishedAt ?? undefined
      ;(existing as any).unpublishedAt = module.unpublishedAt ?? undefined
      ;(existing as any).testResults = module.testResults ?? undefined
      ;(existing as any).metadata = module.metadata ?? undefined
      await this.repo.save(existing)
    } else {
      await this.repo.save({
        id: module.id,
        organizationId: module.organizationId,
        name: module.name,
        description: module.description ?? undefined,
        naturalLanguagePrompt: module.naturalLanguagePrompt ?? undefined,
        patchContent: module.patchContent,
        status,
        version: module.version,
        aiModelId: module.aiModelId ?? undefined,
        createdById: module.createdById ?? undefined,
        reviewedById: module.reviewedById ?? undefined,
        reviewedAt: module.reviewedAt ?? undefined,
        reviewComments: module.reviewComments ?? undefined,
        publishedAt: module.publishedAt ?? undefined,
        unpublishedAt: module.unpublishedAt ?? undefined,
        testResults: module.testResults ?? undefined,
        metadata: module.metadata ?? undefined,
      } as any)
    }
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.repo.delete({ id, organizationId })
  }

  private toDomain(row: AIModuleOrm): AIModule {
    return AIModule.fromPersistence(
      row.id,
      row.organizationId,
      row.name,
      row.description ?? null,
      row.naturalLanguagePrompt ?? null,
      row.patchContent as Record<string, any>,
      this.mapStatusFromOrm(row.status),
      row.version,
      row.aiModelId ?? null,
      row.createdById ?? null,
      row.reviewedById ?? null,
      row.reviewedAt ?? null,
      row.reviewComments ?? null,
      row.publishedAt ?? null,
      row.unpublishedAt ?? null,
      (row.testResults as Record<string, any>) ?? null,
      (row.metadata as Record<string, any>) ?? null,
    )
  }

  private mapStatus(status: AIModuleStatus): AIModuleStatusOrm {
    const map: Record<AIModuleStatus, AIModuleStatusOrm> = {
      [AIModuleStatus.DRAFT]: AIModuleStatusOrm.DRAFT,
      [AIModuleStatus.TESTING]: AIModuleStatusOrm.TESTING,
      [AIModuleStatus.PENDING_REVIEW]: AIModuleStatusOrm.PENDING_REVIEW,
      [AIModuleStatus.REVIEWING]: AIModuleStatusOrm.REVIEWING,
      [AIModuleStatus.APPROVED]: AIModuleStatusOrm.APPROVED,
      [AIModuleStatus.REJECTED]: AIModuleStatusOrm.REJECTED,
      [AIModuleStatus.PUBLISHED]: AIModuleStatusOrm.PUBLISHED,
      [AIModuleStatus.UNPUBLISHED]: AIModuleStatusOrm.UNPUBLISHED,
    }
    return map[status]
  }

  private mapStatusFromOrm(status: AIModuleStatusOrm): AIModuleStatus {
    const map: Record<AIModuleStatusOrm, AIModuleStatus> = {
      [AIModuleStatusOrm.DRAFT]: AIModuleStatus.DRAFT,
      [AIModuleStatusOrm.TESTING]: AIModuleStatus.TESTING,
      [AIModuleStatusOrm.PENDING_REVIEW]: AIModuleStatus.PENDING_REVIEW,
      [AIModuleStatusOrm.REVIEWING]: AIModuleStatus.REVIEWING,
      [AIModuleStatusOrm.APPROVED]: AIModuleStatus.APPROVED,
      [AIModuleStatusOrm.REJECTED]: AIModuleStatus.REJECTED,
      [AIModuleStatusOrm.PUBLISHED]: AIModuleStatus.PUBLISHED,
      [AIModuleStatusOrm.UNPUBLISHED]: AIModuleStatus.UNPUBLISHED,
    }
    return map[status]
  }

  private mapStatusFromDomain(status: AIModuleStatus): AIModuleStatusOrm {
    return this.mapStatus(status)
  }
}
