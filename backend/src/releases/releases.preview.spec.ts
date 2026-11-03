import { ReleasesService } from './releases.service'

describe('ReleasesService preview token', () => {
  const service = new ReleasesService(
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never,
  )

  it('issues and verifies a preview token', () => {
    const token = service.issuePreviewToken({
      userId: 'u1',
      organizationId: 'o1',
      releaseId: 'r1',
      roles: ['owner'],
      ttlSeconds: 60,
    })
    const claims = service.verifyPreviewToken(token, { organizationId: 'o1', releaseId: 'r1' }) as unknown as { userId: string; releaseId: string }
    expect(claims.userId).toBe('u1')
    expect(claims.releaseId).toBe('r1')
  })

  it('rejects invalid token', () => {
    expect(() => service.verifyPreviewToken('bad.token', { organizationId: 'o1' })).toThrow()
  })

  it('rejects cross-organization token', () => {
    const token = service.issuePreviewToken({
      userId: 'u1',
      organizationId: 'o1',
      releaseId: 'r1',
      roles: [],
      ttlSeconds: 60,
    })
    expect(() => service.verifyPreviewToken(token, { organizationId: 'o2' })).toThrow()
  })
})
