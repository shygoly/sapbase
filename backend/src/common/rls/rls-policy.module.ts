import { Module } from '@nestjs/common'
import { RlsPolicyService } from './rls-policy.service'

@Module({
  providers: [RlsPolicyService],
  exports: [RlsPolicyService],
})
export class RlsPolicyModule {}
