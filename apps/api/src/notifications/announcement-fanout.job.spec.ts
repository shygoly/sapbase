import { createAnnouncementFanoutJobDefinition } from './announcement-fanout.job'

describe('announcement fanout job definition', () => {
  it('payload schema：只接受 announcementId', () => {
    const definition = createAnnouncementFanoutJobDefinition({} as never)
    expect(definition.type).toBe('notification.announcement_fanout')
    expect(definition.typeVersion).toBe(1)
    expect(definition.payloadSchema.required).toEqual(['announcementId'])
    expect(definition.payloadSchema.additionalProperties).toBe(false)
    expect(definition.maxAttempts).toBe(3)
    expect(definition.concurrency).toBe(1)
  })

  it('handler：解析公告并分批扇出，进度写回任务事件', async () => {
    const progress = jest.fn(async () => undefined)
    const announcement = { id: '11111111-1111-4111-8111-111111111111' }
    const announcements = {
      get: jest.fn(async () => announcement),
      fanout: jest.fn(async (_org: string, _row: unknown, _users: unknown, ctx: any) => {
        await ctx.progress(100, { delivered: 3, total: 3 })
        return 3
      }),
    }
    const definition = createAnnouncementFanoutJobDefinition(announcements as never)
    const result = await definition.handler(
      {
        jobId: 'job-1',
        organizationId: 'org-1',
        type: definition.type,
        typeVersion: 1,
        attempt: 1,
        isCancelled: async () => false,
        signal: new AbortController().signal,
        progress,
        stage: jest.fn(async () => undefined),
        log: jest.fn(async () => undefined),
      },
      { announcementId: announcement.id },
    )
    expect(announcements.get).toHaveBeenCalledWith('org-1', announcement.id)
    expect(announcements.fanout).toHaveBeenCalledWith(
      'org-1',
      announcement,
      undefined,
      expect.objectContaining({ isCancelled: expect.any(Function) }),
    )
    expect(progress).toHaveBeenCalledWith(100, { delivered: 3, total: 3 })
    expect(result).toEqual({
      result: { announcementId: announcement.id, delivered: 3 },
    })
  })
})
