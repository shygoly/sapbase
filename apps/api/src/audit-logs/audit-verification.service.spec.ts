import { AuditVerificationService } from './audit-verification.service'
import { buildAuditHashPayload, canonicalAuditPayload, computeAuditHash } from './audit-chain'

function rows() {
  const base = {
    organizationId: 'org-1',
    action: 'user.login',
    resource: 'auth',
    actor: 'u1',
    status: 'success' as const,
  }
  const payload1 = canonicalAuditPayload(
    buildAuditHashPayload(base, 1, new Date('2026-01-01T00:00:00.000Z')),
  )
  const hash1 = computeAuditHash('genesis', payload1)
  const payload2 = canonicalAuditPayload(
    buildAuditHashPayload(base, 2, new Date('2026-01-01T00:00:01.000Z')),
  )
  const hash2 = computeAuditHash(hash1, payload2)
  return [
    { seq: 1, prevHash: 'genesis', hash: hash1, payload: JSON.parse(payload1) },
    { seq: 2, prevHash: hash1, hash: hash2, payload: JSON.parse(payload2) },
  ]
}

describe('AuditVerificationService', () => {
  it('正常链通过', async () => {
    const service = new AuditVerificationService({
      query: jest.fn(async (sql: string) => (sql.includes('audit_checkpoints') ? [] : rows())),
    } as never)
    await expect(service.verify('org-1')).resolves.toMatchObject({
      valid: true,
      checked: 2,
    })
  })

  it('hash 被篡改 → brokenAt 2', async () => {
    const data = rows()
    data[1].hash = 'tampered'
    const service = new AuditVerificationService({
      query: jest.fn(async (sql: string) => (sql.includes('audit_checkpoints') ? [] : data)),
    } as never)
    await expect(service.verify('org-1')).resolves.toMatchObject({
      valid: false,
      brokenAt: 2,
      reason: expect.stringContaining('hash'),
    })
  })

  it('seq 缺口 → brokenAt 期望值', async () => {
    const data = rows()
    data[1].seq = 3
    const service = new AuditVerificationService({
      query: jest.fn(async (sql: string) => (sql.includes('audit_checkpoints') ? [] : data)),
    } as never)
    await expect(service.verify('org-1')).resolves.toMatchObject({
      valid: false,
      brokenAt: 2,
      reason: expect.stringContaining('seq 缺口'),
    })
  })

  it('checkpoint 锚点：签名有效时只校验锚点之后', async () => {
    const data = rows()
    const secret = 'test-secret'
    process.env.AUDIT_CHECKPOINT_SECRET = secret
    const { createHmac } = require('node:crypto')
    const checkpoint = {
      seq: 1,
      hash: data[0].hash,
      signature: createHmac('sha256', secret).update(`org-1:1:${data[0].hash}`).digest('hex'),
    }
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('audit_checkpoints')) return [checkpoint]
      return data.filter((row) => row.seq > 1)
    })
    const service = new AuditVerificationService({ query } as never)
    await expect(service.verify('org-1')).resolves.toMatchObject({
      valid: true,
      checked: 1,
      checkpointSeq: '1',
    })
    delete process.env.AUDIT_CHECKPOINT_SECRET
  })

  it('checkpoint 签名被篡改 → 失败', async () => {
    const data = rows()
    process.env.AUDIT_CHECKPOINT_SECRET = 'test-secret'
    const query = jest.fn(async (sql: string) =>
      sql.includes('audit_checkpoints')
        ? [{ seq: 1, hash: data[0].hash, signature: 'bad' }]
        : [],
    )
    const service = new AuditVerificationService({ query } as never)
    await expect(service.verify('org-1')).resolves.toMatchObject({
      valid: false,
      reason: expect.stringContaining('签名'),
    })
    delete process.env.AUDIT_CHECKPOINT_SECRET
  })
})
