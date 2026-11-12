import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AppUsageRecord } from './app-usage-record.entity'

export interface RecordUsageInput {
  organizationId: string
  appKey: string
  metric: string
  quantity: number
  source: string
  /** 重试去重键；同组织内唯一。 */
  idempotencyKey?: string
  metadata?: Record<string, unknown> | null
  /** 测试/补录用；缺省为当前 UTC 自然月。 */
  at?: Date
}

export interface UsageSummaryRow {
  metric: string
  quantity: number
}

/**
 * 用量计量（6.1）：只追加、按月聚合。
 *
 * 配额判定由 `EntitlementsService` 读取本服务的月度汇总；
 * 计量本身不阻断业务，写入失败由调用方决定是否降级。
 */
@Injectable()
export class UsageMeteringService {
  constructor(
    @InjectRepository(AppUsageRecord)
    private readonly repository: Repository<AppUsageRecord>,
  ) {}

  async record(input: RecordUsageInput): Promise<AppUsageRecord> {
    if (!input.organizationId) throw new BadRequestException('缺少 organizationId')
    if (!input.appKey) throw new BadRequestException('缺少 appKey')
    if (!input.metric) throw new BadRequestException('缺少 metric')
    if (!input.source) throw new BadRequestException('缺少 source')
    if (!Number.isFinite(input.quantity) || input.quantity < 0) {
      throw new BadRequestException('quantity 必须是非负数')
    }
    if (input.idempotencyKey) {
      const existing = await this.repository.findOne({
        where: {
          organizationId: input.organizationId,
          idempotencyKey: input.idempotencyKey,
        },
      })
      if (existing) return existing
    }
    const at = input.at ?? new Date()
    const periodStart = new Date(
      Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1, 0, 0, 0, 0),
    )
    const periodEnd = new Date(
      Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1, 0, 0, 0, 0),
    )
    const row = this.repository.create({
      organizationId: input.organizationId,
      appKey: input.appKey,
      metric: input.metric,
      quantity: input.quantity.toFixed(4),
      periodStart,
      periodEnd,
      source: input.source,
      idempotencyKey: input.idempotencyKey ?? null,
      metadata: input.metadata ?? null,
    })
    return this.repository.save(row)
  }

  async currentUsage(
    organizationId: string,
    appKey: string,
    metric: string,
    at: Date = new Date(),
  ): Promise<number> {
    const periodStart = new Date(
      Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1, 0, 0, 0, 0),
    )
    const row = await this.repository
      .createQueryBuilder('usage')
      .select('COALESCE(SUM(usage.quantity), 0)', 'total')
      .where('usage.organizationId = :organizationId', { organizationId })
      .andWhere('usage.appKey = :appKey', { appKey })
      .andWhere('usage.metric = :metric', { metric })
      .andWhere('usage.periodStart = :periodStart', { periodStart })
      .getRawOne<{ total: string | number }>()
    return Number(row?.total ?? 0)
  }

  async summary(
    organizationId: string,
    appKey?: string,
    at: Date = new Date(),
  ): Promise<UsageSummaryRow[]> {
    const periodStart = new Date(
      Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1, 0, 0, 0, 0),
    )
    const query = this.repository
      .createQueryBuilder('usage')
      .select('usage.metric', 'metric')
      .addSelect('COALESCE(SUM(usage.quantity), 0)', 'quantity')
      .where('usage.organizationId = :organizationId', { organizationId })
      .andWhere('usage.periodStart = :periodStart', { periodStart })
      .groupBy('usage.metric')
      .orderBy('usage.metric', 'ASC')
    if (appKey) {
      query.andWhere('usage.appKey = :appKey', { appKey })
    }
    const rows = await query.getRawMany<{ metric: string; quantity: string | number }>()
    return rows.map((row) => ({
      metric: row.metric,
      quantity: Number(row.quantity ?? 0),
    }))
  }
}
