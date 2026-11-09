import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { OBJECT_STORAGE, type ObjectStorage } from '../assets/object-storage'
import { AuditArchive } from './audit-archive.entity'

export interface ArchiveResult {
  archived: number
  fromSeq: string | null
  toSeq: string | null
  objectKey: string | null
}

/**
 * 审计归档/保留期清理。
 *
 * 归档先写对象存储（JSONL），再标记 archivedAt；清理只删已归档、非 legalHold、
 * 已过 retentionUntil 的行，并在 break-glass 事务内执行（append-only 触发器例外）。
 */
@Injectable()
export class AuditRetentionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AuditArchive)
    private readonly archives: Repository<AuditArchive>,
    @Optional()
    @Inject(OBJECT_STORAGE)
    private readonly storage?: ObjectStorage,
  ) {}

  async archive(organizationId: string, toSeq: number): Promise<ArchiveResult> {
    if (!this.storage) {
      throw new ForbiddenException('未配置对象存储，无法归档审计日志')
    }
    const rows = (await this.dataSource.query(
      `SELECT * FROM public.audit_logs
        WHERE "organizationId" = $1 AND seq IS NOT NULL AND seq <= $2
          AND "archivedAt" IS NULL
        ORDER BY seq ASC`,
      [organizationId, toSeq],
    )) as Array<Record<string, unknown>>
    if (rows.length === 0) {
      return { archived: 0, fromSeq: null, toSeq: null, objectKey: null }
    }
    const fromSeq = String(rows[0].seq)
    const lastSeq = String(rows[rows.length - 1].seq)
    const jsonl = rows.map((row) => JSON.stringify(row)).join('\n')
    const objectKey = `org/${organizationId}/audit/archives/${fromSeq}-${lastSeq}.jsonl`
    await this.storage.put(objectKey, Buffer.from(jsonl), {
      contentType: 'application/x-ndjson',
    })
    const manifest = {
      organizationId,
      fromSeq,
      toSeq: lastSeq,
      count: rows.length,
      firstHash: rows[0].hash ?? null,
      lastHash: rows[rows.length - 1].hash ?? null,
      sha256: (await this.storage.head(objectKey))?.checksum ?? null,
    }
    await this.archives.save(
      this.archives.create({
        organizationId,
        fromSeq,
        toSeq: lastSeq,
        objectKey,
        manifest,
        status: 'archived',
      }),
    )
    await this.dataSource.query(
      `UPDATE public.audit_logs SET "archivedAt" = now()
        WHERE "organizationId" = $1 AND seq >= $2 AND seq <= $3`,
      [organizationId, fromSeq, lastSeq],
    )
    return { archived: rows.length, fromSeq, toSeq: lastSeq, objectKey }
  }

  async cleanup(organizationId: string, now = new Date()): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT set_config('app.audit_break_glass', 'on', true)`)
      const rows = (await manager.query(
        `DELETE FROM public.audit_logs
          WHERE "organizationId" = $1
            AND "retentionUntil" IS NOT NULL
            AND "retentionUntil" < $2
            AND "legalHold" = false
            AND "archivedAt" IS NOT NULL
          RETURNING id`,
        [organizationId, now],
      )) as Array<{ id: string }>
      return rows.length
    })
  }
}
