import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import {
  AppChangeProposal,
  AppDraft,
  AppRelease,
  AppReleaseActivation,
  AppReleaseApproval,
  AppReleaseEvent,
  AppReleaseItem,
  AppUserReleaseView,
} from './entities'
import { ReleasesBuilderController, ReleasesRuntimeController } from './releases.controller'
import { ReleasesService } from './releases.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppDraft,
      AppChangeProposal,
      AppRelease,
      AppReleaseItem,
      AppReleaseActivation,
      AppReleaseApproval,
      AppReleaseEvent,
      AppUserReleaseView,
    ]),
  ],
  controllers: [ReleasesBuilderController, ReleasesRuntimeController],
  providers: [ReleasesService],
  exports: [ReleasesService],
})
export class ReleasesModule {}
