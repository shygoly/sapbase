import { MigrationInterface, QueryRunner } from 'typeorm'
import { APP_CATALOG_DDL } from '../app-catalog/app-catalog.ddl'
import { TENANT_RLS_DDL } from '@sap/platform-core/common/rls/tenant-rls.ddl'

/** 3.3：应用级角色/权限与品牌配置。 */
export class AddAppCatalog1795900000000 implements MigrationInterface {
  name = 'AddAppCatalog1795900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of APP_CATALOG_DDL) {
      await queryRunner.query(statement)
    }
    for (const statement of TENANT_RLS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.app_brand_configs CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.app_role_bindings CASCADE')
  }
}
