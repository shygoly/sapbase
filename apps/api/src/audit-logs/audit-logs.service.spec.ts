import { BadRequestException } from '@nestjs/common'
import { AuditLogsService, redactAuditLog } from './audit-logs.service'

function setup() {
  const chain = { record: jest.fn(async (input) => ({ id: 'a1', ...input })) }
  const repository = {
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => row),
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  }
  return {
    service: new AuditLogsService(repository as never, chain as never),
    repository,
    chain,
  }
}

describe('AuditLogsService catalog/retention', () => {
  it('已知事件缺必填字段 → 400', async () => {
    const { service } = setup()
    await expect(
      service.create({
        organizationId: 'org-1',
        action: 'role.created',
        resource: 'role',
        actor: 'u1',
        status: 'success',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('未知 action 标 custom + 告警标记，不静默', async () => {
    const { service, chain } = setup()
    await service.create({
      organizationId: 'org-1',
      action: 'custom.something',
      resource: 'custom',
      actor: 'u1',
      status: 'success',
    })
    expect(chain.record).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'custom',
        metadata: expect.objectContaining({ auditUnknownAction: true }),
      }),
    )
  })

  it('retentionClass 自动计算 retentionUntil', async () => {
    const { service, chain } = setup()
    await service.create({
      organizationId: 'org-1',
      action: 'auth.login',
      resource: 'session',
      actor: 'u1',
      status: 'success',
    })
    const input = chain.record.mock.calls[0][0]
    expect(input.retentionUntil).toBeInstanceOf(Date)
  })

  it('失败审计独立事务写入 status=failure', async () => {
    const { service, chain } = setup()
    await service.recordFailure({
      organizationId: 'org-1',
      action: 'data.import',
      resource: 'record',
      actor: 'u1',
      error: 'boom',
    })
    expect(chain.record).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failure', metadata: { error: 'boom' } }),
    )
  })

  it('敏感字段输出脱敏', () => {
    const row = redactAuditLog({
      id: 'a1',
      changes: { password: 'plain', nested: { token: 't' } },
      metadata: { apiKey: 'k', safe: 1 },
      payload: { authorization: 'Bearer x' },
    } as never)
    expect(row.changes).toEqual({
      password: '[REDACTED]',
      nested: { token: '[REDACTED]' },
    })
    expect(row.metadata).toEqual({ apiKey: '[REDACTED]', safe: 1 })
    expect(row.payload).toEqual({ authorization: '[REDACTED]' })
  })
})
