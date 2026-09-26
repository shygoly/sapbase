import { MigrationInterface, QueryRunner } from 'typeorm'
import { BLUEPRINT_JOURNAL_ENTRIES_DDL } from '../semantic-runtime/blueprint-journal-entry.ddl'

/**
 * 记账分录：金额用 bigint 小单位 + scale。DDL 只有一份。
 * 时间戳 > 1791100000000。
 */
export class CreateBlueprintJournalEntries1791110000000 implements MigrationInterface {
  name = 'CreateBlueprintJournalEntries1791110000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of BLUEPRINT_JOURNAL_ENTRIES_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.blueprint_journal_entries DROP CONSTRAINT IF EXISTS "FK_5202c3ad4ea898ae6649a4f0f84"`,
    )
    await queryRunner.query(`DROP TABLE IF EXISTS public.blueprint_journal_entries`)
  }
}
