import { MigrationInterface, QueryRunner } from 'typeorm'
import { AI_GOVERNANCE_DDL } from '../ai-governance/ai-governance.ddl'

export class AddAiContentGovernance1794800000000 implements MigrationInterface {
  name = 'AddAiContentGovernance1794800000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of AI_GOVERNANCE_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.ai_score_records CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.ai_content_labels CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.ai_content_provenance CASCADE')
  }
}
