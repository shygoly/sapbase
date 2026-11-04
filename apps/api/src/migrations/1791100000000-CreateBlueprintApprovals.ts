import { MigrationInterface, QueryRunner } from 'typeorm'
import { BLUEPRINT_APPROVALS_DDL } from '../semantic-runtime/blueprint-approval.ddl'

/**
 * 审批链：一行 = 链上一步。DDL 只有一份，见 blueprint-approval.ddl.ts。
 * 时间戳 > 1791000000000。
 */
export class CreateBlueprintApprovals1791100000000 implements MigrationInterface {
  name = 'CreateBlueprintApprovals1791100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of BLUEPRINT_APPROVALS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.blueprint_approvals DROP CONSTRAINT IF EXISTS "FK_072c93b172cbcc9c5c3fc539792"`,
    )
    await queryRunner.query(`DROP TABLE IF EXISTS public.blueprint_approvals`)
  }
}
