import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

/**
 * 原子契约的可选执行预算（fuel 指令单位）—— change: add-wasmtime-host / S4。
 *
 * 迁移不改写旧文件（backend/AGENTS.md 第 3 条）：只加一列，可空。
 */
export class AddAtomicCpuBudget1790500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('atomic_contracts')
    if (!table) {
      console.log('Table atomic_contracts 不存在，跳过')
      return
    }
    if (table.findColumnByName('cpuBudget')) {
      console.log('atomic_contracts.cpuBudget 已存在，跳过')
      return
    }
    await queryRunner.addColumn(
      'atomic_contracts',
      new TableColumn({
        name: 'cpuBudget',
        type: 'bigint',
        isNullable: true,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('atomic_contracts')
    if (table?.findColumnByName('cpuBudget')) {
      await queryRunner.dropColumn('atomic_contracts', 'cpuBudget')
    }
  }
}
