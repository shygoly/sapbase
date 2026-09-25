import { DataSource } from 'typeorm'
import * as path from 'path'

// dotenv 可能不可用（依赖尚未干净安装的环境，见 docs/PACKAGE_MANAGER.md）：
// 缺失时退回进程环境变量，而不是让整个数据源导入失败。
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ;(require('dotenv') as { config: () => void }).config()
} catch {
  // 由 shell 提供 DB_* 环境变量
}

export const MigrationDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'mac',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sapbasic',
  entities: [],
  migrations: [
    path.join(__dirname, '1737000000000-MigrateToSaaS.ts'),
    path.join(__dirname, '1737500000000-CreateWorkflowTables.ts'),
    path.join(__dirname, '1738000000000-CreateBrandConfigsTable.ts'),
    path.join(__dirname, '1739000000000-CreatePluginsTable.ts'),
    path.join(__dirname, '1790300000000-CreateAtomicRegistry.ts'),
  ],
  synchronize: false,
  logging: true,
  migrationsTableName: 'migrations',
})
