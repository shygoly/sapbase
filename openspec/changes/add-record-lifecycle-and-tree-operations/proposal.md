# Change: 记录生命周期与树操作

## Why

Blueprint 记录已有 `version`、迁移历史和 `children/parent`（头行结构），但缺少通用：

- 深层克隆/复制（含子树、引用重映射、唯一字段处理）；
- 同级移动/排序/跨父节点移动（防环）；
- 归档/恢复（不物理删除、保留历史）；
- 版本快照/发布/对比/从旧版本恢复（内容型实体需要）。

教育项目的课程章节/知识点树、课程克隆、归档、版本记录（A-003/A-004/A-006/A-007/A-022）
都需要这些；其他垂直行业同样需要。现在只能为每个业务写重复逻辑。

## What Changes

- **ADDED** `record-lifecycle`：
  - 树元数据：实体可声明 `tree: { parentField, orderField }`，编译期校验自引用/环。
  - 克隆：深层复制（子树/引用/唯一字段策略）、事务、幂等、异步大克隆。
  - 移动/排序：跨父节点/同级排序，防环，保留历史。
  - 归档/恢复：软归档、从活跃列表隐藏、历史保留、恢复。
  - 版本快照：显式快照/发布版本、diff、从旧版本恢复为新版本（不覆盖历史）。
- **ADDED** 操作审计与数据范围：源读、目标写、克隆目标节点必须在可写范围。
- **MODIFIED** 语义运行时/管理 API：暴露通用操作；不改变既有 CRUD/状态迁移。
- **NOT CHANGED** 现有 `children/parent` 头行结构、`version` 字段、迁移历史。
- **NON-GOALS** 任意图克隆、跨租户克隆、闭包表/图数据库、文件系统级复制。
- **BREAKING** 无。未声明 `tree` 的实体行为不变。

## Impact

- 受影响规格：`record-lifecycle`（新增）、`blueprint-semantic`（tree 元数据）、
  `semantic-runtime`（操作实现）
- 受影响代码：
  - `apps/api/src/semantic-runtime/**`
  - `schemas/blueprint-semantic.schema.json`
  - `libs/platform-release/src/blueprint/compiler.ts`
  - `apps/api/src/migrations/**`（快照表）
  - `DOMAIN.md`、`DECISIONS.md`
- 依赖：`add-async-job-and-callback-facade`（大克隆）、
  `add-generic-data-scope-authorization`（目标范围）、`add-audit-compliance...`（审计）。
- 迁移：新增 `record_snapshots` 表/可选列；旧记录不迁移。
- 风险：深拷贝引用/唯一键冲突、树环、克隆爆炸、版本存储增长、并发移动。
