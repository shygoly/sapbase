import { MigrationInterface, QueryRunner } from 'typeorm'
import { SEARCH_DDL } from '../search/search.ddl'

export class CreateSearchDocuments1794300000000 implements MigrationInterface {
  name = 'CreateSearchDocuments1794300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of SEARCH_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.search_documents CASCADE')
  }
}
