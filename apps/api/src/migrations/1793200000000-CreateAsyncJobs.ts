import { MigrationInterface, QueryRunner } from 'typeorm'
import { ASYNC_JOB_DDL } from '../jobs/jobs.ddl'

export class CreateAsyncJobs1793200000000 implements MigrationInterface {
  name = 'CreateAsyncJobs1793200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of ASYNC_JOB_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['job_events', 'job_attempts', 'jobs']) {
      await queryRunner.query(`DROP TABLE IF EXISTS public.${table} CASCADE`)
    }
  }
}
