import { MigrationInterface, QueryRunner } from 'typeorm'
import { APP_CAPABILITIES_DDL } from '../app-capabilities/app-capabilities.ddl'
import { TENANT_RLS_DDL } from '@sap/platform-core/common/rls/tenant-rls.ddl'

/** 3.7：显式跨应用数据能力注册表。 */
export class AddAppCapabilities1796000000000 implements MigrationInterface {
  name = 'AddAppCapabilities1796000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of APP_CAPABILITIES_DDL) {
      await queryRunner.query(statement)
    }
    for (const statement of TENANT_RLS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.app_capabilities CASCADE')
  }
}
