import { MigrationInterface, QueryRunner } from 'typeorm'
import { DOCUMENT_INTELLIGENCE_DDL } from '../document-intelligence/document.ddl'

export class AddDocumentIntelligence1795200000000 implements MigrationInterface {
  name = 'AddDocumentIntelligence1795200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of DOCUMENT_INTELLIGENCE_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.document_candidates CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.document_sections CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.document_parse_runs CASCADE')
  }
}
