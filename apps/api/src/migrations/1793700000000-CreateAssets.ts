import { MigrationInterface, QueryRunner } from 'typeorm'
import { ASSET_DDL } from '../assets/assets.ddl'

export class CreateAssets1793700000000 implements MigrationInterface {
  name = 'CreateAssets1793700000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of ASSET_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['asset_upload_sessions', 'asset_variants', 'assets']) {
      await queryRunner.query(`DROP TABLE IF EXISTS public.${table} CASCADE`)
    }
  }
}
