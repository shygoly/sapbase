import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRecordArchiveColumns1794700000000 implements MigrationInterface {
  name = 'AddRecordArchiveColumns1794700000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.blueprint_records ADD COLUMN IF NOT EXISTS "archivedAt" timestamp with time zone`,
    )
    await queryRunner.query(
      `ALTER TABLE public.blueprint_records ADD COLUMN IF NOT EXISTS "archivedBy" character varying(255)`,
    )
    await queryRunner.query(
      `ALTER TABLE public.blueprint_records ADD COLUMN IF NOT EXISTS "archiveReason" text`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.blueprint_records DROP COLUMN IF EXISTS "archiveReason"`)
    await queryRunner.query(`ALTER TABLE public.blueprint_records DROP COLUMN IF EXISTS "archivedBy"`)
    await queryRunner.query(`ALTER TABLE public.blueprint_records DROP COLUMN IF EXISTS "archivedAt"`)
  }
}
