import { MigrationInterface, QueryRunner } from 'typeorm'
import { RELEASE_LIFECYCLE_DDL } from '../releases/release-lifecycle.ddl'

export class CreateReleaseLifecycle1792000000000 implements MigrationInterface {
  name = 'CreateReleaseLifecycle1792000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of RELEASE_LIFECYCLE_DDL) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_app_release_no_delete ON public.app_releases`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_app_release_guard ON public.app_releases`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS app_release_no_delete()`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS app_release_guard()`)
    for (const table of [
      'app_user_release_views',
      'app_release_events',
      'app_release_approvals',
      'app_release_activations',
      'app_release_items',
      'app_releases',
      'app_change_proposals',
      'app_drafts',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS public.${table}`)
    }
  }
}
