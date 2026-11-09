import {
  buildAuditHashPayload,
  canonicalAuditPayload,
  computeAuditHash,
  stableStringify,
} from './audit-chain'
import { AuditChainService } from './audit-chain.service'

describe('audit chain pure functions', () => {
  it('稳定 JSON：键顺序不影响结果，嵌套对象也排序', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      stableStringify({ a: { c: 3, d: 2 }, b: 1 }),
    )
  })

  it('hash = SHA256(prevHash + canonical payload)', () => {
    const payload = canonicalAuditPayload(
      buildAuditHashPayload(
        {
          organizationId: 'org-1',
          action: 'user.login',
          resource: 'auth',
          actor: 'u1',
          status: 'success',
        },
        1,
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    )
    const hash = computeAuditHash('genesis', payload)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(computeAuditHash('genesis', payload)).toBe(hash)
    expect(computeAuditHash('other', payload)).not.toBe(hash)
  })
})

describe('AuditChainService', () => {
  it('seq 从 1 开始，prevHash=genesis', async () => {
    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    }
    const service = new AuditChainService({} as never)
    const row = await service.record(
      {
        organizationId: 'org-1',
        action: 'user.login',
        resource: 'auth',
        actor: 'u1',
        status: 'success',
      },
      manager as never,
    )
    expect(row).toMatchObject({ seq: 1, prevHash: 'genesis' })
    expect(row.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      ['org-1'],
    )
  })

  it('已有链 → seq+1，prevHash=上一行 hash', async () => {
    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ seq: '7', hash: 'prev-hash' }])
        .mockResolvedValueOnce([]),
    }
    const service = new AuditChainService({} as never)
    const row = await service.record(
      {
        organizationId: 'org-1',
        action: 'user.login',
        resource: 'auth',
        actor: 'u1',
        status: 'success',
      },
      manager as never,
    )
    expect(row).toMatchObject({ seq: 8, prevHash: 'prev-hash' })
  })
})
