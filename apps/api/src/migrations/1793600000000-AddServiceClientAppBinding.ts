import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddServiceClientAppBinding1793600000000 implements MigrationInterface {
  name = 'AddServiceClientAppBinding1793600000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.service_clients
         ADD COLUMN IF NOT EXISTS "appInstallationId" uuid`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_service_client_org_app
         ON public.service_clients USING btree ("organizationId", "appInstallationId")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_service_client_org_app`,
    )
    await queryRunner.query(
      `ALTER TABLE public.service_clients DROP COLUMN IF EXISTS "appInstallationId"`,
    )
  }
}
