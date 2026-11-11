import { MigrationInterface, QueryRunner } from 'typeorm'
import { OFFLINE_DDL } from '../offline/offline.ddl'

export class AddOfflineContent1795100000000 implements MigrationInterface {
  name = 'AddOfflineContent1795100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of OFFLINE_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.offline_devices CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.offline_entitlements CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.offline_packages CASCADE')
  }
}
