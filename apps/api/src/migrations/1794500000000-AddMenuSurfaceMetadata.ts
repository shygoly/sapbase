import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMenuSurfaceMetadata1794500000000 implements MigrationInterface {
  name = 'AddMenuSurfaceMetadata1794500000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS surface character varying(16) DEFAULT 'both'`,
    )
    await queryRunner.query(
      `ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS "componentKey" character varying(64)`,
    )
    await queryRunner.query(
      `ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS interaction jsonb`,
    )
    await queryRunner.query(
      `UPDATE public.menu_items SET visible = false WHERE path LIKE '/dashboard/shipping%' OR path IN ('/admin/system-settings/fuel', '/admin/system-settings/vessel', '/admin/system-settings/years')`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.menu_items DROP COLUMN IF EXISTS interaction`)
    await queryRunner.query(`ALTER TABLE public.menu_items DROP COLUMN IF EXISTS "componentKey"`)
    await queryRunner.query(`ALTER TABLE public.menu_items DROP COLUMN IF EXISTS surface`)
  }
}
