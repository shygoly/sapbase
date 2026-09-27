import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import {
  approvalDecidedIdempotencyKey,
  approvalPendingIdempotencyKey,
  importIdempotencyKey,
  OutboxService,
  transitionIdempotencyKey,
} from './outbox.service'
import { OutboxEvent } from './outbox-event.entity'

describe('OutboxService 组键与发布', () => {
  it('幂等键唯一到这一次发生', () => {
    expect(transitionIdempotencyKey('r1', 'draft', 'confirmed', 2)).toBe(
      'transition:r1:draft->confirmed:v2',
    )
    expect(approvalPendingIdempotencyKey('r1', 'so-high-value', 0)).toBe(
      'approval-pending:r1:so-high-value:0',
    )
    expect(approvalDecidedIdempotencyKey('r1', 'so-high-value', 0)).toBe(
      'approval-decided:r1:so-high-value:0',
    )
    expect(importIdempotencyKey('Part', 'batch-1')).toBe('import:Part:batch-1')
  })

  it('publish 只用调用方 manager，自己不开事务', async () => {
    const saved: OutboxEvent[] = []
    const repo = {
      create: (row: OutboxEvent) => row,
      save: jest.fn(async (row: OutboxEvent) => {
        saved.push(row)
        return { ...row, id: 'evt-1' }
      }),
    }
    const manager = {
      getRepository: jest.fn(() => repo),
    }
    const dataSource = {
      transaction: jest.fn(),
      getRepository: jest.fn(),
    }
    const service = new OutboxService(dataSource as never)
    const row = await service.publish(manager as never, {
      topic: 'blueprint.record.transitioned',
      organizationId: 'org-1',
      idempotencyKey: 'transition:r1:draft->confirmed:v1',
      aggregateType: 'SalesOrder',
      aggregateId: 'r1',
      payload: { recordId: 'r1', from: 'draft', to: 'confirmed' },
    })
    expect(dataSource.transaction).not.toHaveBeenCalled()
    expect(dataSource.getRepository).not.toHaveBeenCalled()
    expect(manager.getRepository).toHaveBeenCalledWith(OutboxEvent)
    expect(row.status).toBe('pending')
    expect(row.attempts).toBe(0)
    expect(saved[0].idempotencyKey).toBe('transition:r1:draft->confirmed:v1')
  })

  it('listEvents 缺租户拒；redeliver 他租 Forbidden、不存在 404', async () => {
    const repo = {
      find: jest.fn(async () => []),
      findOne: jest.fn(),
      save: jest.fn(),
    }
    const service = new OutboxService({ getRepository: () => repo } as never)
    await expect(service.listEvents({ organizationId: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(service.redeliver('missing', 'org-1')).rejects.toBeInstanceOf(NotFoundException)

    repo.findOne.mockResolvedValueOnce({
      id: 'evt-1',
      organizationId: 'org-other',
      status: 'failed',
      attempts: 3,
    } as OutboxEvent)
    await expect(service.redeliver('evt-1', 'org-1')).rejects.toBeInstanceOf(ForbiddenException)

    const row = {
      id: 'evt-2',
      organizationId: 'org-1',
      status: 'failed' as const,
      attempts: 3,
      nextAttemptAt: new Date('2020-01-01'),
    }
    repo.findOne.mockResolvedValueOnce(row as OutboxEvent)
    repo.save.mockImplementationOnce(async (value: typeof row) => value)
    const reset = await service.redeliver('evt-2', 'org-1')
    expect(reset.status).toBe('pending')
    expect(reset.attempts).toBe(3)
    expect(reset.nextAttemptAt!.getTime()).toBeGreaterThan(Date.parse('2020-01-01'))
  })
})
