import { MigrationInterface, QueryRunner } from 'typeorm'
import { REVIEW_APPROVAL_DDL } from '../review/review.ddl'

export class AddReviewApprovalPlatform1794000000000 implements MigrationInterface {
  name = 'AddReviewApprovalPlatform1794000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of REVIEW_APPROVAL_DDL) await queryRunner.query(statement)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'work_items',
      'review_delegations',
      'review_events',
      'review_comments',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS public.${table} CASCADE`)
    }
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_blueprint_approval_record_rule_round_step"')
    for (const column of [
      'round',
      'kind',
      'selector',
      'assignee',
      'checkProvider',
      'checkResult',
      'comment',
      'decidedBy',
      'dueAt',
    ]) {
      await queryRunner.query(`ALTER TABLE public.blueprint_approvals DROP COLUMN IF EXISTS "${column}"`)
    }
  }
}
