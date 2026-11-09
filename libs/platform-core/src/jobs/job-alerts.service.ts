import { Injectable } from '@nestjs/common'
import { JobQueue } from './job-queue'

export interface JobAlertThresholds {
  backlog?: number
  failureRate?: number
  callbackFailed?: number
  oldestQueuedMinutes?: number
}

export interface JobAlert {
  code: 'backlog' | 'failure-rate' | 'callback-failed' | 'oldest-queued'
  level: 'warning' | 'critical'
  message: string
  value: number
  threshold: number
}

export interface JobAlertReport {
  organizationId: string
  generatedAt: string
  alerts: JobAlert[]
  stats: Record<string, number>
}

const DEFAULTS: Required<JobAlertThresholds> = {
  backlog: 1_000,
  failureRate: 0.2,
  callbackFailed: 10,
  oldestQueuedMinutes: 30,
}

/**
 * 任务告警判定（纯计算）。
 *
 * 这里只产出告警对象；投递到通知中心/邮件/Webhook 由通知 change 消费。
 * 阈值可用参数或环境变量覆盖，便于按租户/环境调整。
 */
@Injectable()
export class JobAlertsService {
  constructor(private readonly queue: JobQueue) {}

  async evaluate(
    organizationId: string,
    overrides: JobAlertThresholds = {},
  ): Promise<JobAlertReport> {
    const thresholds: Required<JobAlertThresholds> = {
      backlog: overrides.backlog ?? envNumber('JOBS_ALERT_BACKLOG', DEFAULTS.backlog),
      failureRate:
        overrides.failureRate ?? envNumber('JOBS_ALERT_FAILURE_RATE', DEFAULTS.failureRate),
      callbackFailed:
        overrides.callbackFailed ?? envNumber('JOBS_ALERT_CALLBACK_FAILED', DEFAULTS.callbackFailed),
      oldestQueuedMinutes:
        overrides.oldestQueuedMinutes ??
        envNumber('JOBS_ALERT_OLDEST_QUEUED_MINUTES', DEFAULTS.oldestQueuedMinutes),
    }
    const stats = await this.queue.stats(organizationId)
    const oldest = await this.queue.oldestQueuedAt(organizationId)
    const alerts: JobAlert[] = []

    const activeBacklog = (stats.queued ?? 0) + (stats.running ?? 0) + (stats.waiting ?? 0)
    if (activeBacklog > thresholds.backlog) {
      alerts.push({
        code: 'backlog',
        level: activeBacklog > thresholds.backlog * 2 ? 'critical' : 'warning',
        message: `任务积压 ${activeBacklog} 超过阈值 ${thresholds.backlog}`,
        value: activeBacklog,
        threshold: thresholds.backlog,
      })
    }

    const finished = (stats.succeeded ?? 0) + (stats.failed ?? 0) + (stats.dead ?? 0)
    const failureRate = finished > 0 ? ((stats.failed ?? 0) + (stats.dead ?? 0)) / finished : 0
    if (finished >= 10 && failureRate > thresholds.failureRate) {
      alerts.push({
        code: 'failure-rate',
        level: failureRate > thresholds.failureRate * 2 ? 'critical' : 'warning',
        message: `任务失败率 ${(failureRate * 100).toFixed(1)}% 超过阈值 ${(thresholds.failureRate * 100).toFixed(0)}%`,
        value: Number(failureRate.toFixed(4)),
        threshold: thresholds.failureRate,
      })
    }

    if ((stats.callbackFailed ?? 0) > thresholds.callbackFailed) {
      alerts.push({
        code: 'callback-failed',
        level: 'warning',
        message: `回调失败 ${stats.callbackFailed} 超过阈值 ${thresholds.callbackFailed}`,
        value: stats.callbackFailed ?? 0,
        threshold: thresholds.callbackFailed,
      })
    }

    if (oldest) {
      const minutes = (Date.now() - oldest.getTime()) / 60_000
      if (minutes > thresholds.oldestQueuedMinutes) {
        alerts.push({
          code: 'oldest-queued',
          level: minutes > thresholds.oldestQueuedMinutes * 2 ? 'critical' : 'warning',
          message: `最老 queued 任务已等待 ${minutes.toFixed(0)} 分钟（阈值 ${thresholds.oldestQueuedMinutes}）`,
          value: Number(minutes.toFixed(1)),
          threshold: thresholds.oldestQueuedMinutes,
        })
      }
    }

    return {
      organizationId,
      generatedAt: new Date().toISOString(),
      alerts,
      stats,
    }
  }
}

function envNumber(key: string, fallback: number): number {
  const value = Number(process.env[key])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}
