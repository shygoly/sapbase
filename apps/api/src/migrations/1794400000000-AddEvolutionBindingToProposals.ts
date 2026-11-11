import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 实例演进提议绑定：platformVersion + evolutionScope。
 * 旧提议保留 NULL；批准时 fail-closed 拒绝缺绑定的提议。
 */
export class AddEvolutionBindingToProposals1794400000000 implements MigrationInterface {
  name = 'AddEvolutionBindingToProposals1794400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE public.app_change_proposals ADD COLUMN IF NOT EXISTS "platformVersion" character varying(64)',
    )
    await queryRunner.query(
      'ALTER TABLE public.app_change_proposals ADD COLUMN IF NOT EXISTS "evolutionScope" text[]',
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE public.app_change_proposals DROP COLUMN IF EXISTS "evolutionScope"',
    )
    await queryRunner.query(
      'ALTER TABLE public.app_change_proposals DROP COLUMN IF EXISTS "platformVersion"',
    )
  }
}
