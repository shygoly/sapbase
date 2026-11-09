import { MigrationInterface, QueryRunner } from 'typeorm'
import {
  RELEASE_AGENT_RLS_DDL,
  RELEASE_AGENT_RLS_TABLES,
} from '../common/rls/release-agent-rls.ddl'

export class EnableReleaseAgentRls1792900000000 implements MigrationInterface {
  name = 'EnableReleaseAgentRls1792900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of RELEASE_AGENT_RLS_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of RELEASE_AGENT_RLS_TABLES) {
      await queryRunner.query(`ALTER TABLE IF EXISTS public.${table} DISABLE ROW LEVEL SECURITY`)
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON public.${table}`)
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_read ON public.${table}`)
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_write ON public.${table}`)
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_parent_isolation ON public.${table}`)
    }
  }
}
