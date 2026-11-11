import { MigrationInterface, QueryRunner } from 'typeorm'
import { NOTIFICATION_RETENTION_DDL } from '../notifications/notification-retention.ddl'

export class AddNotificationRetention1794100000000 implements MigrationInterface {
  name = 'AddNotificationRetention1794100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of NOTIFICATION_RETENTION_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.notification_cleanup_runs CASCADE')
    await queryRunner.query(
      'ALTER TABLE public.announcement_deliveries DROP COLUMN IF EXISTS "deletedAt"',
    )
    await queryRunner.query('ALTER TABLE public.announcements DROP COLUMN IF EXISTS attachments')
    await queryRunner.query('ALTER TABLE public.announcements DROP COLUMN IF EXISTS "deletedAt"')
    await queryRunner.query('ALTER TABLE public.announcements DROP COLUMN IF EXISTS "retentionDays"')
    await queryRunner.query('ALTER TABLE public.notifications DROP COLUMN IF EXISTS "deletedAt"')
  }
}
