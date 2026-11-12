import { MigrationInterface, QueryRunner } from 'typeorm'
import { BULK_DDL } from '../bulk/bulk.ddl'

export class AddBulkImportExport1795300000000 implements MigrationInterface {
  name = 'AddBulkImportExport1795300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of BULK_DDL) await queryRunner.query(statement)
    // 早期开发库已按首版 DDL 建过表：补齐后续加列/加宽字段。
    await queryRunner.query(
      `ALTER TABLE public.import_runs ALTER COLUMN "resourceKey" TYPE character varying(128)`,
    )
    await queryRunner.query(
      `ALTER TABLE public.import_runs ADD COLUMN IF NOT EXISTS "objectKey" character varying(512)`,
    )
    await queryRunner.query(
      `ALTER TABLE public.export_runs ALTER COLUMN "resourceKey" TYPE character varying(128)`,
    )
    await queryRunner.query(
      `ALTER TABLE public.export_runs ADD COLUMN IF NOT EXISTS "assetId" uuid`,
    )
    await queryRunner.query(
      `ALTER TABLE public.export_runs ADD COLUMN IF NOT EXISTS "mimeType" character varying(128)`,
    )
    await queryRunner.query(
      `ALTER TABLE public.import_mappings ALTER COLUMN "resourceKey" TYPE character varying(128)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.import_mappings CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.export_runs CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.import_runs CASCADE')
  }
}
