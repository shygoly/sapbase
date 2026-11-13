import { MigrationInterface, QueryRunner } from 'typeorm'
import { AGENT_SESSIONS_DDL } from '../agent-sessions/agent-sessions.ddl'
import { TENANT_RLS_DDL } from '@sap/platform-core/common/rls/tenant-rls.ddl'

/** 4.1–4.4/4.9：Agent Definition/Instance/Run/Step/Wait 与 app-scoped session。 */
export class AddAgentRuntime1796300000000 implements MigrationInterface {
  name = 'AddAgentRuntime1796300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of AGENT_SESSIONS_DDL) {
      await queryRunner.query(statement)
    }
    for (const statement of TENANT_RLS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.agent_waits CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.agent_steps CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.agent_runs CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.agent_instances CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.agent_definitions CASCADE')
  }
}
