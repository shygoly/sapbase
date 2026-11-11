## 1. 契约与元语

- [x] 1.1 `schemas/record-lifecycle.schema.json`
- [x] 1.2 META §3.18 + 不变量 50–54
- [x] 1.3 DOMAIN「记录生命周期」+ check-domain-doc 0 error
- [x] 1.4 DECISIONS D-17

## 2. 存储与 RLS

- [x] 2.1 迁移 179460 + DDL
- [x] 2.2 唯一 (recordId,version) + (org,idempotencyKey)
- [x] 2.3 TENANT_RLS_DDL + 控制器 organizationId 强制
- [x] 2.4 entities + app.entities + RecordLifecycleModule

## 3. 树元数据

- [x] 3.1 SemanticEntity.tree + lifecycleSchema 投影
- [x] 3.2 compiler tree 校验（parent/order/数值/自引用）
- [x] 3.3 loadRecord/loadSubtree/descendantIds 同组织同蓝图 + 防环
- [x] 3.4 tree=null 只支持单条 clone/snapshot
- [x] 3.5 `blueprint/tree.spec.ts` 4 tests + lifecycle move 防环

## 4. 克隆

- [x] 4.1 clone 递归子树 + idMap
- [x] 4.2 parent/self-reference 重映射；外部引用原样
- [x] 4.3 uniqueStrategy 三策略
- [x] 4.4 dataSource.transaction + record_operations 幂等
- [x] 4.5 RECORD_CLONE_MAX_NODES（默认 5000）
- [x] 4.6 lifecycle service 单测 clone 子树/引用

## 5. 移动/排序

- [x] 5.1 move 防环 + 父节点同组织
- [x] 5.2 reorder orderField
- [x] 5.3 UPDATE ... WHERE version=old，冲突 409
- [x] 5.4 record_operations before/after + audit record.move
- [x] 5.5 单测环；reorder/move 逻辑

## 6. 归档/恢复

- [x] 6.1 archivedAt/archivedBy/archiveReason
- [x] 6.2 cascade 递归后代
- [x] 6.3 归档保留唯一键；恢复检查冲突
- [x] 6.4 restore 父节点归档/唯一键检查
- [x] 6.5 list/listEnvelope 过滤 archivedAt
- [x] 6.6 单测 archive + e2e cascade/restore

## 7. 版本快照

- [x] 7.1 record_snapshots data/state/version
- [x] 7.2 publishSnapshot label/published
- [x] 7.3 diff 字段级
- [x] 7.4 restoreSnapshot 新版本
- [x] 7.5 RECORD_SNAPSHOT_MAX（默认 100）
- [x] 7.6 单测 snapshot/diff；e2e restore

## 8. 权限/数据范围/异步

- [x] 8.1 `assertWritable` 源/目标 dataScope 写校验
- [x] 8.2 seed/catalog + @Auth record:*
- [x] 8.3 `record.clone` job + clone-async（jobs 通用取消/重试）
- [x] 8.4 record_operations + audit record.*
- [x] 8.5 权限 @Auth + 防环/父归档负例

## 9. 兼容与验收

- [x] 9.1 未改 write/transition；仅 list 过滤 archivedAt
- [x] 9.2 新表；旧行 archivedAt 为空
- [x] 9.3 `apps/api/test/record-lifecycle.e2e-spec.ts` 通过
- [x] 9.4 validate 通过
- [x] 9.5 check-domain 0 error / check-meta 0 error
