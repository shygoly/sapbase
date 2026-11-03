import { MigrationInterface, QueryRunner } from 'typeorm'
import { AGENT_KNOWLEDGE_DDL } from '../agent-knowledge/agent-knowledge.ddl'
import { AGENT_EVAL_DDL } from '../agent-eval/agent-eval.ddl'

export class CreateAgentKnowledgeAndEval1792200000000 implements MigrationInterface {
  name = 'CreateAgentKnowledgeAndEval1792200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of [...AGENT_KNOWLEDGE_DDL, ...AGENT_EVAL_DDL]) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['agent_eval_runs', 'agent_eval_cases', 'agent_skill_versions', 'agent_knowledge_entries']) {
      await queryRunner.query(`DROP TABLE IF EXISTS public.${table}`)
    }
  }
}
