/**
 * 异步任务状态机（纯逻辑，不碰 IO）。
 *
 * 状态：
 *   queued → running → succeeded
 *                    ↘ failed → queued(重试) / dead(DLQ)
 *   queued/running/waiting → cancelled
 *   waiting → running
 *
 * 语义：至少一次 + 幂等；exactly-once 不在 v1 承诺内。
 */

export type JobStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'dead'

export type JobBackoff =
  | { kind: 'fixed'; baseMs: number; maxMs?: number }
  | { kind: 'exponential'; baseMs: number; maxMs?: number }

export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = [
  'succeeded',
  'cancelled',
  'dead',
]

const TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  queued: ['running', 'cancelled'],
  running: ['succeeded', 'failed', 'waiting', 'cancelled'],
  waiting: ['running', 'failed', 'cancelled'],
  failed: ['queued', 'dead', 'cancelled'],
  succeeded: [],
  cancelled: [],
  dead: ['queued'],
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.includes(status)
}

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function assertJobTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransitionJob(from, to)) {
    throw new Error(`非法任务状态迁移：${from} → ${to}`)
  }
}

export function nextRetryDelayMs(attempt: number, backoff: JobBackoff): number {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1
  const base = Math.max(1, Math.floor(backoff.baseMs))
  const max = Math.max(base, Math.floor(backoff.maxMs ?? Number.MAX_SAFE_INTEGER))
  const raw =
    backoff.kind === 'fixed'
      ? base
      : base * Math.pow(2, Math.min(safeAttempt - 1, 30))
  return Math.min(raw, max)
}

export function shouldRetryJob(attempts: number, maxAttempts: number): boolean {
  return Number.isFinite(maxAttempts) && attempts < Math.max(0, Math.floor(maxAttempts))
}

export function jobStatusAfterFailure(attempts: number, maxAttempts: number): JobStatus {
  return shouldRetryJob(attempts, maxAttempts) ? 'queued' : 'dead'
}

export function isJobLeaseExpired(
  leaseUntil: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!leaseUntil) return true
  const ts = new Date(leaseUntil).getTime()
  if (!Number.isFinite(ts)) return true
  return ts <= now.getTime()
}

export function clampJobProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  return Math.max(0, Math.min(100, Math.round(progress)))
}
