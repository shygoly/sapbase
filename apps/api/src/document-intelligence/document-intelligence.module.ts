import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Asset } from '@sap/platform-core/assets/asset.entity'
import { AssetsModule } from '@sap/platform-core/assets/assets.module'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { JobsModule } from '@sap/platform-core/jobs/jobs.module'
import { DocumentParseRun, DocumentSection, DocumentCandidate } from './document.entities'
import { DocumentParserRegistry } from './document-parser'
import { RuleStructureExtractor } from './structure-extractor'
import { DocumentIntelligenceService } from './document-intelligence.service'
import { DocumentIntelligenceJobService } from './document-intelligence-job.service'
import { DocumentIntelligenceController } from './document-intelligence.controller'

@Module({
  imports: [
    JobsModule,
    AssetsModule,
    AuditLogsModule,
    TypeOrmModule.forFeature([
      DocumentParseRun,
      DocumentSection,
      DocumentCandidate,
      Asset,
    ]),
  ],
  controllers: [DocumentIntelligenceController],
  providers: [
    DocumentParserRegistry,
    RuleStructureExtractor,
    DocumentIntelligenceService,
    DocumentIntelligenceJobService,
  ],
  exports: [DocumentIntelligenceService],
})
export class DocumentIntelligenceModule {}
