import { MigrationInterface, QueryRunner } from 'typeorm'
import { IDENTITY_DDL } from '../identity/identity.ddl'

export class CreateIdentity1793300000000 implements MigrationInterface {
  name = 'CreateIdentity1793300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of IDENTITY_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.organization_member_roles CASCADE')
  }
}
