# openspec-governance Specification

## Purpose
TBD - created by archiving change reconcile-pending-openspec-changes. Update Purpose after archive.
## Requirements
### Requirement: Cross-Change Conflict Register

所有跨 change 的重叠 MUST 登记到冲突表，至少包含 ID、涉及 change、证据、裁决与后续动作。裁决 MUST 取以下之一：`dependency`、`duplicate`、`conflict`、`superseded`、`stale`。未登记的跨 change 重叠 MUST NOT 进入 apply。

#### Scenario: 两个 change 定义同一 capability

- **WHEN** 两个 in-progress change 的 spec delta 指向同一 capability
- **THEN** 冲突表 SHALL 登记该 capability 与两个 change
- **AND** MUST 给出唯一 owner 与 apply 顺序

#### Scenario: 裁决为 superseded

- **WHEN** 一个 change 的目标能力已被当前代码取代
- **THEN** 裁决 SHALL 为 `superseded`
- **AND** MUST 记录取代它的 change 或架构事实

### Requirement: Superseded Change Closure

被裁决为 `superseded` 的 change MUST 在 `proposal.md` 顶部标记 `Status: SUPERSEDED by <change-id> on <date>. Do not apply.`。其 tasks MUST NOT 继续勾选；归档 MUST 使用 `--skip-specs` 或保留为历史，不得向正式 spec 写入 delta。

#### Scenario: 关闭已退场的 workflow change

- **WHEN** `workflow-engine` 已被 Blueprint record transition 取代
- **THEN** 相关 change SHALL 标记 superseded
- **AND** 其未完成 tasks MUST NOT 继续执行
- **AND** 归档 MUST NOT 写入 `workflow-engine` spec

#### Scenario: 已完成的旧任务仍可追溯

- **WHEN** superseded change 已有多条 `[x]` 任务
- **THEN** 这些任务 SHALL 保留
- **AND** `proposal.md` MUST 说明它们不代表当前架构仍有效

### Requirement: Spec Delta Operation Correctness

`ADDED` Requirement 的名称 MUST NOT 已存在于 `openspec/specs/<capability>/spec.md`。已存在的 Requirement MUST 使用 `MODIFIED`；只新增真正的新 Requirement。同一 change MUST NOT 对同一 capability 同时 `ADDED` 与 `REMOVED` 同名 Requirement。

#### Scenario: 给已有 capability 增强

- **WHEN** 目标 Requirement 已存在于正式 spec
- **THEN** delta MUST 使用 `MODIFIED`
- **AND** MUST NOT 重复 `ADDED`

#### Scenario: 真正新增能力

- **WHEN** Requirement 名称在正式 spec 中不存在
- **THEN** delta MAY 使用 `ADDED`
- **AND** MUST 提供至少一个 `#### Scenario:`

### Requirement: Stale Path Gate

in-progress change 的 `proposal.md` 与 `tasks.md` 中引用的仓库路径 MUST 存在，或显式标记为 `（待新增）` / `TODO`。指向已删除目录的路径 MUST 被修正后才能 apply。

#### Scenario: 引用拆分前路径

- **WHEN** task 引用 `backend/src/**` 或 `speckit/**`
- **THEN** 检查 MUST 报告 stale path
- **AND** 该 change MUST NOT 被标记为可 apply

#### Scenario: 待新增文件

- **WHEN** task 明确写有 `（待新增）`
- **THEN** 检查 SHALL 跳过存在性失败
- **AND** MUST 保留该标记供实现时核对

### Requirement: Single Ownership and Apply Order

同一 capability 的多个 delta MUST 指定唯一 owner change 与 contributor changes。owner MUST 先归档；contributor MUST 只提交 `MODIFIED` 增量。apply 顺序 MUST 记录在冲突表或 design 中。

#### Scenario: release capability 多 change

- **WHEN** `release-lifecycle` 同时被 release/harden/unify 修改
- **THEN** MUST 指定一个 owner
- **AND** 其余 change MUST 只提交增量
- **AND** 顺序 MUST 可查询

#### Scenario: 共享组件

- **WHEN** 多个 change 修改同一前端组件
- **THEN** MUST 指定单一 owner
- **AND** 其他 change MUST 限定为样式或只读消费

### Requirement: Traceability Changes Do Not Duplicate Implementation

追踪类 change MUST 以矩阵引用目标 change 的任务编号，MUST NOT 复制目标 change 的实现 checkbox。阶段 gate 与需求状态可以保留为任务。

#### Scenario: 教育 traceability

- **WHEN** 需求项 A-001 已由 `add-education-reference-blueprint` 任务 2.1 实现
- **THEN** traceability SHALL 记录目标 change 与任务号
- **AND** MUST NOT 再建一条同义实现任务

