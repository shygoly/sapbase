import { Module } from '@nestjs/common'
import { AtomicRegistryModule } from '../atomic-registry/atomic-registry.module'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { BlueprintController } from './blueprint.controller'
import { BlueprintService } from './blueprint.service'

@Module({
  imports: [AtomicRegistryModule, AuditLogsModule],
  controllers: [BlueprintController],
  providers: [BlueprintService],
  exports: [BlueprintService],
})
export class BlueprintModule {}
