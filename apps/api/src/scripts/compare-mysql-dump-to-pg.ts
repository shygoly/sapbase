// 兼容壳：实现已迁到 libs/domain-shipping（openspec change refactor-app-workspace-split-and-platform-base）
export * from '@sap/domain-shipping/scripts/compare-mysql-dump-to-pg'
import { main } from '@sap/domain-shipping/scripts/compare-mysql-dump-to-pg'

if (require.main === module) {
  main()
}
