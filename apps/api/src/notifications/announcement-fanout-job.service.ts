import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import {
  ANNOUNCEMENT_FANOUT_JOB_TYPE,
  createAnnouncementFanoutJobDefinition,
} from './announcement-fanout.job'
import { AnnouncementsService } from './announcements.service'

/**
 * 注册公告扇出任务类型；实际领取/执行由 async-job worker 完成。
 */
@Injectable()
export class AnnouncementFanoutJobService implements OnModuleInit {
  private readonly logger = new Logger(AnnouncementFanoutJobService.name)

  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly announcements: AnnouncementsService,
  ) {}

  onModuleInit(): void {
    if (this.registry.has(ANNOUNCEMENT_FANOUT_JOB_TYPE)) return
    this.registry.register(createAnnouncementFanoutJobDefinition(this.announcements))
    this.logger.log(`任务类型已注册：${ANNOUNCEMENT_FANOUT_JOB_TYPE}`)
  }
}
