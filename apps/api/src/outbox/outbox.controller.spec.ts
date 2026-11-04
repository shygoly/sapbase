import { ForbiddenException } from '@nestjs/common'
import { OutboxController } from './outbox.controller'
import { OutboxService } from './outbox.service'

describe('OutboxController', () => {
  it('list / redeliver 用当前租户；query 与 JWT 不一致则拒', async () => {
    const outbox = {
      listEvents: jest.fn(async () => [{ id: 'e1', attempts: 1, lastError: 'x' }]),
      redeliver: jest.fn(async () => ({ id: 'e1', status: 'pending', attempts: 2 })),
    }
    const controller = new OutboxController(outbox as unknown as OutboxService)

    const listed = await controller.list('failed', undefined, { organizationId: 'org-1' })
    expect(outbox.listEvents).toHaveBeenCalledWith({ organizationId: 'org-1', status: 'failed' })
    expect(listed.events[0].lastError).toBe('x')

    await expect(
      controller.list(undefined, 'org-other', { organizationId: 'org-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException)

    const reset = await controller.redeliver('e1', undefined, { organizationId: 'org-1' })
    expect(outbox.redeliver).toHaveBeenCalledWith('e1', 'org-1')
    expect(reset.status).toBe('pending')
  })
})
