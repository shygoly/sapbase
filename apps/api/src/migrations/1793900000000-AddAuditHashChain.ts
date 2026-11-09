import { MigrationInterface, QueryRunner } from 'typeorm'
import { AUDIT_CHAIN_DDL } from '@sap/platform-core/audit-logs/audit-chain.ddl'

export class AddAuditHashChain1793900000000 implements MigrationInterface {
  name = 'AddAuditHashChain1793900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of AUDIT_CHAIN_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON public.audit_logs')
    await queryRunner.query('DROP FUNCTION IF EXISTS public.prevent_audit_mutation()')
    await queryRunner.query('DROP TABLE IF EXISTS public.audit_archives CASCADE')
    await queryRunner.query('DROP TABLE IF EXISTS public.audit_checkpoints CASCADE')
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_audit_log_org_seq"')
    for (const column of [
      'seq',
      'prevHash',
      'hash',
      'hashAlgo',
      'payload',
      'actorType',
      'appInstallationId',
      'ip',
      'userAgent',
      'correlationId',
      'source',
      'retentionUntil',
      'legalHold',
      'archivedAt',
    ]) {
      await queryRunner.query(`ALTER TABLE public.audit_logs DROP COLUMN IF EXISTS "${column}"`)
    }
  }
}
