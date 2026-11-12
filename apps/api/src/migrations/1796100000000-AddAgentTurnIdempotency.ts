import { MigrationInterface, QueryRunner } from 'typeorm'

/** 4.6：Agent turn 幂等键，支持同组织内重试去重。 */
export class AddAgentTurnIdempotency1796100000000 implements MigrationInterface {
  name = 'AddAgentTurnIdempotency1796100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.agent_turns ADD COLUMN IF NOT EXISTS "idempotencyKey" character varying(128)`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_agent_turns_org_idempotency"
         ON public.agent_turns ("organizationId", "idempotencyKey")
         WHERE "idempotencyKey" IS NOT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS public."UQ_agent_turns_org_idempotency"')
    await queryRunner.query(
      `ALTER TABLE public.agent_turns DROP COLUMN IF EXISTS "idempotencyKey"`,
    )
  }
}
