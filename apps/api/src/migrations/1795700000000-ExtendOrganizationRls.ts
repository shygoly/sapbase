import { MigrationInterface, QueryRunner } from 'typeorm'
import { TENANT_RLS_DDL } from '@sap/platform-core/common/rls/tenant-rls.ddl'

/**
 * 2.5b：把 RLS 扩展到 organization_members 与 organizations onboarding/
 * control-plane 写入。复用单一 DDL 真源，up 幂等。
 */
export class ExtendOrganizationRls1795700000000 implements MigrationInterface {
  name = 'ExtendOrganizationRls1795700000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of TENANT_RLS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const policy of [
      'organizations_select',
      'organizations_insert',
      'organizations_update',
      'organizations_delete',
      'organization_members_self_read',
      'organization_members_onboarding_insert',
    ]) {
      const table = policy.startsWith('organizations_')
        ? 'organizations'
        : 'organization_members'
      await queryRunner.query(
        `DROP POLICY IF EXISTS ${policy} ON public.${table}`,
      )
    }
  }
}
