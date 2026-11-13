import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { BlueprintRelease } from './blueprint-release.entity'
import { BlueprintReleasesController } from './blueprint-releases.controller'
import { BlueprintReleasesService } from './blueprint-releases.service'

@Module({
  imports: [TypeOrmModule.forFeature([BlueprintRelease]), AuditLogsModule],
  controllers: [BlueprintReleasesController],
  providers: [BlueprintReleasesService],
  exports: [BlueprintReleasesService, TypeOrmModule],
})
export class BlueprintReleasesModule {}
