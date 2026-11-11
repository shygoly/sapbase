import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddApprovalFinalStep1794900000000 implements MigrationInterface {
  name = 'AddApprovalFinalStep1794900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.blueprint_approvals ADD COLUMN IF NOT EXISTS "subjectAuthor" uuid`,
    )
    await queryRunner.query(
      `ALTER TABLE public.blueprint_approvals ADD COLUMN IF NOT EXISTS "finalStep" boolean DEFAULT false NOT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.blueprint_approvals DROP COLUMN IF EXISTS "finalStep"`)
    await queryRunner.query(`ALTER TABLE public.blueprint_approvals DROP COLUMN IF EXISTS "subjectAuthor"`)
  }
}
