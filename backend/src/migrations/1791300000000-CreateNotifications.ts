import { MigrationInterface, QueryRunner } from 'typeorm'
import { NOTIFICATIONS_DDL } from '../notifications/notification.ddl'

/**
 * 持久化通知：替换进程内 Map。DDL 只有一份。
 * 时间戳 > 1791200000000。
 */
export class CreateNotifications1791300000000 implements MigrationInterface {
  name = 'CreateNotifications1791300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of NOTIFICATIONS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.notifications DROP CONSTRAINT IF EXISTS "FK_928914a0743f50e6f83a90cdda9"`,
    )
    await queryRunner.query(`DROP TABLE IF EXISTS public.notifications`)
  }
}
