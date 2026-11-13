import { MigrationInterface, QueryRunner } from 'typeorm'

/** 6.7：blueprint_records 租户/应用查询与归档保留索引。 */
export class AddBlueprintRecordRetentionIndexes1796200000000 implements MigrationInterface {
  name = 'AddBlueprintRecordRetentionIndexes1796200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_blueprint_records_org_created
         ON public.blueprint_records USING btree ("organizationId", "createdAt" DESC)`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_blueprint_records_org_blueprint_entity
         ON public.blueprint_records USING btree ("organizationId", "blueprintId", entity)`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_blueprint_records_org_archived
         ON public.blueprint_records USING btree ("organizationId", "archivedAt")
         WHERE "archivedAt" IS NOT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS public.idx_blueprint_records_org_archived')
    await queryRunner.query('DROP INDEX IF EXISTS public.idx_blueprint_records_org_blueprint_entity')
    await queryRunner.query('DROP INDEX IF EXISTS public.idx_blueprint_records_org_created')
  }
}
