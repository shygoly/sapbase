import { MigrationInterface, QueryRunner } from 'typeorm'
import { RECORD_LIFECYCLE_DDL } from '../record-lifecycle/record-lifecycle.ddl'

export class AddRecordLifecycle1794600000000 implements MigrationInterface {
  name = 'AddRecordLifecycle1794600000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of RECORD_LIFECYCLE_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.record_operations CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.record_snapshots CASCADE')
  }
}
