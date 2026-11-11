import { MigrationInterface, QueryRunner } from 'typeorm'
import { METRICS_DDL } from '../metrics/metrics.ddl'

export class AddMetricsPlatform1795000000000 implements MigrationInterface {
  name = 'AddMetricsPlatform1795000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of METRICS_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'metric_alert_events',
      'metric_alerts',
      'dashboard_widgets',
      'dashboards',
      'metric_values',
      'metric_definitions',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS public.${table} CASCADE`)
    }
  }
}
