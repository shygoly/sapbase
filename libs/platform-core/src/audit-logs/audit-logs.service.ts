import { Injectable, NotFoundException, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, SelectQueryBuilder } from 'typeorm'
import { AuditLog } from './audit-log.entity'
import { AuditLogFilterDto } from './dto/audit-log-filter.dto'
import { PaginatedResult } from '../common'
import { AuditChainService } from './audit-chain.service'
import type { AuditChainInput } from './audit-chain'

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogsRepository: Repository<AuditLog>,
    @Optional() private readonly chain?: AuditChainService,
  ) {}

  async create(auditLog: Partial<AuditLog>): Promise<AuditLog> {
    if (this.chain && auditLog.organizationId) {
      const row = await this.chain.record({
        organizationId: auditLog.organizationId,
        action: auditLog.action ?? 'unknown',
        resource: auditLog.resource ?? 'unknown',
        actor: auditLog.actor ?? 'system',
        actorType: auditLog.actorType,
        status: auditLog.status ?? 'success',
        resourceId: auditLog.resourceId ?? null,
        changes: auditLog.changes ?? null,
        metadata: auditLog.metadata ?? null,
        appInstallationId: auditLog.appInstallationId ?? null,
        ip: auditLog.ip ?? null,
        userAgent: auditLog.userAgent ?? null,
        correlationId: auditLog.correlationId ?? null,
        source: auditLog.source ?? null,
        timestamp: auditLog.timestamp ?? new Date(),
        retentionUntil: auditLog.retentionUntil ?? null,
        legalHold: auditLog.legalHold ?? false,
      } satisfies AuditChainInput)
      return this.auditLogsRepository.create(row as unknown as Partial<AuditLog>)
    }
    const log = this.auditLogsRepository.create(auditLog)
    return this.auditLogsRepository.save(log)
  }

  async findAll(
    filter?: AuditLogFilterDto,
  ): Promise<PaginatedResult<AuditLog>> {
    const page = filter?.page || 1
    const pageSize = filter?.pageSize || 10
    const skip = (page - 1) * pageSize

    let query = this.auditLogsRepository.createQueryBuilder('audit_log')

    // Apply filters
    if (filter?.actor) {
      query = query.andWhere('audit_log.actor ILIKE :actor', {
        actor: `%${filter.actor}%`,
      })
    }

    if (filter?.action) {
      query = query.andWhere('audit_log.action ILIKE :action', {
        action: `%${filter.action}%`,
      })
    }

    if (filter?.resource) {
      query = query.andWhere('audit_log.resource ILIKE :resource', {
        resource: `%${filter.resource}%`,
      })
    }

    if (filter?.resourceId) {
      query = query.andWhere('audit_log.resourceId = :resourceId', {
        resourceId: filter.resourceId,
      })
    }

    if (filter?.startDate) {
      query = query.andWhere('audit_log.timestamp >= :startDate', {
        startDate: new Date(filter.startDate),
      })
    }

    if (filter?.endDate) {
      query = query.andWhere('audit_log.timestamp <= :endDate', {
        endDate: new Date(filter.endDate),
      })
    }

    // Get total count
    const total = await query.getCount()

    // Apply pagination and sorting
    const data = await query
      .orderBy('audit_log.timestamp', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getMany()

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  async findOne(id: string): Promise<AuditLog> {
    const log = await this.auditLogsRepository.findOne({
      where: { id },
    })

    if (!log) {
      throw new NotFoundException(`Audit log with ID ${id} not found`)
    }

    return log
  }
}
