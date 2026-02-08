import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLog } from './audit-log.entity'

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

  async findAll(): Promise<AuditLog[]> {
    return this.auditLogsRepository.find({
      order: {
        timestamp: 'DESC',
      },
    })
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
