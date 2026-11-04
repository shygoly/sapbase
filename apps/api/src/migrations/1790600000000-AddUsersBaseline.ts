import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm'

/**
 * `users` 基线。
 *
 * 为什么需要它：本仓库的迁移集里**没有任何迁移创建 `users` 表**
 * （`rg "name: 'users'" src/migrations/` 无结果）—— 迁移是按增量叠在早期库上的。
 * 后果有两层：
 *
 *   1. **无法从零重建**：空库跑完迁移，`users` 依然不存在。
 *   2. **实体与库漂移**：早期库的 `users` 是 `roleId` / `departmentId` 形态，而 `User`
 *      实体声明的是 `role` / `department` / `permissions`。任何 JOIN 到 `users` 的查询
 *      （如 `module-registry` 加载 `createdBy`）都会直接报
 *      `column ... role does not exist` —— 不是权限问题，是列不存在。
 *
 * 本迁移**只做加法**：表不存在就建，列缺失就补。已存在但形态不同的列（`roleId` /
 * `departmentId`）一律保留 —— 删列是不可逆的，而"两种形态并存"比"删掉别人的数据"安全。
 * 把 `User` 实体收敛到哪一套形态（`role` 字符串 vs `roleId` 外键）是另一个决定，
 * 见本变更 `tasks.md` 的 P0 说明。
 */
export class AddUsersBaseline1790600000000 implements MigrationInterface {
  name = 'AddUsersBaseline1790600000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasUsers = await queryRunner.hasTable('users')

    if (!hasUsers) {
      // 空库上没有 uuid_generate_v4()（其余迁移都假设扩展已装）。基线要能自己站起来，
      // 所以在这里把扩展补上 —— 否则"从零重建"第一步就报 function does not exist。
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
      await queryRunner.createTable(
        new Table({
          name: 'users',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'name', type: 'varchar', length: '255' },
            { name: 'email', type: 'varchar', length: '255', isUnique: true },
            { name: 'passwordHash', type: 'varchar', length: '255', isNullable: true },
            { name: 'role', type: 'varchar', length: '255', default: `'user'` },
            { name: 'department', type: 'varchar', length: '255', isNullable: true },
            { name: 'status', type: 'varchar', length: '50', default: `'active'` },
            { name: 'permissions', type: 'text', default: `''` },
            { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true,
      )
      return
    }

    // 表已存在（早期库）：只补 `User` 实体需要但缺失的列
    const required: TableColumn[] = [
      new TableColumn({ name: 'role', type: 'varchar', length: '255', default: `'user'` }),
      new TableColumn({ name: 'department', type: 'varchar', length: '255', isNullable: true }),
      new TableColumn({ name: 'permissions', type: 'text', default: `''` }),
    ]
    const table = await queryRunner.getTable('users')
    for (const column of required) {
      if (!table?.findColumnByName(column.name)) {
        await queryRunner.addColumn('users', column)
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚只撤销本迁移**新增**的东西：表由本迁移创建则整表删除，否则只删这三列
    const table = await queryRunner.getTable('users')
    if (!table) return

    const baseline = new Set([
      'id',
      'name',
      'email',
      'passwordHash',
      'role',
      'department',
      'status',
      'permissions',
      'createdAt',
      'updatedAt',
    ])
    const isPurelyOurs = table.columns.every((column) => baseline.has(column.name))
    if (isPurelyOurs) {
      await queryRunner.dropTable('users')
      return
    }
    for (const name of ['role', 'department', 'permissions']) {
      if (table.findColumnByName(name)) {
        await queryRunner.dropColumn('users', name)
      }
    }
  }
}
