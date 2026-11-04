import {
  assertPublishable,
  canTransitionActivation,
  canTransitionProposal,
  canTransitionRelease,
  compareSemver,
  computeReleaseDigest,
  diffPlainObject,
  parseSemver,
} from '@sap/release-kernel'

describe('release-kernel', () => {
  it('parses and compares semver', () => {
    expect(parseSemver('1.4.0-rc.1')).toEqual({ major: 1, minor: 4, patch: 0, prerelease: 'rc.1' })
    expect(compareSemver('1.4.0', '1.3.9')).toBeGreaterThan(0)
  })

  it('enforces state machines', () => {
    expect(canTransitionRelease('building', 'published')).toBe(true)
    expect(canTransitionRelease('published', 'building')).toBe(false)
    expect(canTransitionProposal('validated', 'approved')).toBe(true)
    expect(canTransitionActivation('active', 'rolled_back')).toBe(true)
  })

  it('computes a stable digest', () => {
    const a = computeReleaseDigest({ b: 2, a: 1 })
    const b = computeReleaseDigest({ a: 1, b: 2 })
    expect(a).toBe(b)
    expect(a).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('rejects release without changelog or with author=approver', () => {
    expect(() =>
      assertPublishable({
        version: '1.0.0',
        channel: 'stable',
        manifest: {},
        changelog: {},
      }),
    ).toThrow('changelog')
    expect(() =>
      assertPublishable({
        version: '1.0.0',
        channel: 'stable',
        manifest: {},
        changelog: { 'zh-CN': [{ type: 'added', title: 'x' }] },
        authorId: 'u1',
        approverId: 'u1',
      }),
    ).toThrow('作者')
  })

  it('diffs plain objects', () => {
    expect(diffPlainObject({ a: 1 }, { a: 2, b: 3 })).toEqual([
      { path: '/a', change: 'changed' },
      { path: '/b', change: 'added' },
    ])
  })
})
