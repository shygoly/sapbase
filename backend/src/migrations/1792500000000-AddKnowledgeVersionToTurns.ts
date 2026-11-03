import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddKnowledgeVersionToTurns1792500000000 implements MigrationInterface {
  name = 'AddKnowledgeVersionToTurns1792500000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.agent_turns ADD COLUMN IF NOT EXISTS "knowledgeVersion" character varying(128)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.agent_turns DROP COLUMN IF EXISTS "knowledgeVersion"`)
  }
}
