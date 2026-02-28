import { createHash } from 'crypto'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, FindOptionsWhere, Repository } from 'typeorm'
import { CreateLabAuditLogDto } from './dto/create-lab-audit-log.dto'
import { QueryLabAuditLogDto } from './dto/query-lab-audit-log.dto'
import { LabAuditLog } from './lab-audit-log.entity'

@Injectable()
export class AuditContextService {
  constructor(
    @InjectRepository(LabAuditLog)
    private readonly auditRepository: Repository<LabAuditLog>,
  ) {}

  async append(
    dto: CreateLabAuditLogDto,
    actorId: string | undefined,
    organizationId: string,
  ): Promise<LabAuditLog> {
    const digest = createHash('sha256')
      .update(
        JSON.stringify({
          organizationId,
          actorId: actorId ?? null,
          action: dto.action,
          entityType: dto.entityType,
          entityId: dto.entityId,
          details: dto.details ?? null,
          at: Date.now(),
        }),
      )
      .digest('hex')

    const log = this.auditRepository.create({
      actorId: actorId ?? null,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId,
      message: dto.message ?? null,
      details: dto.details ?? null,
      digest,
      organizationId,
    })

    return this.auditRepository.save(log)
  }

  async query(filters: QueryLabAuditLogDto, organizationId: string): Promise<LabAuditLog[]> {
    const where: FindOptionsWhere<LabAuditLog> = { organizationId }

    if (filters.action) where.action = filters.action
    if (filters.entityType) where.entityType = filters.entityType
    if (filters.entityId) where.entityId = filters.entityId

    if (filters.from || filters.to) {
      const from = filters.from ? new Date(filters.from) : new Date('1970-01-01')
      const to = filters.to ? new Date(filters.to) : new Date('9999-12-31')
      where.eventAt = Between(from, to)
    }

    return this.auditRepository.find({
      where,
      order: { eventAt: 'DESC' },
      take: 500,
    })
  }

  async exportCsv(filters: QueryLabAuditLogDto, organizationId: string): Promise<string> {
    const logs = await this.query(filters, organizationId)
    const rows = logs.map((log) => {
      const escapedMessage = (log.message ?? '').replace(/"/g, '""')
      return [
        log.id,
        log.eventAt.toISOString(),
        log.actorId ?? '',
        log.action,
        log.entityType,
        log.entityId,
        `"${escapedMessage}"`,
        log.digest,
      ].join(',')
    })

    return ['id,eventAt,actorId,action,entityType,entityId,message,digest', ...rows].join('\n')
  }
}
