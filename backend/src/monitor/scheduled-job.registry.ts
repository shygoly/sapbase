export const SCHEDULED_JOBS = [
  {
    jobKey: 'semantic.suggest_transitions',
    cron: '0 2 * * *',
    timeoutMs: 60_000,
    idempotent: true,
  },
] as const
