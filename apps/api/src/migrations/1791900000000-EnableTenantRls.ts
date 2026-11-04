import { MigrationInterface, QueryRunner } from 'typeorm'
import { TENANT_RLS_DDL } from '../common/rls/tenant-rls.ddl'

export class EnableTenantRls1791900000000 implements MigrationInterface {
  name = 'EnableTenantRls1791900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of TENANT_RLS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE table_name text;
      BEGIN
        FOR table_name IN
          SELECT c.relname
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r'
        LOOP
          EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', table_name);
          EXECUTE format('DROP POLICY IF EXISTS tenant_parent_isolation ON public.%I', table_name);
          EXECUTE format('ALTER TABLE IF EXISTS public.%I DISABLE ROW LEVEL SECURITY', table_name);
        END LOOP;
      END $$;
    `)
    await queryRunner.query(`DROP POLICY IF EXISTS atomic_contracts_read ON public.atomic_contracts`)
    await queryRunner.query(`DROP POLICY IF EXISTS atomic_contracts_write ON public.atomic_contracts`)
    await queryRunner.query(
      `DROP POLICY IF EXISTS atomic_implementations_parent ON public.atomic_implementations`,
    )
    await queryRunner.query(`DROP FUNCTION IF EXISTS public.current_user_id()`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS public.current_app_installation_id()`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS public.current_organization_id()`)
  }
}
