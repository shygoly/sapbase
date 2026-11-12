import { MigrationInterface, QueryRunner } from 'typeorm'
import { ENTITLEMENTS_DDL } from '@sap/platform-core/entitlements/entitlements.ddl'
import { TENANT_RLS_DDL } from '@sap/platform-core/common/rls/tenant-rls.ddl'

/**
 * 6.1：应用权益（计划 → 应用/配额）与用量计量。
 * 新表同时套用既有租户 RLS（DDL 幂等，重复执行安全）。
 */
export class AddEntitlementsAndUsage1795800000000 implements MigrationInterface {
  name = 'AddEntitlementsAndUsage1795800000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of ENTITLEMENTS_DDL) {
      await queryRunner.query(statement)
    }
    for (const statement of TENANT_RLS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.app_usage_records CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.app_entitlements CASCADE')
  }
}
