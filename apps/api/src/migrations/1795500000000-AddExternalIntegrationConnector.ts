import { MigrationInterface, QueryRunner } from 'typeorm'
import { INTEGRATION_DDL } from '../integrations/integrations.ddl'

export class AddExternalIntegrationConnector1795500000000 implements MigrationInterface {
  name = 'AddExternalIntegrationConnector1795500000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of INTEGRATION_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.data_sync_runs CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.data_sync_jobs CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.data_sources CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.webhook_events CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.webhook_endpoints CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.outbound_messages CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.integration_connectors CASCADE')
  }
}
