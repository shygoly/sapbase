import { Injectable, Module, OnModuleInit } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AssetsModule } from '@sap/platform-core/assets/assets.module'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { JobsModule } from '@sap/platform-core/jobs/jobs.module'
import { BlueprintModule } from '../blueprint/blueprint.module'
import { SemanticRuntimeModule } from '../semantic-runtime/semantic-runtime.module'
import { User } from '../users/user.entity'
import { Role } from '../roles/role.entity'
import { OrganizationMember } from '../organizations/organization-member.entity'
import { Department } from '../departments/department.entity'
import { ImportMapping, ImportRun, ExportRun } from './bulk.entities'
import { BulkAdapterRegistry } from './bulk.registry'
import { BlueprintBulkAdapter } from './blueprint-bulk.adapter'
import { PlatformBulkAdapter } from './platform-bulk.adapter'
import { BulkService } from './bulk.service'
import { BulkJobService } from './bulk-job.service'
import {
  BulkExportsController,
  BulkImportMappingsController,
  BulkImportsController,
} from './bulk.controller'

@Injectable()
export class BulkAdapterBootstrap implements OnModuleInit {
  constructor(
    private readonly registry: BulkAdapterRegistry,
    private readonly blueprint: BlueprintBulkAdapter,
    private readonly platform: PlatformBulkAdapter,
  ) {}

  onModuleInit(): void {
    this.registry.registerImport(this.blueprint)
    this.registry.registerExport(this.blueprint)
    this.registry.registerImport(this.platform)
    this.registry.registerExport(this.platform)
  }
}

@Module({
  imports: [
    BlueprintModule,
    SemanticRuntimeModule,
    AssetsModule,
    AuditLogsModule,
    JobsModule,
    TypeOrmModule.forFeature([
      ImportRun,
      ExportRun,
      ImportMapping,
      User,
      Role,
      OrganizationMember,
      Department,
    ]),
  ],
  controllers: [
    BulkImportsController,
    BulkExportsController,
    BulkImportMappingsController,
  ],
  providers: [
    BulkAdapterRegistry,
    BlueprintBulkAdapter,
    PlatformBulkAdapter,
    BulkAdapterBootstrap,
    BulkService,
    BulkJobService,
  ],
  exports: [BulkService, BulkAdapterRegistry],
})
export class BulkModule {}
