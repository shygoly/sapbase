import { MigrationInterface, QueryRunner } from 'typeorm'
import { AGENT_FEEDBACK_DDL } from '../agent-feedback/agent-feedback.ddl'

export class CreateAgentFeedback1792300000000 implements MigrationInterface {
  name = 'CreateAgentFeedback1792300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of AGENT_FEEDBACK_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.agent_feedback`)
  }
}
