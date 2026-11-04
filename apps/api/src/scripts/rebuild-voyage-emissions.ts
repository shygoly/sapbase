// 兼容壳：实现已迁到 libs/domain-shipping（openspec change refactor-app-workspace-split-and-platform-base）
export * from '@sap/domain-shipping/scripts/rebuild-voyage-emissions'
import { main } from '@sap/domain-shipping/scripts/rebuild-voyage-emissions'

if (require.main === module) {
  main().catch((error) => { console.error('Rebuild voyage emissions error:', error); process.exit(1) })
}
