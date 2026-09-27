import { MigrationInterface, QueryRunner } from 'typeorm'
import { OUTBOX_DDL } from '../outbox/outbox.ddl'

/**
 * 跨进程 outbox：事件表 + 订阅者去重表。DDL 只有一份。
 * 时间戳 > 1791110000000。
 */
export class CreateOutbox1791200000000 implements MigrationInterface {
  name = 'CreateOutbox1791200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of OUTBOX_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.outbox_deliveries DROP CONSTRAINT IF EXISTS "FK_b24a7e1b4c667e72d9f7b5fc204"`,
    )
    await queryRunner.query(`DROP TABLE IF EXISTS public.outbox_deliveries`)
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.outbox_events DROP CONSTRAINT IF EXISTS "FK_7ef528beecf23e5e0134ef8884f"`,
    )
    await queryRunner.query(`DROP TABLE IF EXISTS public.outbox_events`)
  }
}
