import { MigrationInterface, QueryRunner } from 'typeorm'
import { DATA_SCOPE_DDL } from '../data-scope/data-scope.ddl'

export class CreateDataScope1793100000000 implements MigrationInterface {
  name = 'CreateDataScope1793100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of DATA_SCOPE_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'scope_memberships',
      'scope_nodes',
      'scope_bindings',
      'data_policies',
      'scope_versions',
      'scope_dimensions',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS public.${table} CASCADE`)
    }
  }
}
