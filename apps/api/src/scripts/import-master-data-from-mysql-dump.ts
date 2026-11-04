// 兼容壳：实现已迁到 libs/domain-shipping（openspec change refactor-app-workspace-split-and-platform-base）
export * from '@sap/domain-shipping/scripts/import-master-data-from-mysql-dump'
import { main } from '@sap/domain-shipping/scripts/import-master-data-from-mysql-dump'

if (require.main === module) {
  main().catch((error) => { console.error('Master import error:', error); process.exit(1) })
}
