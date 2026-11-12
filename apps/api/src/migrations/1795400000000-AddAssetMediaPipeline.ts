import { MigrationInterface, QueryRunner } from 'typeorm'

/** 资产管道补齐：扫描状态、存储 provider、标签、变体状态/码率、上传元数据。 */
export class AddAssetMediaPipeline1795400000000 implements MigrationInterface {
  name = 'AddAssetMediaPipeline1795400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS provider character varying(32) DEFAULT 'local' NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS "scanStatus" character varying(32) DEFAULT 'pending' NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE public.asset_variants ADD COLUMN IF NOT EXISTS provider character varying(32) DEFAULT 'local' NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE public.asset_variants ADD COLUMN IF NOT EXISTS status character varying(16) DEFAULT 'ready' NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE public.asset_variants ADD COLUMN IF NOT EXISTS bitrate integer`,
    )
    await queryRunner.query(
      `ALTER TABLE public.asset_upload_sessions ADD COLUMN IF NOT EXISTS metadata jsonb`,
    )
    await queryRunner.query(
      `ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS "assetQuotaBytes" bigint`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_asset_org_scan_status ON public.assets ("organizationId", "scanStatus")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS public.idx_asset_org_scan_status`)
    await queryRunner.query(`ALTER TABLE public.organizations DROP COLUMN IF EXISTS "assetQuotaBytes"`)
    await queryRunner.query(`ALTER TABLE public.asset_upload_sessions DROP COLUMN IF EXISTS metadata`)
    await queryRunner.query(`ALTER TABLE public.asset_variants DROP COLUMN IF EXISTS bitrate`)
    await queryRunner.query(`ALTER TABLE public.asset_variants DROP COLUMN IF EXISTS status`)
    await queryRunner.query(`ALTER TABLE public.asset_variants DROP COLUMN IF EXISTS provider`)
    await queryRunner.query(`ALTER TABLE public.assets DROP COLUMN IF EXISTS tags`)
    await queryRunner.query(`ALTER TABLE public.assets DROP COLUMN IF EXISTS "scanStatus"`)
    await queryRunner.query(`ALTER TABLE public.assets DROP COLUMN IF EXISTS provider`)
  }
}
