import { MigrationInterface, QueryRunner } from 'typeorm'
import { AGENT_SESSIONS_DDL } from '../agent-sessions/agent-sessions.ddl'

export class CreateAgentSessions1792100000000 implements MigrationInterface {
  name = 'CreateAgentSessions1792100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of AGENT_SESSIONS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['agent_tool_calls', 'agent_turns', 'agent_conversations']) {
      await queryRunner.query(`DROP TABLE IF EXISTS public.${table}`)
    }
  }
}
