import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { computeAuditHash, stableStringify } from './audit-chain'

export interface AuditVerificationResult {
  organizationId: string
  valid: boolean
  checked: number
  brokenAt?: number
  reason?: string
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
    const rows = (await this.dataSource.query(
      `SELECT seq, "prevHash", hash, payload
         FROM public.audit_logs
        WHERE "organizationId" = $1 AND seq IS NOT NULL
        ORDER BY seq ASC`,
      [organizationId],
    )) as AuditRow[]

    let prevHash = 'genesis'
    let expectedSeq = 1
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
    return { organizationId, valid: true, checked }
  }
}
