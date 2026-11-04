import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

/**
 * 模块声明原子依赖（change: add-wasm-atomic-runtime / M4）。
 *
 * 迁移不改写旧文件（backend/AGENTS.md 第 3 条）：只是在 module_registry 上加一列。
 */
export class AddModuleAtomicDependencies1790400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('module_registry')
    if (!table) {
      console.log('Table module_registry 不存在，跳过')
      return
    }
    if (table.findColumnByName('dependsOnAtomics')) {
      console.log('module_registry.dependsOnAtomics 已存在，跳过')
      return
    }
    await queryRunner.addColumn(
      'module_registry',
      new TableColumn({
        name: 'dependsOnAtomics',
        type: 'jsonb',
        isNullable: false,
        default: "'[]'::jsonb",
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('module_registry')
    if (table?.findColumnByName('dependsOnAtomics')) {
      await queryRunner.dropColumn('module_registry', 'dependsOnAtomics')
    }
  }
}
