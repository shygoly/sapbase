import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

/**
 * 原子契约的输出管控档位（`outputAudit`）—— change: add-output-gate-and-shadow-release / P3。
 *
 * 为什么必须是列而不是塞进 `outputSchema`：档位是"这个原子的输出该被查多严"，
 * 与输出布局是两件事；而且要能单独查（"哪些契约还是 off"是上线前的必查项）。
 *
 * 与 `1790500000000-AddAtomicCpuBudget` 同一套路：只加一列、带默认值、可空不动旧数据。
 * 存量契约拿到 `standard`（默认档）——它们此前已经受值域与大小上限检查，
 * 现在多出来的只是"批量-单条一致"这一条重放判据。
 */
export class AddAtomicOutputAudit1790700000000 implements MigrationInterface {
  name = 'AddAtomicOutputAudit1790700000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('atomic_contracts')
    if (!table) {
      console.log('Table atomic_contracts 不存在，跳过')
      return
    }
    if (table.findColumnByName('outputAudit')) {
      console.log('atomic_contracts.outputAudit 已存在，跳过')
      return
    }
    await queryRunner.addColumn(
      'atomic_contracts',
      new TableColumn({
        name: 'outputAudit',
        type: 'varchar',
        length: '16',
        default: `'standard'`,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('atomic_contracts')
    if (table?.findColumnByName('outputAudit')) {
      await queryRunner.dropColumn('atomic_contracts', 'outputAudit')
    }
  }
}
