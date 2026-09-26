/**
 * 定向迁移运行器：只跑**指定这一组**迁移，而不是 `data-source.ts` 里注册的全部迁移。
 *
 * 为什么需要定向：`npm run migration:run` 会连带 SaaS / 插件等迁移，对开发库改动面太大。
 * 这里把"本次工作真正需要的那几张表/列"列出来，便于在本地库做 e2e 验证时把影响压到最小。
 *
 * 组的划分不是按时间，而是按**谁在用**：
 *   atomic   —— 原子注册表与模块的原子依赖（原子运行时与蓝图链的 e2e 前置）
 *   baseline —— 实体表基线（`users` 等本仓库迁移集原本没有创建的表）
 *
 * 用法：
 *   npx ts-node --transpile-only scripts/run-targeted-migration.ts              # 全部组
 *   npx ts-node --transpile-only scripts/run-targeted-migration.ts --group=atomic
 *   npx ts-node --transpile-only scripts/run-targeted-migration.ts --revert --group=baseline
 */
import { DataSource } from 'typeorm'
import { CreateAtomicRegistry1790300000000 } from '../src/migrations/1790300000000-CreateAtomicRegistry'
import { AddModuleAtomicDependencies1790400000000 } from '../src/migrations/1790400000000-AddModuleAtomicDependencies'
import { AddAtomicCpuBudget1790500000000 } from '../src/migrations/1790500000000-AddAtomicCpuBudget'
import { AddAtomicOutputAudit1790700000000 } from '../src/migrations/1790700000000-AddAtomicOutputAudit'
import { AddReleaseEvidence1790800000000 } from '../src/migrations/1790800000000-AddReleaseEvidence'
import { AddUsersBaseline1790600000000 } from '../src/migrations/1790600000000-AddUsersBaseline'

type MigrationClass = new () => { up: (q: never) => Promise<void>; down: (q: never) => Promise<void> }

const GROUPS: Record<string, MigrationClass[]> = {
  atomic: [
    CreateAtomicRegistry1790300000000,
    AddModuleAtomicDependencies1790400000000,
    AddAtomicCpuBudget1790500000000,
    AddAtomicOutputAudit1790700000000,
    AddReleaseEvidence1790800000000,
  ],
  baseline: [AddUsersBaseline1790600000000],
}

function selectedGroups(): string[] {
  const arg = process.argv.find((value) => value.startsWith('--group='))
  if (!arg) return Object.keys(GROUPS)
  const name = arg.slice('--group='.length)
  if (!GROUPS[name]) {
    throw new Error(`未知的分组 ${name}（可选：${Object.keys(GROUPS).join(' / ')}）`)
  }
  return [name]
}

const revert = process.argv.includes('--revert')
const groups = selectedGroups()
const migrations = groups.flatMap((group) => GROUPS[group])

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'mac',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sapbasic',
  entities: [],
  migrations: [],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: ['error', 'schema'],
})

async function main(): Promise<void> {
  await dataSource.initialize()
  const runner = dataSource.createQueryRunner()
  // 迁移类是直接实例化调用的（不走 TypeORM 的调度），因此它们对"是否已应用"是无记忆的：
  // 每一个都必须自己写成幂等（如 users 基线的"存在即跳过"）。
  if (revert) {
    for (const Migration of [...migrations].reverse()) {
      await new Migration().down(runner as never)
    }
    console.log(`已回滚 ${groups.join(' / ')} 分组（${migrations.length} 个迁移）`)
  } else {
    for (const Migration of migrations) {
      await new Migration().up(runner as never)
    }
    console.log(`已应用 ${groups.join(' / ')} 分组（${migrations.length} 个迁移）`)
  }
  await dataSource.destroy()
}

main().catch((error) => {
  console.error('定向迁移失败：', error)
  process.exit(1)
})
