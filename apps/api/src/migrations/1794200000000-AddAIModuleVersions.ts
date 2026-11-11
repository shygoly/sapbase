import { MigrationInterface, QueryRunner } from 'typeorm'
import { AI_MODULE_VERSION_DDL } from '../ai-modules/ai-module-version.ddl'

export class AddAIModuleVersions1794200000000 implements MigrationInterface {
  name = 'AddAIModuleVersions1794200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of AI_MODULE_VERSION_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.ai_module_versions CASCADE')
  }
}
