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
