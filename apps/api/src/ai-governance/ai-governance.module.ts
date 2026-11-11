import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'
import { ReviewEvent } from '../review/review-event.entity'
import { AiContentLabel, AiContentProvenance, AiScoreRecord } from './ai-governance.entities'
import { AiGovernanceController } from './ai-governance.controller'
import { AiGovernanceService } from './ai-governance.service'

@Module({
  imports: [
    AuditLogsModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      AiContentProvenance,
      AiContentLabel,
      AiScoreRecord,
      BlueprintApproval,
      ReviewEvent,
    ]),
  ],
  controllers: [AiGovernanceController],
  providers: [AiGovernanceService],
  exports: [AiGovernanceService],
})
export class AiGovernanceModule {}
