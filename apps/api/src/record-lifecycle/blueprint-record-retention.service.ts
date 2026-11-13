import { BadRequestException, Injectable, Optional } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'

export interface BlueprintRecordRetentionStats {
  organizationId: string
  totalRows: number
  activeRows: number
  archivedRows: number
  oldestArchivedAt: string | null
  tableBytes: number
}

export interface PruneResult {
  organizationId: string
  dryRun: boolean
  olderThanDays: number
  cutoff: string
  batch: number
  candidates: number
  deleted: number
  hasMore: boolean
}

const DEFAULT_RETENTION_DAYS = 365
const DEFAULT_BATCH = 1_000
const MIN_RETENTION_DAYS = 30

/**
 * `blueprint_records` 保留策略（6.7）。
 *
 * 只删除**已归档**且超过保留期的行；active 行永不删除。默认 365 天、
 * 每批 1000 行；dry-run 先给出候选数。分区不在当前规模启用：
 * `recommendPartition()` 按行数/表大小阈值给出触发条件。
 */
@Injectable()
export class BlueprintRecordRetentionService {
  constructor(
    private readonly dataSource: DataSource,
    @Optional() private readonly auditLogs?: AuditLogsService,
  ) {}

  async stats(organizationId: string): Promise<BlueprintRecordRetentionStats> {
    if (!organizationId) throw new BadRequestException('缺少组织上下文')
    const rows = (await this.dataSource.query(
      `SELECT
         COUNT(*)::int AS "totalRows",
         COUNT(*) FILTER (WHERE "archivedAt" IS NULL)::int AS "activeRows",
         COUNT(*) FILTER (WHERE "archivedAt" IS NOT NULL)::int AS "archivedRows",
         MIN("archivedAt") AS "oldestArchivedAt",
         pg_total_relation_size('public.blueprint_records')::bigint AS "tableBytes"
       FROM public.blueprint_records
      WHERE "organizationId" = $1`,
      [organizationId],
    )) as Array<Record<string, unknown>>
    const row = rows[0] ?? {}
    return {
      organizationId,
      totalRows: Number(row.totalRows ?? 0),
      activeRows: Number(row.activeRows ?? 0),
      archivedRows: Number(row.archivedRows ?? 0),
      oldestArchivedAt: row.oldestArchivedAt
        ? new Date(row.oldestArchivedAt as string).toISOString()
        : null,
      tableBytes: Number(row.tableBytes ?? 0),
    }
  }

  async prune(
    organizationId: string,
    options: {
      olderThanDays?: number
      batch?: number
      dryRun?: boolean
      now?: Date
      actor?: string
    } = {},
  ): Promise<PruneResult> {
    if (!organizationId) throw new BadRequestException('缺少组织上下文')
    const days = options.olderThanDays ??
      Number(process.env.BLUEPRINT_RECORD_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS)
    if (!Number.isFinite(days) || days < MIN_RETENTION_DAYS) {
      throw new BadRequestException(`olderThanDays 必须 >= ${MIN_RETENTION_DAYS}`)
    }
    const batch = Math.max(
      1,
      Math.min(
        5_000,
        options.batch ??
          Number(process.env.BLUEPRINT_RECORD_RETENTION_BATCH ?? DEFAULT_BATCH),
      ),
    )
    const now = options.now ?? new Date()
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const dryRun = options.dryRun === true

    const candidateRows = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
         FROM (
           SELECT 1
             FROM public.blueprint_records
            WHERE "organizationId" = $1
              AND "archivedAt" IS NOT NULL
              AND "archivedAt" < $2
            ORDER BY "archivedAt" ASC
            LIMIT $3
         ) candidates`,
      [organizationId, cutoff, batch + 1],
    )) as Array<{ count: number | string }>
    const candidates = Number(candidateRows[0]?.count ?? 0)

    let deleted = 0
    if (!dryRun && candidates > 0) {
      const result = (await this.dataSource.query(
        `WITH doomed AS (
           SELECT id
             FROM public.blueprint_records
            WHERE "organizationId" = $1
              AND "archivedAt" IS NOT NULL
              AND "archivedAt" < $2
            ORDER BY "archivedAt" ASC
            LIMIT $3
         )
         DELETE FROM public.blueprint_records r
          USING doomed d
          WHERE r.id = d.id AND r."organizationId" = $1
          RETURNING r.id`,
        [organizationId, cutoff, batch],
      )) as Array<{ id: string }>
      deleted = result.length
      await this.auditLogs?.create({
        organizationId,
        action: 'blueprint_records.retention_pruned',
        resource: 'blueprint_records',
        actor: options.actor ?? 'system:retention',
        status: 'success',
        metadata: {
          cutoff: cutoff.toISOString(),
          olderThanDays: days,
          deleted,
          batch,
        },
        source: 'record-lifecycle',
      })
    }

    return {
      organizationId,
      dryRun,
      olderThanDays: days,
      cutoff: cutoff.toISOString(),
      batch,
      candidates: Math.min(candidates, batch),
      deleted,
      hasMore: candidates > batch,
    }
  }

  recommendPartition(stats: {
    totalRows: number
    tableBytes: number
  }): {
    recommended: boolean
    rowThreshold: number
    byteThreshold: number
    reason: string
  } {
    const rowThreshold = Number(
      process.env.BLUEPRINT_RECORDS_PARTITION_ROWS ?? 50_000_000,
    )
    const byteThreshold = Number(
      process.env.BLUEPRINT_RECORDS_PARTITION_BYTES ?? 50 * 1024 * 1024 * 1024,
    )
    const byRows = stats.totalRows >= rowThreshold
    const byBytes = stats.tableBytes >= byteThreshold
    return {
      recommended: byRows || byBytes,
      rowThreshold,
      byteThreshold,
      reason: byRows
        ? `rows ${stats.totalRows} >= ${rowThreshold}`
        : byBytes
          ? `bytes ${stats.tableBytes} >= ${byteThreshold}`
          : `rows ${stats.totalRows} / bytes ${stats.tableBytes} below thresholds`,
    }
  }
}
