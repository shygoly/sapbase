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
    jobKey: 'metrics.snapshot_scan',
    cron: '30 1 * * *',
    timeoutMs: 10 * 60_000,
    idempotent: true,
  },
  {
    jobKey: 'metrics.alert_scan',
    cron: '*/30 * * * *',
    timeoutMs: 5 * 60_000,
    idempotent: true,
  },
  {
    jobKey: 'audit.checkpoint_scan',
    cron: '0 2 * * *',
    timeoutMs: 10 * 60_000,
    idempotent: true,
  },
  {
    jobKey: 'audit.verify_scan',
    cron: '30 2 * * *',
    timeoutMs: 10 * 60_000,
    idempotent: true,
  },
  {
    jobKey: 'audit.retention_scan',
    cron: '0 3 * * *',
    timeoutMs: 10 * 60_000,
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
