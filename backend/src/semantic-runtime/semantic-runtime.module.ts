import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AtomicRegistryModule } from '../atomic-registry/atomic-registry.module'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { BlueprintModule } from '../blueprint/blueprint.module'
import { BlueprintApproval } from './blueprint-approval.entity'
import { BlueprintDocCounter } from './blueprint-doc-counter.entity'
import { BlueprintJournalEntry } from './blueprint-journal-entry.entity'
import { BlueprintRecord } from './blueprint-record.entity'
import { OutboxModule } from '../outbox/outbox.module'
import { SemanticRuntimeController } from './semantic-runtime.controller'
import { SemanticRuntimeService } from './semantic-runtime.service'
import { BlueprintSuggestionLog } from './suggestion-log.entity'
import { SuggestionCronJob } from './suggestion-cron'

@Module({
  imports: [
    BlueprintModule,
    AtomicRegistryModule,
    AuditLogsModule,
    OutboxModule,
    TypeOrmModule.forFeature([
      BlueprintRecord,
      BlueprintDocCounter,
      BlueprintApproval,
      BlueprintJournalEntry,
      BlueprintSuggestionLog,
    ]),
  ],
  controllers: [SemanticRuntimeController],
  providers: [SemanticRuntimeService, SuggestionCronJob],
  exports: [SemanticRuntimeService],
})
export class SemanticRuntimeModule {}
