import { MigrationInterface, QueryRunner } from 'typeorm'
import { BUSINESS_APP_INSTALLATIONS_DDL } from '../business-apps/business-app-installation.ddl'

export class CreateBusinessAppInstallations1791600000000 implements MigrationInterface {
  name = 'CreateBusinessAppInstallations1791600000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of BUSINESS_APP_INSTALLATIONS_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.app_installations`)
  }
}
