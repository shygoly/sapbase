import { AgentKnowledgeService } from './agent-knowledge.service'

describe('AgentKnowledgeService', () => {
  const service = new AgentKnowledgeService({} as never, {} as never)

  it('detects phone, id and email', () => {
    const hits = service.detectSensitive('联系 13800138000 / 110101199001011234 / a@b.com')
    expect(hits.length).toBeGreaterThanOrEqual(3)
  })

  it('returns no hits for clean text', () => {
    expect(service.detectSensitive('采购单税率填写说明')).toEqual([])
  })
})


describe('AgentKnowledgeService publish', () => {
  function serviceWith(entry: Record<string, unknown>) {
    const entries = {
      findOne: jest.fn(async () => entry),
      update: jest.fn(async () => undefined),
      save: jest.fn(async (row: unknown) => row),
    }
    return { service: new AgentKnowledgeService(entries as never, {} as never), entries }
  }

  it('rejects unconfirmed sensitive content', async () => {
    const { service } = serviceWith({ id: 'k1', organizationId: 'o1', scope: 'organization', scopeId: 'o1', knowledgeKey: 'tax', version: 1, title: 't', body: 'call 13800138000', status: 'draft', releaseId: null, sensitiveReview: {} })
    await expect(service.publish({ id: 'k1', organizationId: 'o1', confirmedSensitive: false })).rejects.toThrow()
  })

  it('publishes after confirmation', async () => {
    const { service, entries } = serviceWith({ id: 'k1', organizationId: 'o1', scope: 'organization', scopeId: 'o1', knowledgeKey: 'tax', version: 1, title: 't', body: 'call 13800138000', status: 'draft', releaseId: null, sensitiveReview: {} })
    const saved = await service.publish({ id: 'k1', organizationId: 'o1', confirmedSensitive: true })
    expect(saved.status).toBe('published')
    expect(entries.save).toHaveBeenCalled()
  })
})
