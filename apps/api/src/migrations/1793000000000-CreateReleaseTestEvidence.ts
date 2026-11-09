import { MigrationInterface, QueryRunner } from 'typeorm'
import { RELEASE_TEST_EVIDENCE_DDL } from '../releases/release-test-evidence.ddl'

export class CreateReleaseTestEvidence1793000000000 implements MigrationInterface {
  name = 'CreateReleaseTestEvidence1793000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of RELEASE_TEST_EVIDENCE_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.app_release_test_evidence`)
  }
}
