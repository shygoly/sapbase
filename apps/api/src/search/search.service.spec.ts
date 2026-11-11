import { BadRequestException } from '@nestjs/common'
import { SearchService } from './search.service'

function setup(options: {
  documents?: any[]
  announcement?: any
  asset?: any
  aiModule?: any
  knowledge?: any
} = {}) {
  const documents = {
    query: jest.fn(async (_sql: string, _params?: unknown[]) => options.documents ?? [{ id: 'doc-1' }]),
    delete: jest.fn(async () => ({ affected: 1 })),
  }
  const announcements = {
    findOne: jest.fn(async () => options.announcement ?? null),
    find: jest.fn(async () => [{ id: 'ann-1' }]),
  }
  const assets = {
    findOne: jest.fn(async () => options.asset ?? null),
    find: jest.fn(async () => [{ id: 'asset-1' }]),
  }
  const aiModules = {
    findOne: jest.fn(async () => options.aiModule ?? null),
    find: jest.fn(async () => [{ id: 'module-1' }]),
  }
  const knowledge = {
    findOne: jest.fn(async () => options.knowledge ?? null),
    find: jest.fn(async () => [{ id: 'knowledge-1' }]),
  }
  return {
    service: new SearchService(
      documents as never,
      announcements as never,
      assets as never,
      aiModules as never,
      knowledge as never,
    ),
    documents,
    announcements,
    assets,
    aiModules,
    knowledge,
  }
}

describe('SearchService', () => {
  it('upsert 使用唯一键幂等写入；hash 未变时 skipped', async () => {
    const first = setup()
    await expect(
      first.service.upsert({
        organizationId: 'org-1',
        resourceKey: 'announcement',
        resourceId: 'ann-1',
        title: 'Title',
        body: 'Body',
      }),
    ).resolves.toEqual({ indexed: true, skipped: false })
    const [sql] = first.documents.query.mock.calls[0] as unknown as [string]
    expect(sql).toContain('ON CONFLICT ("organizationId", "resourceKey", "resourceId")')
    expect(sql).toContain('"contentHash"')

    const second = setup({ documents: [] })
    await expect(
      second.service.upsert({
        organizationId: 'org-1',
        resourceKey: 'announcement',
        resourceId: 'ann-1',
        title: 'Title',
      }),
    ).resolves.toEqual({ indexed: false, skipped: true })
  })

  it('未知资源类型/缺标题拒绝', async () => {
    const { service } = setup()
    await expect(
      service.upsert({
        organizationId: 'org-1',
        resourceKey: 'unknown' as never,
        resourceId: 'x',
        title: 't',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.upsert({
        organizationId: 'org-1',
        resourceKey: 'announcement',
        resourceId: 'x',
        title: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('资源不存在时删除旧索引', async () => {
    const { service, documents } = setup()
    await expect(
      service.indexResource('org-1', 'announcement', 'ann-404'),
    ).resolves.toEqual({ indexed: false })
    expect(documents.delete).toHaveBeenCalledWith({
      organizationId: 'org-1',
      resourceKey: 'announcement',
      resourceId: 'ann-404',
    })
  })

  it('公告/素材/知识适配：只索引可展示字段并带标签', async () => {
    const { service, documents } = setup({
      announcement: {
        id: 'ann-1',
        title: 'Notice',
        body: 'Body',
        status: 'published',
        audienceType: 'all',
      },
    })
    await service.indexResource('org-1', 'announcement', 'ann-1')
    const params = documents.query.mock.calls[0][1] as unknown as any[]
    expect(params[3]).toBe('Notice')
    expect(params[5]).toContain('announcement')
    expect(params[5]).toContain('published')
  })

  it('query 分页上限与结果映射', async () => {
    const { service } = setup({
      documents: [
        {
          id: 'doc-1',
          resourceKey: 'announcement',
          resourceId: 'ann-1',
          title: 'Title',
          snippet: '[[[Title]]]',
          tags: ['announcement'],
          metadata: {},
          rank: 0.5,
          indexedAt: new Date(),
          total: '1',
        },
      ],
    })
    const result = await service.query('org-1', { q: 'title', pageSize: 999 })
    expect(result.pageSize).toBe(50)
    expect(result.total).toBe(1)
    expect(result.items[0]).toMatchObject({
      resourceKey: 'announcement',
      title: 'Title',
      snippet: '[[[Title]]]',
    })
  })

  it('reindexAll 汇总四类资源', async () => {
    const { service } = setup({
      announcement: {
        id: 'ann-1',
        title: 'A',
        body: '',
        status: 'published',
        audienceType: 'all',
      },
      asset: { id: 'asset-1', originalName: 'a.png', kind: 'image', status: 'ready', metadata: {} },
      aiModule: { id: 'module-1', name: 'M', description: '', status: 'draft', metadata: {} },
      knowledge: {
        id: 'knowledge-1',
        organizationId: 'org-1',
        title: 'K',
        body: '',
        status: 'published',
        scope: 'organization',
        knowledgeKey: 'k',
        version: 1,
      },
    })
    const counts = await service.reindexAll('org-1')
    expect(counts).toEqual({
      announcement: 1,
      asset: 1,
      ai_module: 1,
      agent_knowledge: 1,
    })
  })
})
