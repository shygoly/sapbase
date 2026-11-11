import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { OBJECT_STORAGE, type ObjectStorage } from '../assets/object-storage'
import { AuditArchive } from './audit-archive.entity'
import { AuditChainService } from './audit-chain.service'
import { currentTransactionManager } from '../common/transaction/current-manager'

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
    @Optional()
    private readonly chain?: AuditChainService,
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

  async listArchives(organizationId: string): Promise<AuditArchive[]> {
    return this.archives.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    })
  }

  async restore(
    organizationId: string,
    archiveId: string,
    actor = 'system',
  ): Promise<{ restored: number; archiveId: string }> {
    if (!this.storage) {
      throw new ForbiddenException('未配置对象存储，无法恢复审计日志')
    }
    const archive = await this.archives.findOne({ where: { id: archiveId, organizationId } })
    if (!archive?.objectKey) {
      throw new ForbiddenException('归档不存在或不可恢复')
    }
    const buffer = await this.storage.get(archive.objectKey)
    const rows = buffer
      .toString('utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>)
    let restored = 0
    const runRestore = async (manager: import('typeorm').EntityManager) => {
      await manager.query(`SELECT set_config('app.audit_break_glass', 'on', true)`)
      for (const row of rows) {
        try {
          await manager.query(
            `INSERT INTO public.audit_logs (
               id, "createdAt", "updatedAt", "organizationId", action, resource, actor,
               "actorType", status, "resourceId", changes, metadata, timestamp,
               seq, "prevHash", hash, "hashAlgo", payload,
               "appInstallationId", ip, "userAgent", "correlationId", source,
               "retentionUntil", "legalHold", "archivedAt"
             ) VALUES ($1, now(), now(), $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb,
                       $11, $12, $13, $14, $15, $16::jsonb, $17, $18, $19, $20, $21, $22, $23, $24)
             ON CONFLICT (id) DO NOTHING`,
            [
              row.id,
              row.organizationId,
              row.action,
              row.resource,
              row.actor,
              row.actorType ?? 'user',
              row.status,
              row.resourceId ?? null,
              JSON.stringify(row.changes ?? null),
              JSON.stringify(row.metadata ?? null),
              row.timestamp,
              row.seq,
              row.prevHash,
              row.hash,
              row.hashAlgo ?? 'sha256',
              JSON.stringify(row.payload ?? null),
              row.appInstallationId ?? null,
              row.ip ?? null,
              row.userAgent ?? null,
              row.correlationId ?? null,
              row.source ?? null,
              row.retentionUntil ?? null,
              row.legalHold ?? false,
              row.archivedAt ?? null,
            ],
          )
          restored += 1
        } catch {
          // 已被清理或链冲突时跳过；恢复结果以实际插入为准。
        }
      }
    }
    const activeRestore = currentTransactionManager(this.dataSource)
    if (activeRestore) await runRestore(activeRestore)
    else await this.dataSource.transaction((manager) => runRestore(manager))
    await this.chain?.record({
      organizationId,
      action: 'audit.restore',
      resource: 'audit_log',
      actor,
      status: 'success',
      metadata: { archiveId, objectKey: archive.objectKey, restored },
      source: 'retention',
    })
    return { restored, archiveId }
  }

  async setLegalHold(input: {
    organizationId: string
    id: string
    legalHold: boolean
    actor: string
    reason?: string
  }): Promise<{ updated: boolean }> {
    const runHold = async (manager: import('typeorm').EntityManager) => {
      await manager.query(`SELECT set_config('app.audit_break_glass', 'on', true)`)
      const rows = (await manager.query(
        `UPDATE public.audit_logs SET "legalHold" = $3
          WHERE id = $1 AND "organizationId" = $2 RETURNING id`,
        [input.id, input.organizationId, input.legalHold],
      )) as Array<{ id: string }>
      return rows.length > 0
    }
    const activeHold = currentTransactionManager(this.dataSource)
    const updated = activeHold
      ? await runHold(activeHold)
      : await this.dataSource.transaction((manager) => runHold(manager))
    await this.chain?.record({
      organizationId: input.organizationId,
      action: 'audit.legal_hold',
      resource: 'audit_log',
      actor: input.actor,
      status: 'success',
      resourceId: input.id,
      metadata: { legalHold: input.legalHold, reason: input.reason ?? null },
      source: 'retention',
    })
    return { updated }
  }

  async cleanup(
    organizationId: string,
    now = new Date(),
    options: { actor?: string; reason?: string } = {},
  ): Promise<number> {
    const run = async (manager: import('typeorm').EntityManager) => {
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
    }
    const active = currentTransactionManager(this.dataSource)
    const deleted = active
      ? await run(active)
      : await this.dataSource.transaction((manager) => run(manager))
    // break-glass 必须留痕；独立于删除事务写回审计链。
    await this.chain?.record({
      organizationId,
      action: 'audit.break_glass',
      resource: 'audit_log',
      actor: options.actor ?? 'system',
      actorType: 'user',
      status: 'success',
      metadata: {
        deleted,
        reason: options.reason ?? 'retention-cleanup',
        at: now.toISOString(),
      },
      source: 'retention',
      legalHold: false,
    })
    return deleted
  }
}
