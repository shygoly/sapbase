import {
  assertJobTransition,
  canTransitionJob,
  clampJobProgress,
  isJobLeaseExpired,
  isTerminalJobStatus,
  jobStatusAfterFailure,
  nextRetryDelayMs,
  shouldRetryJob,
} from './job-state'

describe('job state machine', () => {
  it('terminal statuses', () => {
    expect(isTerminalJobStatus('succeeded')).toBe(true)
    expect(isTerminalJobStatus('cancelled')).toBe(true)
    expect(isTerminalJobStatus('dead')).toBe(true)
    expect(isTerminalJobStatus('queued')).toBe(false)
    expect(isTerminalJobStatus('running')).toBe(false)
  })

  it('allowed and rejected transitions', () => {
    expect(canTransitionJob('queued', 'running')).toBe(true)
    expect(canTransitionJob('running', 'succeeded')).toBe(true)
    expect(canTransitionJob('failed', 'queued')).toBe(true)
    expect(canTransitionJob('dead', 'queued')).toBe(true)
    expect(canTransitionJob('succeeded', 'running')).toBe(false)
    expect(canTransitionJob('queued', 'succeeded')).toBe(false)
    expect(() => assertJobTransition('succeeded', 'queued')).toThrow(/非法任务状态迁移/)
  })

  it('exponential backoff capped', () => {
    expect(nextRetryDelayMs(1, { kind: 'exponential', baseMs: 1000, maxMs: 10_000 })).toBe(1000)
    expect(nextRetryDelayMs(2, { kind: 'exponential', baseMs: 1000, maxMs: 10_000 })).toBe(2000)
    expect(nextRetryDelayMs(5, { kind: 'exponential', baseMs: 1000, maxMs: 10_000 })).toBe(10_000)
    expect(nextRetryDelayMs(10, { kind: 'fixed', baseMs: 500, maxMs: 10_000 })).toBe(500)
  })

  it('retry / dead decision', () => {
    expect(shouldRetryJob(1, 3)).toBe(true)
    expect(shouldRetryJob(3, 3)).toBe(false)
    expect(jobStatusAfterFailure(1, 3)).toBe('queued')
    expect(jobStatusAfterFailure(3, 3)).toBe('dead')
    expect(jobStatusAfterFailure(0, 0)).toBe('dead')
  })

  it('lease expiry', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(isJobLeaseExpired(null, now)).toBe(true)
    expect(isJobLeaseExpired('2025-12-31T23:59:59.000Z', now)).toBe(true)
    expect(isJobLeaseExpired('2026-01-01T00:00:01.000Z', now)).toBe(false)
    expect(isJobLeaseExpired('not-a-date', now)).toBe(true)
  })

  it('progress clamp', () => {
    expect(clampJobProgress(-1)).toBe(0)
    expect(clampJobProgress(50.4)).toBe(50)
    expect(clampJobProgress(101)).toBe(100)
    expect(clampJobProgress(Number.NaN)).toBe(0)
  })
})
