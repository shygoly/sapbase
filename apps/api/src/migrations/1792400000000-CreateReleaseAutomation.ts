import { MigrationInterface, QueryRunner } from 'typeorm'
import { RELEASE_AUTOMATION_DDL } from '../release-automation/release-automation.ddl'

export class CreateReleaseAutomation1792400000000 implements MigrationInterface {
  name = 'CreateReleaseAutomation1792400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of RELEASE_AUTOMATION_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['release_automation_runs', 'release_automation_policies']) {
      await queryRunner.query(`DROP TABLE IF EXISTS public.${table}`)
    }
  }
}
