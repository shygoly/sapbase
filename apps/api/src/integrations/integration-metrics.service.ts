import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { DataSyncRun, OutboundMessage } from './integrations.entities'

@Injectable()
export class IntegrationMetricsService {
  constructor(
    @InjectRepository(OutboundMessage)
    private readonly outbound: Repository<OutboundMessage>,
    @InjectRepository(DataSyncRun)
    private readonly runs: Repository<DataSyncRun>,
  ) {}

  async metrics(organizationId: string) {
    const outbound = await this.outbound
      .createQueryBuilder('message')
      .select('message.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(AVG(message.attempts), 0)', 'avgAttempts')
      .where('message."organizationId" = :organizationId', { organizationId })
      .groupBy('message.status')
      .getRawMany<{ status: string; count: number; avgAttempts: string }>()
    const runs = await this.runs
      .createQueryBuilder('run')
      .select('run.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(run."rowsRead"), 0)::int', 'rowsRead')
      .addSelect('COALESCE(SUM(run."rowsWritten"), 0)::int', 'rowsWritten')
      .addSelect('COALESCE(SUM(run."rowsFailed"), 0)::int', 'rowsFailed')
      .where('run."organizationId" = :organizationId', { organizationId })
      .groupBy('run.status')
      .getRawMany<{
        status: string
        count: number
        rowsRead: number
        rowsWritten: number
        rowsFailed: number
      }>()
    const outboundTotal = outbound.reduce((sum, item) => sum + Number(item.count), 0)
    const succeeded = Number(outbound.find((item) => item.status === 'succeeded')?.count ?? 0)
    const dead = Number(outbound.find((item) => item.status === 'dead')?.count ?? 0)
    return {
      outbound: {
        total: outboundTotal,
        succeeded,
        dead,
        successRate: outboundTotal > 0 ? succeeded / outboundTotal : 1,
        byStatus: outbound,
      },
      sync: {
        byStatus: runs,
        rowsRead: runs.reduce((sum, item) => sum + Number(item.rowsRead), 0),
        rowsWritten: runs.reduce((sum, item) => sum + Number(item.rowsWritten), 0),
        rowsFailed: runs.reduce((sum, item) => sum + Number(item.rowsFailed), 0),
      },
    }
  }
}
