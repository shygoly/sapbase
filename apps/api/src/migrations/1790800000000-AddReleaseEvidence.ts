import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

/**
 * 闸 4（影子发布）的证据列 —— change: add-output-gate-and-shadow-release / P4。
 *
 * 两件事：
 *   1. 加 `releaseEvidence`（jsonb，可空）—— 影子/灰度记录与一次性补录都存这里。
 *      它必须是**列**而不是请求体字段：闸 4 的意义就是"这条实现真的走过影子期"，
 *      而调用方能随手填的东西证明不了这件事。
 *   2. **存量补录**：闸 4 上线前已经是 `shadow` / `canary` / `active` 的实现，
 *      它们没有、也不可能有影子记录。两条路里选一条：静默放行（等于闸 4 从第一天就漏）
 *      或显式补录（可查、带理由）。这里选后者：写一条 grandfather 记录，
 *      `decidedBy` 标明是迁移补录，事后能一条 SQL 查出来。
 */
export class AddReleaseEvidence1790800000000 implements MigrationInterface {
  name = 'AddReleaseEvidence1790800000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('atomic_implementations')
    if (!table) {
      console.log('Table atomic_implementations 不存在，跳过')
      return
    }

    if (!table.findColumnByName('releaseEvidence')) {
      await queryRunner.addColumn(
        'atomic_implementations',
        new TableColumn({
          name: 'releaseEvidence',
          type: 'jsonb',
          isNullable: true,
        }),
      )
    }

    // 存量补录：只补"已经在跑"的那三个状态，且不覆盖已有证据
    await queryRunner.query(`
      UPDATE atomic_implementations
         SET "releaseEvidence" = jsonb_build_object(
               'grandfather',
               jsonb_build_object(
                 'reason', '早于闸 4 上线，一次性补录（无影子期记录可查）',
                 'decidedBy', 'migration-1790800000000',
                 'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
               )
             )
       WHERE status IN ('shadow', 'canary', 'active')
         AND "releaseEvidence" IS NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('atomic_implementations')
    if (table?.findColumnByName('releaseEvidence')) {
      await queryRunner.dropColumn('atomic_implementations', 'releaseEvidence')
    }
  }
}
