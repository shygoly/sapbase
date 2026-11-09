import { MigrationInterface, QueryRunner } from 'typeorm'
import { AUTH_SESSION_DDL } from '../identity/identity.ddl'

export class CreateAuthSessions1793400000000 implements MigrationInterface {
  name = 'CreateAuthSessions1793400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of AUTH_SESSION_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.auth_sessions CASCADE')
  }
}
