/**
 * 定向迁移运行器：只跑原子注册表那一个迁移。
 *
 * 为什么不用 `npm run migration:run`：那条命令会跑 `data-source.ts` 里注册的**全部**迁移
 * （含 SaaS / 插件等），对开发库的改动面太大。这里只建/删原子注册表的三张表，
 * 便于在本地库做 e2e 验证时把影响控制在最小范围。
 *
 * 用法：npx ts-node --transpile-only scripts/run-atomic-migration.ts [--revert]
 */
import { DataSource } from 'typeorm'
import { CreateAtomicRegistry1790300000000 } from '../src/migrations/1790300000000-CreateAtomicRegistry'
import { AddModuleAtomicDependencies1790400000000 } from '../src/migrations/1790400000000-AddModuleAtomicDependencies'
import { AddAtomicCpuBudget1790500000000 } from '../src/migrations/1790500000000-AddAtomicCpuBudget'

const revert = process.argv.includes('--revert')

/** 与原子运行时相关、需要定向应用的迁移（不含 SaaS / 插件等无关迁移）。 */
const MIGRATIONS = [
  CreateAtomicRegistry1790300000000,
  AddModuleAtomicDependencies1790400000000,
  AddAtomicCpuBudget1790500000000,
]

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'mac',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sapbasic',
  entities: [],
  migrations: MIGRATIONS,
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: ['error', 'schema'],
})

async function main(): Promise<void> {
  await dataSource.initialize()
  if (revert) {
    for (const Migration of [...MIGRATIONS].reverse()) {
      await new Migration().down(dataSource.createQueryRunner())
    }
    console.log('已回滚原子相关的全部迁移')
  } else {
    for (const Migration of MIGRATIONS) {
      await new Migration().up(dataSource.createQueryRunner())
    }
    console.log(`已应用 ${MIGRATIONS.length} 个原子相关迁移`)
  }
  await dataSource.destroy()
}

void main()
