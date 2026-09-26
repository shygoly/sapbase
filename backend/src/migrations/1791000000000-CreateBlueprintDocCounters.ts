import { MigrationInterface, QueryRunner } from 'typeorm'
import { BLUEPRINT_DOC_COUNTERS_DDL } from '../semantic-runtime/blueprint-doc-counter.ddl'
import { BLUEPRINT_RECORDS_DDL } from '../semantic-runtime/blueprint-record.ddl'

/**
 * 单据单号计数器 + 存量 `blueprint_records` 补 state/version。
 * DDL 只有一份，见 blueprint-doc-counter.ddl.ts / blueprint-record.ddl.ts。
 * 时间戳 > 1790900000000。
 */
export class CreateBlueprintDocCounters1791000000000 implements MigrationInterface {
  name = 'CreateBlueprintDocCounters1791000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 幂等加列：空库基线的 CREATE 已含列时 ALTER 空跑；存量库走这两条。
    for (const statement of BLUEPRINT_RECORDS_DDL) {
      await queryRunner.query(statement)
    }
    for (const statement of BLUEPRINT_DOC_COUNTERS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.blueprint_doc_counters DROP CONSTRAINT IF EXISTS "FK_17d5de0edd64a36ebb42e286d55"`,
    )
    await queryRunner.query(`DROP TABLE IF EXISTS public.blueprint_doc_counters`)
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.blueprint_records DROP COLUMN IF EXISTS version`,
    )
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.blueprint_records DROP COLUMN IF EXISTS state`,
    )
  }
}
