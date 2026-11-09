import { Injectable } from '@nestjs/common'
import { DataSource, EntityManager } from 'typeorm'
import { randomUUID } from 'node:crypto'
import {
  buildAuditHashPayload,
  canonicalAuditPayload,
  computeAuditHash,
  type AuditChainInput,
} from './audit-chain'

export interface AuditChainRow {
  id: string
  organizationId: string
  seq: number
  prevHash: string
  hash: string
  action: string
  resource: string
  actor: string
  status: string
  timestamp: Date
}

/**
 * 审计哈希链写入。每组织串行（advisory lock），seq 单调，hash = SHA256(prevHash + canonical payload)。
 * 失败即抛错，不静默降级为无链写入。
 */
@Injectable()
export class AuditChainService {
  constructor(private readonly dataSource: DataSource) {}

  async record(input: AuditChainInput, manager?: EntityManager): Promise<AuditChainRow> {
    if (manager) return this.recordWith(manager, input)
    return this.dataSource.transaction((entityManager) => this.recordWith(entityManager, input))
  }

  private async recordWith(manager: EntityManager, input: AuditChainInput): Promise<AuditChainRow> {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [input.organizationId])
    const lastRows = (await manager.query(
      `SELECT seq, hash FROM public.audit_logs
        WHERE "organizationId" = $1 AND seq IS NOT NULL
        ORDER BY seq DESC LIMIT 1`,
      [input.organizationId],
    )) as Array<{ seq: string | number; hash: string }>
    const last = lastRows[0]
    const seq = last ? Number(last.seq) + 1 : 1
    const prevHash = last?.hash ?? 'genesis'
    const timestamp = input.timestamp ?? new Date()
    const payload = canonicalAuditPayload(buildAuditHashPayload(input, seq, timestamp))
    const hash = computeAuditHash(prevHash, payload)
    const id = randomUUID()
    await manager.query(
      `INSERT INTO public.audit_logs
         (id, "createdAt", "updatedAt", "organizationId", action, resource, actor,
          "actorType", status, "resourceId", changes, metadata, timestamp,
          seq, "prevHash", hash, "hashAlgo", payload,
          "appInstallationId", ip, "userAgent", "correlationId", source,
          "retentionUntil", "legalHold")
       VALUES ($1, now(), now(), $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb,
               $11, $12, $13, $14, 'sha256', $15::jsonb, $16, $17, $18, $19, $20, $21, $22)`,
      [
        id,
        input.organizationId,
        input.action,
        input.resource,
        input.actor,
        input.actorType ?? 'user',
        input.status,
        input.resourceId ?? null,
        JSON.stringify(input.changes ?? null),
        JSON.stringify(input.metadata ?? null),
        timestamp,
        seq,
        prevHash,
        hash,
        payload,
        input.appInstallationId ?? null,
        input.ip ?? null,
        input.userAgent ?? null,
        input.correlationId ?? null,
        input.source ?? null,
        input.retentionUntil ?? null,
        input.legalHold ?? false,
      ],
    )
    return {
      id,
      organizationId: input.organizationId,
      seq,
      prevHash,
      hash,
      action: input.action,
      resource: input.resource,
      actor: input.actor,
      status: input.status,
      timestamp,
    }
  }
}
