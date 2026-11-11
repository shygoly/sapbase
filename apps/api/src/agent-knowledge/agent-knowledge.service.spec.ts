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

describe('AgentKnowledgeService skill allowlist', () => {
  function serviceWithSkills() {
    const skills = {
      findOne: jest.fn(async () => null),
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: unknown) => row),
    }
    return { service: new AgentKnowledgeService({} as never, skills as never), skills }
  }

  const digest = `sha256:${'a'.repeat(64)}`

  afterEach(() => {
    delete process.env.AGENT_SKILL_ALLOWLIST
  })

  it('白名单未配置时拒绝任意 skill（fail-closed）', async () => {
    const { service } = serviceWithSkills()
    await expect(
      service.registerSkill({ organizationId: 'o1', skillKey: 'anything', digest }),
    ).rejects.toThrow(/白名单/)
  })

  it('白名单外/非法 digest 拒绝，白名单内通过且只创建 draft', async () => {
    process.env.AGENT_SKILL_ALLOWLIST = 'demo-skill'
    const { service, skills } = serviceWithSkills()
    await expect(
      service.registerSkill({ organizationId: 'o1', skillKey: 'other', digest }),
    ).rejects.toThrow(/白名单/)
    await expect(
      service.registerSkill({ organizationId: 'o1', skillKey: 'demo-skill', digest: 'sha256:bad' }),
    ).rejects.toThrow(/digest/)
    const saved = await service.registerSkill({
      organizationId: 'o1',
      skillKey: 'demo-skill',
      digest,
    })
    expect(saved).toMatchObject({ skillKey: 'demo-skill', status: 'draft' })
    expect(skills.save).toHaveBeenCalled()
  })
})

describe('AgentKnowledgeService untrusted source', () => {
  it('拒绝把 untrusted 内容直接写成知识草稿', async () => {
    const service = new AgentKnowledgeService({} as never, {} as never)
    await expect(
      service.createDraft({
        organizationId: 'o1',
        scope: 'organization',
        scopeId: 'o1',
        knowledgeKey: 'k1',
        title: 't',
        body: '外部网页内容',
        source: 'untrusted',
      }),
    ).rejects.toThrow(/untrusted/)
  })
})
