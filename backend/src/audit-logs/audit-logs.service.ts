import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, SelectQueryBuilder } from 'typeorm'
import { AuditLog } from './audit-log.entity'
import { AuditLogFilterDto } from './dto/audit-log-filter.dto'
import { PaginatedResult } from '../common'

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogsRepository: Repository<AuditLog>,
  ) {}

  async create(auditLog: Partial<AuditLog>): Promise<AuditLog> {
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
