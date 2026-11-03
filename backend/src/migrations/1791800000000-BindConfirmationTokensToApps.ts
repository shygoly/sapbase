import { MigrationInterface, QueryRunner } from 'typeorm'
import { AGENT_CONFIRMATION_TOKENS_DDL } from '../agent-tools/confirmation-token.ddl'

export class BindConfirmationTokensToApps1791800000000
  implements MigrationInterface
{
  name = 'BindConfirmationTokensToApps1791800000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of AGENT_CONFIRMATION_TOKENS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.agent_confirmation_tokens
        DROP CONSTRAINT IF EXISTS "FK_agent_confirmation_tokens_app_installation"`,
    )
    await queryRunner.query(
      `DROP INDEX IF EXISTS public.idx_agent_confirmation_tokens_app_installation`,
    )
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.agent_confirmation_tokens
        DROP COLUMN IF EXISTS "appInstallationId"`,
    )
  }
}
