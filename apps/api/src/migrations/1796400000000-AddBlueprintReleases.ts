import { MigrationInterface, QueryRunner } from 'typeorm'
import { BLUEPRINT_RELEASES_DDL } from '../blueprint-releases/blueprint-releases.ddl'
import { TENANT_RLS_DDL } from '@sap/platform-core/common/rls/tenant-rls.ddl'

/** 2.2：不可变 Blueprint release 登记 + 安装绑定；存量安装回填 legacy release。 */
export class AddBlueprintReleases1796400000000 implements MigrationInterface {
  name = 'AddBlueprintReleases1796400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of BLUEPRINT_RELEASES_DDL) {
      await queryRunner.query(statement)
    }
    await queryRunner.query(
      `INSERT INTO public.blueprint_releases
         (id, "createdAt", "updatedAt", "organizationId", "blueprintId",
          version, "packageId", "releaseDigest", "runtimeRequirement",
          "trustStatus", layers, metadata, "createdById")
       SELECT public.uuid_generate_v4(), ai."createdAt", now(), ai."organizationId",
              ai."blueprintId", ai."blueprintVersion",
              ai."blueprintId" || '-' || ai."blueprintVersion",
              ai."releaseDigest", ai."runtimeRequirement", 'legacy',
              '{}'::jsonb, '{"backfilled":true}'::jsonb, ai."createdById"
         FROM public.app_installations ai
        WHERE NOT EXISTS (
          SELECT 1 FROM public.blueprint_releases r
           WHERE r."organizationId" = ai."organizationId"
             AND r."blueprintId" = ai."blueprintId"
             AND r.version = ai."blueprintVersion"
        )`,
    )
    await queryRunner.query(
      `UPDATE public.app_installations ai
          SET "releaseId" = r.id
         FROM public.blueprint_releases r
        WHERE ai."releaseId" IS NULL
          AND r."organizationId" = ai."organizationId"
          AND r."blueprintId" = ai."blueprintId"
          AND r.version = ai."blueprintVersion"`,
    )
    for (const statement of TENANT_RLS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.app_installations DROP CONSTRAINT IF EXISTS "FK_app_installations_blueprint_release"`,
    )
    await queryRunner.query(
      `ALTER TABLE public.app_installations DROP COLUMN IF EXISTS "releaseId"`,
    )
    await queryRunner.query('DROP TABLE IF EXISTS public.blueprint_releases CASCADE')
  }
}
