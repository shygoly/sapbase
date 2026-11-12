import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 身份治理补齐：权限版本、会话/登录事件索引、同步差异与高风险确认。
 * 只加列/索引，不改既有数据语义。
 */
export class AddIdentityGovernance1795600000000 implements MigrationInterface {
  name = 'AddIdentityGovernance1795600000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "permissionVersion" integer DEFAULT 1 NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE public.identity_sync_runs ADD COLUMN IF NOT EXISTS diff jsonb`,
    )
    await queryRunner.query(
      `ALTER TABLE public.identity_sync_runs ADD COLUMN IF NOT EXISTS "confirmationStatus" character varying(16) DEFAULT 'none' NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE public.identity_sync_runs ADD COLUMN IF NOT EXISTS "confirmedBy" uuid`,
    )
    await queryRunner.query(
      `ALTER TABLE public.identity_sync_runs ADD COLUMN IF NOT EXISTS "confirmedAt" timestamp with time zone`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_auth_login_event_org_email_created
       ON public.auth_login_events ("organizationId", email, "createdAt")`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_auth_login_event_org_status_created
       ON public.auth_login_events ("organizationId", status, "createdAt")`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_auth_sessions_org_user_sid
       ON public.auth_sessions ("organizationId", "userId", sid)`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_identity_provider_org_status
       ON public.identity_providers ("organizationId", status)`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_identity_link_org_user
       ON public.identity_links ("organizationId", "userId")`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_service_client_org_status
       ON public.service_clients ("organizationId", status)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS public.idx_service_client_org_status`)
    await queryRunner.query(`DROP INDEX IF EXISTS public.idx_identity_link_org_user`)
    await queryRunner.query(`DROP INDEX IF EXISTS public.idx_identity_provider_org_status`)
    await queryRunner.query(`DROP INDEX IF EXISTS public.idx_auth_sessions_org_user_sid`)
    await queryRunner.query(`DROP INDEX IF EXISTS public.idx_auth_login_event_org_status_created`)
    await queryRunner.query(`DROP INDEX IF EXISTS public.idx_auth_login_event_org_email_created`)
    await queryRunner.query(
      `ALTER TABLE public.identity_sync_runs DROP COLUMN IF EXISTS "confirmedAt"`,
    )
    await queryRunner.query(
      `ALTER TABLE public.identity_sync_runs DROP COLUMN IF EXISTS "confirmedBy"`,
    )
    await queryRunner.query(
      `ALTER TABLE public.identity_sync_runs DROP COLUMN IF EXISTS "confirmationStatus"`,
    )
    await queryRunner.query(`ALTER TABLE public.identity_sync_runs DROP COLUMN IF EXISTS diff`)
    await queryRunner.query(`ALTER TABLE public.users DROP COLUMN IF EXISTS "permissionVersion"`)
  }
}
