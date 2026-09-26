import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AtomicRegistryModule } from '../atomic-registry/atomic-registry.module'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { BlueprintModule } from '../blueprint/blueprint.module'
import { BlueprintApproval } from './blueprint-approval.entity'
import { BlueprintDocCounter } from './blueprint-doc-counter.entity'
import { BlueprintJournalEntry } from './blueprint-journal-entry.entity'
import { BlueprintRecord } from './blueprint-record.entity'
import { SemanticRuntimeController } from './semantic-runtime.controller'
import { SemanticRuntimeService } from './semantic-runtime.service'

@Module({
  imports: [
    BlueprintModule,
    AtomicRegistryModule,
    AuditLogsModule,
    TypeOrmModule.forFeature([
      BlueprintRecord,
      BlueprintDocCounter,
      BlueprintApproval,
      BlueprintJournalEntry,
    ]),
  ],
  controllers: [SemanticRuntimeController],
  providers: [SemanticRuntimeService],
  exports: [SemanticRuntimeService],
})
export class SemanticRuntimeModule {}
