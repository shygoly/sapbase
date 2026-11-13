import { MigrationInterface, QueryRunner } from 'typeorm'
import { AI_MODEL_SECRETS_DDL } from '../ai-models/ai-model-secrets.ddl'

/** 5.2：模型凭据引用 + requested/resolved 模型调用元数据。 */
export class AddModelSecrets1796500000000 implements MigrationInterface {
  name = 'AddModelSecrets1796500000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of AI_MODEL_SECRETS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.ai_model_calls CASCADE')
    await queryRunner.query('ALTER TABLE public.ai_models DROP COLUMN IF EXISTS "secretRef"')
  }
}
