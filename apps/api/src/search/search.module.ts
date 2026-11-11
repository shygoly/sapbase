import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Asset } from '@sap/platform-core/assets/asset.entity'
import { JobsModule } from '@sap/platform-core/jobs/jobs.module'
import { EventBusModule } from '../common/events/event-bus.module'
import { AIModule } from '../ai-modules/ai-module.entity'
import { Announcement } from '../notifications/announcement.entity'
import { AgentKnowledgeEntry } from '../agent-knowledge/entities/agent-knowledge-entry.entity'
import { SearchDocument } from './search-document.entity'
import { SearchService } from './search.service'
import { SearchController } from './search.controller'
import { SearchIndexJobService } from './search-index-job.service'
import { SearchIndexSubscriber } from './search-index.subscriber'

@Module({
  imports: [
    EventBusModule,
    JobsModule,
    TypeOrmModule.forFeature([
      SearchDocument,
      Announcement,
      Asset,
      AIModule,
      AgentKnowledgeEntry,
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService, SearchIndexJobService, SearchIndexSubscriber],
  exports: [SearchService, SearchIndexJobService],
})
export class SearchModule {}
