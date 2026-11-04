import { Inject, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type {
  ReleaseNotificationInput,
  ReleaseNotificationStore,
} from '@sap/platform-release/releases/release-ports'
import { NotificationRecord } from '../notifications/notification.entity'

/**
 * 应用层适配器：把 platform-release 的通知端口落到 notifications 表。
 * 通知实体属于应用层，不能反向进入 platform-release。
 */
@Injectable()
export class ReleaseNotificationAdapter implements ReleaseNotificationStore {
  constructor(
    @InjectRepository(NotificationRecord)
    private readonly repository: Repository<NotificationRecord>,
  ) {}

  create(input: ReleaseNotificationInput): ReleaseNotificationInput {
    return this.repository.create(input as never) as unknown as ReleaseNotificationInput
  }

  async save(entity: ReleaseNotificationInput): Promise<unknown> {
    return this.repository.save(entity as never)
  }
}
