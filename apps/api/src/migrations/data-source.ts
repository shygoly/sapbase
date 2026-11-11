import { DataSource } from 'typeorm'
import * as path from 'path'

// dotenv 可能不可用（依赖尚未干净安装的环境，见 docs/PACKAGE_MANAGER.md）：
// 缺失时退回进程环境变量，而不是让整个数据源导入失败。
try {
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
    path.join(__dirname, '1791600000000-CreateBusinessAppInstallations.ts'),
    path.join(__dirname, '1791700000000-AddBusinessAppInstallationRevisions.ts'),
    path.join(__dirname, '1791800000000-BindConfirmationTokensToApps.ts'),
    path.join(__dirname, '1791900000000-EnableTenantRls.ts'),
    path.join(__dirname, '1792000000000-PreserveLegacyUserRole.ts'),
    path.join(__dirname, '1793100000000-CreateDataScope.ts'),
    path.join(__dirname, '1793200000000-CreateAsyncJobs.ts'),
    path.join(__dirname, '1793300000000-CreateIdentity.ts'),
    path.join(__dirname, '1793400000000-CreateAuthSessions.ts'),
    path.join(__dirname, '1793500000000-CreateIdentityFederation.ts'),
    path.join(__dirname, '1793600000000-AddServiceClientAppBinding.ts'),
    path.join(__dirname, '1793700000000-CreateAssets.ts'),
    path.join(__dirname, '1793800000000-ExtendNotificationCenter.ts'),
    path.join(__dirname, '1793900000000-AddAuditHashChain.ts'),
    path.join(__dirname, '1794000000000-AddReviewApprovalPlatform.ts'),
    path.join(__dirname, '1794100000000-AddNotificationRetention.ts'),
    path.join(__dirname, '1794200000000-AddAIModuleVersions.ts'),
    path.join(__dirname, '1794300000000-CreateSearchDocuments.ts'),
    path.join(__dirname, '1794400000000-AddEvolutionBindingToProposals.ts'),
  ],
  synchronize: false,
  logging: true,
  migrationsTableName: 'migrations',
})
