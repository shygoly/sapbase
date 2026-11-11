import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import type { IEventHandler } from '../common/events/i-event-handler'
import { EventBusService } from '../common/events/event-bus.service'
import { SearchIndexJobService } from './search-index-job.service'

export interface SearchIndexEvent {
  topic: string
  payload: Record<string, unknown>
}

/**
 * 资源事件 → 搜索索引任务。
 * 生产方只负责 dispatchToSubscribers(topic, payload)；索引细节不回流业务事务。
 */
@Injectable()
export class SearchIndexSubscriber
  implements IEventHandler<SearchIndexEvent>, OnModuleInit
{
  private readonly logger = new Logger(SearchIndexSubscriber.name)
  private static readonly TOPICS = [
    'announcement.published',
    'announcement.updated',
    'asset.ready',
    'asset.updated',
    'ai_module.published',
    'ai_module.updated',
    'agent.knowledge.published',
  ]

  constructor(
    private readonly eventBus: EventBusService,
    private readonly indexJobs: SearchIndexJobService,
  ) {}

  onModuleInit(): void {
    for (const topic of SearchIndexSubscriber.TOPICS) {
      this.eventBus.subscribe(topic, this)
    }
  }

  async handle(event: SearchIndexEvent): Promise<void> {
    const organizationId = String(event.payload?.organizationId ?? '')
    const resourceKey = this.resourceKeyForTopic(event.topic)
    const resourceId = this.resourceIdForTopic(event.topic, event.payload ?? {})
    if (!organizationId || !resourceKey || !resourceId) {
      this.logger.warn(`搜索索引事件跳过：topic=${event.topic}`)
      return
    }
    await this.indexJobs.enqueueIndex(organizationId, resourceKey, resourceId)
  }

  private resourceKeyForTopic(topic: string): string | null {
    if (topic.startsWith('announcement.')) return 'announcement'
    if (topic.startsWith('asset.')) return 'asset'
    if (topic.startsWith('ai_module.')) return 'ai_module'
    if (topic.startsWith('agent.knowledge.')) return 'agent_knowledge'
    return null
  }

  private resourceIdForTopic(
    topic: string,
    payload: Record<string, unknown>,
  ): string | null {
    const candidates =
      topic.startsWith('announcement.')
        ? ['announcementId', 'id', 'resourceId']
        : topic.startsWith('asset.')
          ? ['assetId', 'id', 'resourceId']
          : topic.startsWith('ai_module.')
            ? ['moduleId', 'aiModuleId', 'id', 'resourceId']
            : ['entryId', 'knowledgeId', 'id', 'resourceId']
    for (const key of candidates) {
      const value = payload[key]
      if (typeof value === 'string' && value.length > 0) return value
    }
    return null
  }
}
