import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AssetsModule } from '@sap/platform-core/assets/assets.module'
import { JobsModule } from '@sap/platform-core/jobs/jobs.module'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { AgentSessionsModule } from '../agent-sessions/agent-sessions.module'
import { AIModelsModule } from '../ai-models/ai-models.module'
import { SemanticRuntimeModule } from '../semantic-runtime/semantic-runtime.module'
import { BlueprintRecord } from '../semantic-runtime/blueprint-record.entity'
import { AgentLongTaskJobService } from './agent-long-task-job.service'
import { AiContentJobService } from './ai-content-job.service'
import { AssetJobService } from './asset-job.service'
import { DataTransferJobService } from './data-transfer-job.service'
import { DocumentParseJobService } from './document-parse-job.service'

/**
 * 下游消费者适配：把现有资产/文档/AI/Agent/导入导出能力注册为 job type。
 * 队列与 worker 仍只有一套（platform-core jobs）。
 */
@Module({
  imports: [
    JobsModule,
    AuditLogsModule,
    AssetsModule,
    AIModelsModule,
    AgentSessionsModule,
    SemanticRuntimeModule,
    TypeOrmModule.forFeature([BlueprintRecord]),
  ],
  providers: [
    AssetJobService,
    DocumentParseJobService,
    AiContentJobService,
    AgentLongTaskJobService,
    DataTransferJobService,
  ],
})
export class AsyncConsumersModule {}
