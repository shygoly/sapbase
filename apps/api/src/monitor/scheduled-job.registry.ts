export const SCHEDULED_JOBS = [
  {
    jobKey: 'semantic.suggest_transitions',
    cron: '0 2 * * *',
    timeoutMs: 60_000,
    idempotent: true,
  },
  {
    jobKey: 'release.guardrail_check',
    cron: '30 * * * *',
    timeoutMs: 60_000,
    idempotent: true,
  },
  {
    jobKey: 'review.sla_scan',
    cron: '*/10 * * * *',
    timeoutMs: 60_000,
    idempotent: true,
  },
  {
    jobKey: 'notifications.publish_scheduled',
    cron: '*/5 * * * *',
    timeoutMs: 60_000,
    idempotent: true,
  },
  {
    jobKey: 'notifications.cleanup_expired',
    cron: '15 3 * * *',
    timeoutMs: 5 * 60_000,
    idempotent: true,
  },
  {
    jobKey: 'release.review_due',
    cron: '0 9 * * *',
    timeoutMs: 60_000,
    idempotent: true,
  },
] as const
