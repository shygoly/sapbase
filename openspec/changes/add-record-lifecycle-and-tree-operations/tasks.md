## 1. 契约与元语

- [ ] 1.1 定义 tree 元数据、clone/move/archive/snapshot 的 Schema
- [ ] 1.2 在 `docs/META_LANGUAGE.md` 登记记录生命周期术语与不变量（INV-RL-01..05）
- [ ] 1.3 在 `DOMAIN.md` 新增快照/树操作小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [ ] 1.4 在 `DECISIONS.md` 登记唯一字段策略、归档不是状态迁移、快照不覆盖历史

## 2. 存储与 RLS

- [ ] 2.1 迁移：`record_snapshots` / `record_operations`
- [ ] 2.2 索引/唯一约束：record+version、operation idempotency
- [ ] 2.3 新表加入 `TENANT_RLS_DDL`；跨租户负例
- [ ] 2.4 TypeORM 实体与模块注册

## 3. 树元数据

- [ ] 3.1 `blueprint-semantic` 增加 `tree: { parentField, orderField }`
- [ ] 3.2 编译期校验字段存在/类型/自引用
- [ ] 3.3 运行时校验同组织/同蓝图/防环/不跨树
- [ ] 3.4 未声明 tree 的实体不受影响
- [ ] 3.5 单测：合法树、非法字段、环、跨树

## 4. 克隆

- [ ] 4.1 `clone`：深拷贝子树 + ID 映射
- [ ] 4.2 内部引用重映射；外部引用策略
- [ ] 4.3 唯一字段策略：fail/suffix/placeholder
- [ ] 4.4 事务/回滚/幂等键/结果映射
- [ ] 4.5 深度/数量限制/配额
- [ ] 4.6 单测：子树、引用、唯一冲突、重复请求

## 5. 移动/排序

- [ ] 5.1 `move`：跨父节点/防环/同组织
- [ ] 5.2 `reorder`：同级排序
- [ ] 5.3 并发乐观锁/重试
- [ ] 5.4 审计前后父/序号
- [ ] 5.5 单测：环、跨树、并发、序号

## 6. 归档/恢复

- [ ] 6.1 `archive`：软归档/原因/操作者
- [ ] 6.2 级联归档子节点（可选）
- [ ] 6.3 唯一键处理/`uniqueScope`
- [ ] 6.4 `restore`：父节点/唯一冲突校验
- [ ] 6.5 活跃列表隐藏/历史保留
- [ ] 6.6 单测：归档/恢复、冲突、子节点

## 7. 版本快照

- [ ] 7.1 `snapshot`：保存 data/state/version
- [ ] 7.2 `publish`：发布快照/label
- [ ] 7.3 `diff`：字段级差异
- [ ] 7.4 `restore`：旧版本为新版本，不覆盖历史
- [ ] 7.5 保留策略/上限
- [ ] 7.6 单测：快照/发布/diff/恢复

## 8. 权限/数据范围/异步

- [ ] 8.1 源读/目标写/范围校验
- [ ] 8.2 权限点：clone/move/archive/snapshot
- [ ] 8.3 大克隆/批量异步：进度/取消/重试
- [ ] 8.4 审计：源/目标/策略/操作者
- [ ] 8.5 负例：跨范围克隆/移动、越权归档

## 9. 兼容与验收

- [ ] 9.1 旧头行结构/CRUD/状态迁移不变
- [ ] 9.2 旧记录不迁移；快照表新增
- [ ] 9.3 e2e：课程树克隆/移动/归档/版本恢复
- [ ] 9.4 `openspec validate add-record-lifecycle-and-tree-operations --strict`
- [ ] 9.5 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
