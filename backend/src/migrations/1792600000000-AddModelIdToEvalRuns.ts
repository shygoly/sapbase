import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddModelIdToEvalRuns1792600000000 implements MigrationInterface {
  name = 'AddModelIdToEvalRuns1792600000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.agent_eval_runs ADD COLUMN IF NOT EXISTS "modelId" character varying(128)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.agent_eval_runs DROP COLUMN IF EXISTS "modelId"`)
  }
}
