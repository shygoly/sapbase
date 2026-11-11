import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, SelectQueryBuilder } from 'typeorm'
import { AuditLog } from './audit-log.entity'
import { AuditLogFilterDto } from './dto/audit-log-filter.dto'
import { PaginatedResult } from '../common'
import { AuditChainService } from './audit-chain.service'
import type { AuditChainInput } from './audit-chain'
import {
  resolveRetentionUntil,
  validateAuditEvent,
} from './audit-event-catalog'

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogsRepository: Repository<AuditLog>,
    @Optional() private readonly chain?: AuditChainService,
  ) {}

  async create(auditLog: Partial<AuditLog>): Promise<AuditLog> {
    const action = auditLog.action ?? 'unknown'
    const validation = validateAuditEvent({
      action,
      actor: auditLog.actor,
      resourceId: auditLog.resourceId,
    })
    if (validation.missing.length > 0) {
      throw new BadRequestException(
        `审计事件 ${action} 缺少必填字段：${validation.missing.join(', ')}`,
      )
    }
    const metadata = {
      ...(auditLog.metadata ?? {}),
      ...(validation.unknown ? { auditUnknownAction: true } : {}),
    }
    const retentionClass = validation.definition?.retentionClass ?? 'standard'
    const retentionUntil =
      auditLog.retentionUntil ??
      (auditLog.legalHold
        ? null
        : resolveRetentionUntil(retentionClass, auditLog.timestamp ?? new Date()))
    if (this.chain && auditLog.organizationId) {
      const row = await this.chain.record({
        organizationId: auditLog.organizationId,
        action,
        resource: auditLog.resource ?? validation.definition?.resource ?? 'unknown',
        actor: auditLog.actor ?? 'system',
        actorType: auditLog.actorType,
        status: auditLog.status ?? 'success',
        resourceId: auditLog.resourceId ?? null,
        changes: auditLog.changes ?? null,
        metadata,
        appInstallationId: auditLog.appInstallationId ?? null,
        ip: auditLog.ip ?? null,
        userAgent: auditLog.userAgent ?? null,
        correlationId: auditLog.correlationId ?? null,
        source: auditLog.source ?? (validation.unknown ? 'custom' : null),
        timestamp: auditLog.timestamp ?? new Date(),
        retentionUntil,
        legalHold: auditLog.legalHold ?? false,
      } satisfies AuditChainInput)
      return this.auditLogsRepository.create(row as unknown as Partial<AuditLog>)
    }
    const log = this.auditLogsRepository.create({
      ...auditLog,
      action,
      metadata,
      source: auditLog.source ?? (validation.unknown ? 'custom' : null),
      retentionUntil,
    })
    return this.auditLogsRepository.save(log)
  }

  /**
   * 失败审计单独事务：调用方业务事务回滚时仍必须留下失败记录。
   * 这里不开调用方事务；链写入自管事务。
   */
  async recordFailure(input: {
    organizationId: string
    action: string
    resource: string
    actor: string
    resourceId?: string | null
    error: string
    correlationId?: string | null
  }): Promise<AuditLog> {
    return this.create({
      organizationId: input.organizationId,
      action: input.action,
      resource: input.resource,
      actor: input.actor,
      status: 'failure',
      resourceId: input.resourceId ?? undefined,
      metadata: { error: input.error },
      correlationId: input.correlationId ?? null,
    })
  }

  async findAll(
    filter?: AuditLogFilterDto,
  ): Promise<PaginatedResult<AuditLog>> {
    const page = filter?.page || 1
    const pageSize = filter?.pageSize || 10
    const skip = (page - 1) * pageSize

    if (!filter?.organizationId) {
      throw new BadRequestException('organizationId 必填')
    }
    let query = this.auditLogsRepository
      .createQueryBuilder('audit_log')
      .where('audit_log.organizationId = :organizationId', {
        organizationId: filter.organizationId,
      })

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
    if (filter?.source) {
      query = query.andWhere('audit_log.source = :source', { source: filter.source })
    }
    if (filter?.actorType) {
      query = query.andWhere('audit_log.actorType = :actorType', {
        actorType: filter.actorType,
      })
    }
    if (filter?.correlationId) {
      query = query.andWhere('audit_log.correlationId = :correlationId', {
        correlationId: filter.correlationId,
      })
    }
    if (filter?.status) {
      query = query.andWhere('audit_log.status = :status', { status: filter.status })
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
      data: data.map((row) => redactAuditLog(row)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  async findOne(id: string, organizationId: string): Promise<AuditLog> {
    const log = await this.auditLogsRepository.findOne({
      where: { id, organizationId },
    })

    if (!log) {
      throw new NotFoundException(`Audit log with ID ${id} not found`)
    }

    return redactAuditLog(log)
  }
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'apikey',
  'api_key',
  'cookie',
  'credential',
  'privatekey',
  'private_key',
])

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = '[REDACTED]'
    } else {
      out[key] = redact(item)
    }
  }
  return out
}

export function redactAuditLog(row: AuditLog): AuditLog {
  return {
    ...row,
    changes: row.changes ? (redact(row.changes) as Record<string, unknown>) : row.changes,
    metadata: row.metadata ? (redact(row.metadata) as Record<string, unknown>) : row.metadata,
    payload: row.payload ? (redact(row.payload) as Record<string, unknown>) : row.payload,
  }
}
