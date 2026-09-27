import { MigrationInterface, QueryRunner } from 'typeorm'
import { SUGGESTION_LOG_DDL } from '../semantic-runtime/suggestion-log.ddl'

/**
 * 夜间建议日志。DDL 只有一份。
 * 时间戳 > 1791300000000。
 */
export class CreateBlueprintSuggestionLogs1791400000000 implements MigrationInterface {
  name = 'CreateBlueprintSuggestionLogs1791400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of SUGGESTION_LOG_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.blueprint_suggestion_logs DROP CONSTRAINT IF EXISTS "FK_88a3056b00cc91c66ab54a7fe05"`,
    )
    await queryRunner.query(`DROP TABLE IF EXISTS public.blueprint_suggestion_logs`)
  }
}
