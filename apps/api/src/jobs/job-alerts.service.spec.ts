import { JobAlertsService } from './job-alerts.service'

function queueWith(stats: Record<string, number>, oldest: Date | null = null) {
  return {
    stats: jest.fn(async () => stats),
    oldestQueuedAt: jest.fn(async () => oldest),
  }
}

describe('JobAlertsService', () => {
  it('无异常 → 空告警', async () => {
    const service = new JobAlertsService(
      queueWith({ queued: 1, running: 0, succeeded: 10, failed: 0, dead: 0 }) as never,
    )
    const report = await service.evaluate('org-1', { backlog: 10, failureRate: 0.5 })
    expect(report.alerts).toEqual([])
  })

  it('积压 + 失败率 + 回调失败 + 最老 queued', async () => {
    const service = new JobAlertsService(
      queueWith(
        {
          queued: 30,
          running: 5,
          waiting: 0,
          succeeded: 10,
          failed: 8,
          dead: 2,
          callbackFailed: 20,
        },
        new Date(Date.now() - 90 * 60_000),
      ) as never,
    )
    const report = await service.evaluate('org-1', {
      backlog: 10,
      failureRate: 0.2,
      callbackFailed: 5,
      oldestQueuedMinutes: 30,
    })
    expect(report.alerts.map((alert) => alert.code)).toEqual(
      expect.arrayContaining(['backlog', 'failure-rate', 'callback-failed', 'oldest-queued']),
    )
    expect(report.alerts.find((alert) => alert.code === 'backlog')?.level).toBe('critical')
  })

  it('失败样本不足 10 条不报失败率（避免小样本噪声）', async () => {
    const service = new JobAlertsService(
      queueWith({ succeeded: 1, failed: 1, dead: 0 }) as never,
    )
    const report = await service.evaluate('org-1', { failureRate: 0.1 })
    expect(report.alerts.some((alert) => alert.code === 'failure-rate')).toBe(false)
  })

  it('阈值可被环境变量覆盖', async () => {
    process.env.JOBS_ALERT_BACKLOG = '1'
    try {
      const service = new JobAlertsService(queueWith({ queued: 2 }) as never)
      const report = await service.evaluate('org-1')
      expect(report.alerts.some((alert) => alert.code === 'backlog')).toBe(true)
    } finally {
      delete process.env.JOBS_ALERT_BACKLOG
    }
  })
})
