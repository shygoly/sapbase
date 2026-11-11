import type { JobTypeDefinition } from '@sap/platform-core/jobs/job-types'
import type { AnnouncementsService } from './announcements.service'

export interface AnnouncementFanoutJobPayload {
  announcementId: string
}

export const ANNOUNCEMENT_FANOUT_JOB_TYPE = 'notification.announcement_fanout'

/**
 * `notification.announcement_fanout`：大组织公告扇出。
 *
 * - payload 只有 announcementId，正文/受众始终从数据库重新解析；
 * - 分批 100 人写通知 + delivery，幂等键 `announcement-fanout:<id>` 防重复入队；
 * - 进度/取消/重试由 async-job 统一提供，handler 只做可重入扇出。
 */
export function createAnnouncementFanoutJobDefinition(
  announcements: AnnouncementsService,
): JobTypeDefinition {
  return {
    type: ANNOUNCEMENT_FANOUT_JOB_TYPE,
    typeVersion: 1,
    timeoutMs: 10 * 60_000,
    maxAttempts: 3,
    backoff: { kind: 'exponential', baseMs: 5_000, maxMs: 2 * 60_000 },
    concurrency: 1,
    payloadSchema: {
      type: 'object',
      required: ['announcementId'],
      properties: {
        announcementId: {
          type: 'string',
          pattern: '^[0-9a-fA-F-]{36}$',
        },
      },
      additionalProperties: false,
    },
    handler: async (ctx, rawPayload) => {
      const payload = rawPayload as unknown as AnnouncementFanoutJobPayload
      await ctx.stage('resolving-audience', { announcementId: payload.announcementId })
      const announcement = await announcements.get(ctx.organizationId, payload.announcementId)
      const delivered = await announcements.fanout(ctx.organizationId, announcement, undefined, {
        progress: async (progress, data) => {
          await ctx.progress(progress, data)
        },
        isCancelled: () => ctx.isCancelled(),
      })
      return { result: { announcementId: payload.announcementId, delivered } }
    },
  }
}
