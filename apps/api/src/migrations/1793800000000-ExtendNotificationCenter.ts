import { MigrationInterface, QueryRunner } from 'typeorm'
import { NOTIFICATION_CENTER_DDL } from '../notifications/notification-center.ddl'

export class ExtendNotificationCenter1793800000000 implements MigrationInterface {
  name = 'ExtendNotificationCenter1793800000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of NOTIFICATION_CENTER_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'announcement_deliveries',
      'announcement_audiences',
      'announcements',
      'notification_preferences',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS public.${table} CASCADE`)
    }
    for (const column of ['category', 'priority', 'actionUrl', 'expiresAt', 'readAt', 'mandatory']) {
      await queryRunner.query(`ALTER TABLE public.notifications DROP COLUMN IF EXISTS "${column}"`)
    }
  }
}
