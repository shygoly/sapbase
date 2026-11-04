import { MigrationInterface, QueryRunner } from 'typeorm'
import { BLUEPRINT_RECORDS_DDL } from '../semantic-runtime/blueprint-record.ddl'

/**
 * 语义运行时的通用记录表。DDL 只有一份，见 blueprint-record.ddl.ts。
 * 时间戳 > 1790800000000，沿用 `<ts>-Create<X>` 命名。
 */
export class CreateBlueprintRecords1790900000000 implements MigrationInterface {
  name = 'CreateBlueprintRecords1790900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of BLUEPRINT_RECORDS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.blueprint_records DROP CONSTRAINT IF EXISTS "FK_5aa919422d67fd4edb69df79958"`,
    )
    await queryRunner.query(
      `DROP INDEX IF EXISTS public.idx_blueprint_records_blueprint_entity_org`,
    )
    await queryRunner.query(`DROP TABLE IF EXISTS public.blueprint_records`)
  }
}
