import { MigrationInterface, QueryRunner } from 'typeorm'

export class PreserveLegacyUserRole1792000000000 implements MigrationInterface {
  name = 'PreserveLegacyUserRole1792000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS public.users
        ADD COLUMN IF NOT EXISTS role character varying(50)`,
    )
    await queryRunner.query(`
      UPDATE public.users u
      SET role = r.name
      FROM public.roles r
      WHERE u."roleId" = r.id
        AND u.role IS NULL
    `)
  }

  public async down(): Promise<void> {
    // The column predates this migration and is read as a compatibility
    // fallback. Do not drop it on rollback.
  }
}
