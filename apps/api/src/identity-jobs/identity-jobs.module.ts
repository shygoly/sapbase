import { Module } from '@nestjs/common'
import { IdentityModule } from '@sap/platform-core/identity/identity.module'
import { IdentitySyncJobService } from './identity-sync-job.service'

@Module({
  imports: [IdentityModule],
  providers: [IdentitySyncJobService],
})
export class IdentityJobsModule {}
