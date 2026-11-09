import { MigrationInterface, QueryRunner } from 'typeorm'
import { IDENTITY_FEDERATION_DDL } from '../identity/identity.ddl'

export class CreateIdentityFederation1793500000000 implements MigrationInterface {
  name = 'CreateIdentityFederation1793500000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of IDENTITY_FEDERATION_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'service_clients',
      'identity_sync_runs',
      'auth_login_events',
      'identity_links',
      'identity_providers',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS public.${table} CASCADE`)
    }
  }
}
