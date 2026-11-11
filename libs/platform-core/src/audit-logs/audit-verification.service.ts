import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { createHmac } from 'node:crypto'
import { computeAuditHash, stableStringify } from './audit-chain'

export interface AuditVerificationResult {
  organizationId: string
  valid: boolean
  checked: number
  brokenAt?: number
  reason?: string
  checkpointSeq?: string | null
}

interface AuditRow {
  seq: string | number
  prevHash: string | null
  hash: string | null
  payload: Record<string, unknown> | null
}

/**
 * 从 genesis 重算链。legacy 段（seq null）不参与；任何 seq 缺口/prevHash 不符/hash 不符都失败。
 * checkpoint 目前只作为锚点数据，验证从 seq=1 开始（v1 链长度可控）。
 */
@Injectable()
export class AuditVerificationService {
  constructor(private readonly dataSource: DataSource) {}

  async verify(organizationId: string): Promise<AuditVerificationResult> {
    const checkpoints = (await this.dataSource.query(
      `SELECT seq, hash, signature FROM public.audit_checkpoints
        WHERE "organizationId" = $1 ORDER BY seq DESC LIMIT 1`,
      [organizationId],
    )) as Array<{ seq: string | number; hash: string; signature: string | null }>
    const checkpoint = checkpoints[0]
    if (checkpoint) {
      const secret = process.env.AUDIT_CHECKPOINT_SECRET
      if (checkpoint.signature) {
        if (!secret) {
          return {
            organizationId,
            valid: false,
            checked: 0,
            reason: 'checkpoint 有签名但未配置 AUDIT_CHECKPOINT_SECRET',
            checkpointSeq: String(checkpoint.seq),
          }
        }
        const expected = createHmac('sha256', secret)
          .update(`${organizationId}:${checkpoint.seq}:${checkpoint.hash}`)
          .digest('hex')
        if (expected !== checkpoint.signature) {
          return {
            organizationId,
            valid: false,
            checked: 0,
            reason: 'checkpoint 签名不匹配',
            checkpointSeq: String(checkpoint.seq),
          }
        }
      }
    }

    const rows = (await this.dataSource.query(
      `SELECT seq, "prevHash", hash, payload
         FROM public.audit_logs
        WHERE "organizationId" = $1 AND seq IS NOT NULL
          ${checkpoint ? 'AND seq > $2' : ''}
        ORDER BY seq ASC`,
      checkpoint ? [organizationId, checkpoint.seq] : [organizationId],
    )) as AuditRow[]

    let prevHash = checkpoint?.hash ?? 'genesis'
    let expectedSeq = checkpoint ? Number(checkpoint.seq) + 1 : 1
    let checked = 0
    for (const row of rows) {
      const seq = Number(row.seq)
      if (seq !== expectedSeq) {
        return {
          organizationId,
          valid: false,
          checked,
          brokenAt: expectedSeq,
          reason: `seq 缺口：期望 ${expectedSeq}，实际 ${seq}`,
        }
      }
      if ((row.prevHash ?? 'genesis') !== prevHash) {
        return {
          organizationId,
          valid: false,
          checked,
          brokenAt: seq,
          reason: 'prevHash 与上一行不匹配',
        }
      }
      if (!row.payload) {
        return {
          organizationId,
          valid: false,
          checked,
          brokenAt: seq,
          reason: 'payload 缺失，无法重算 hash',
        }
      }
      const recomputed = computeAuditHash(prevHash, stableStringify(row.payload))
      if (recomputed !== row.hash) {
        return {
          organizationId,
          valid: false,
          checked,
          brokenAt: seq,
          reason: 'hash 重算不匹配（可能被篡改）',
        }
      }
      prevHash = row.hash as string
      expectedSeq += 1
      checked += 1
    }
    return {
      organizationId,
      valid: true,
      checked,
      checkpointSeq: checkpoint ? String(checkpoint.seq) : null,
    }
  }
}
