import { MigrationInterface, QueryRunner } from 'typeorm'
import { AGENT_CONFIRMATION_TOKENS_DDL } from '../agent-tools/confirmation-token.ddl'

/**
 * 写工具一次性确认令牌。DDL 只有一份。
 * 时间戳 > 1791400000000。
 */
export class CreateAgentConfirmationTokens1791500000000 implements MigrationInterface {
  name = 'CreateAgentConfirmationTokens1791500000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of AGENT_CONFIRMATION_TOKENS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.agent_confirmation_tokens DROP CONSTRAINT IF EXISTS "FK_14bd7faa76804af32abe4aed6f0"`,
    )
    await queryRunner.query(`DROP TABLE IF EXISTS public.agent_confirmation_tokens`)
  }
}
