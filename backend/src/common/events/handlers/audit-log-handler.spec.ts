import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLogHandler } from './audit-log-handler'
import { AuditLog } from '../../../audit-logs/audit-log.entity'

class TestEvent {
  constructor(
    public type: string,
    public data: any,
    public organizationId?: string,
  ) {}
}

describe('AuditLogHandler', () => {
  let handler: AuditLogHandler
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>

  beforeEach(async () => {
    const mockAuditLogRepo = {
      save: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogHandler,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepo,
        },
      ],
    }).compile()

    handler = module.get<AuditLogHandler>(AuditLogHandler)
    auditLogRepo = module.get(getRepositoryToken(AuditLog))
  })

  describe('handle', () => {
    it('should log event to audit log', async () => {
      const event = new TestEvent('TestEvent', { userId: 'user-1' }, 'org-1')

      auditLogRepo.save.mockResolvedValue({
        id: 'log-1',
        eventType: 'TestEvent',
        organizationId: 'org-1',
        data: { userId: 'user-1' },
        createdAt: new Date(),
      } as any)

      await handler.handle(event)

      expect(auditLogRepo.save).toHaveBeenCalled()
    })

    it('should sanitize sensitive data', async () => {
      const event = new TestEvent('TestEvent', { password: 'secret' }, 'org-1')

      await handler.handle(event)

      const savedCall = auditLogRepo.save.mock.calls[0][0]
      expect(savedCall.data.password).toBe('[REDACTED]')
    })

    it('should handle events without organizationId', async () => {
      const event = new TestEvent('TestEvent', { userId: 'user-1' })

      await handler.handle(event)

      expect(auditLogRepo.save).toHaveBeenCalled()
    })
  })
})
