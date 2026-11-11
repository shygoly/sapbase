import { createHmac } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { AuditCheckpoint } from './audit-checkpoint.entity'

@Injectable()
export class AuditCheckpointService {
  constructor(
    @InjectRepository(AuditCheckpoint)
    private readonly checkpoints: Repository<AuditCheckpoint>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    organizationId: string,
    signer = 'system',
  ): Promise<AuditCheckpoint | null> {
    const rows = (await this.dataSource.query(
      `SELECT seq, hash FROM public.audit_logs
        WHERE "organizationId" = $1 AND seq IS NOT NULL
        ORDER BY seq DESC LIMIT 1`,
      [organizationId],
    )) as Array<{ seq: string | number; hash: string }>
    const last = rows[0]
    if (!last) return null
    const seq = String(last.seq)
    const existing = await this.checkpoints.findOne({
      where: { organizationId, seq },
    })
    if (existing) return existing
    const secret = process.env.AUDIT_CHECKPOINT_SECRET
    const signature = secret
      ? createHmac('sha256', secret)
          .update(`${organizationId}:${seq}:${last.hash}`)
          .digest('hex')
      : null
    return this.checkpoints.save(
      this.checkpoints.create({
        organizationId,
        seq,
        hash: last.hash,
        signature,
        signer,
        metadata: { signed: Boolean(signature) },
      }),
    )
  }

  async list(organizationId: string): Promise<AuditCheckpoint[]> {
    return this.checkpoints.find({
      where: { organizationId },
      order: { seq: 'DESC' },
      take: 100,
    })
  }

  async latest(organizationId: string): Promise<AuditCheckpoint | null> {
    return this.checkpoints.findOne({
      where: { organizationId },
      order: { seq: 'DESC' },
    })
  }

  async verify(checkpoint: AuditCheckpoint): Promise<boolean> {
    const secret = process.env.AUDIT_CHECKPOINT_SECRET
    if (!secret || !checkpoint.signature) return false
    const expected = createHmac('sha256', secret)
      .update(`${checkpoint.organizationId}:${checkpoint.seq}:${checkpoint.hash}`)
      .digest('hex')
    return expected === checkpoint.signature
  }
}
