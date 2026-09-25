import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLogEventHandler } from './audit-log-handler'
import { AuditLog } from '../../../audit-logs/audit-log.entity'

class TestEvent {
  constructor(
    public type: string,
    public data: any,
    public organizationId?: string,
  ) {}
}

describe('AuditLogEventHandler', () => {
  let handler: AuditLogEventHandler
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>

  beforeEach(async () => {
    const mockAuditLogRepo = {
      save: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogEventHandler,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepo,
        },
      ],
    }).compile()

    handler = module.get<AuditLogEventHandler>(AuditLogEventHandler)
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
      const metadata = savedCall.metadata as {
        eventName: string
        eventData: { type: string; data: Record<string, unknown> }
      }
      expect(metadata.eventName).toBe('TestEvent')
      // 敏感键在**嵌套**的载荷里也必须被剔除（只过滤顶层是不够的）
      expect(metadata.eventData.data).not.toHaveProperty('password')
      // 非敏感字段保留（脱敏不能把事实也删掉）
      expect(metadata.eventData.data).toEqual({})
    })

    // 行为说明：`audit_logs` 是租户实体（organizationId 非空），所以**没有组织上下文的事件不写审计**。
    // 旧断言要求它照写 —— 与实现（`if (organizationId)`）相反，已登记在 tasks.md。
    it('should skip logging when the event has no organizationId（租户表要求组织上下文）', async () => {
      const event = new TestEvent('TestEvent', { userId: 'user-1' })

      await expect(handler.handle(event)).resolves.toBeUndefined()
      expect(auditLogRepo.save).not.toHaveBeenCalled()
    })
  })
})
