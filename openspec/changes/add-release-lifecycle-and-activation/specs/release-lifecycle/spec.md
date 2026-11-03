# 业务系统 Release 生命周期

## ADDED Requirements

### Requirement: Draft and Change Proposal Lifecycle

系统 SHALL 用 `AppDraft` 与 `ChangeProposal` 管理一次发布周期中的可编辑工作副本与变更提议。

#### Scenario: Draft is the single working copy
- **WHEN** 管理员或 Builder Agent 要修改某个 `appKey` 的定义
- **THEN** 修改 MUST 落在该 app 的 `AppDraft` 上
- **AND** 已发布的 `Release` MUST NOT 被直接编辑

#### Scenario: Proposal validation failure returns to draft
- **WHEN** `ChangeProposal` 在 `validating` 状态未通过任一闸门
- **THEN** 状态 MUST 回到 `draft`
- **AND** 系统 MUST NOT 允许“带警告发布”

### Requirement: Immutable Release

系统 SHALL 把发布物冻结为不可变 `Release`，内容包括 manifest、digest、signature、changelog、迁移与回退计划。

#### Scenario: Published content cannot be updated
- **WHEN** 任意代码或 SQL 尝试更新 `app_releases` 中 `status='published'` 行的 `manifest`、`changelog`、`digest`、`version` 或 `appKey`
- **THEN** 数据库 MUST 拒绝该更新
- **AND** 服务层 MUST 在写入前自行拒绝

#### Scenario: Release rows are append-only
- **WHEN** 任意代码尝试 `DELETE` `app_releases` 行
- **THEN** 数据库 MUST 拒绝删除
- **AND** 历史 Release MUST 仍可查询

#### Scenario: Digest is recomputed by platform
- **WHEN** 客户端提交一个 `releaseDigest`
- **THEN** 平台 MUST 重新计算内容摘要
- **AND** 若与客户端值不一致 MUST 拒绝发布

### Requirement: Activation Is Append-Only

系统 SHALL 用追加记录表达激活与回退，同一安装同一时刻只允许一个非 cohort 的 `active` 记录。

#### Scenario: Activate a release
- **WHEN** 管理员对某个安装激活一个 Release
- **THEN** 系统 MUST 追加一条 `app_release_activations`
- **AND** 该记录 MUST 包含 `action`、`status`、`effectiveAt`、`activatedBy` 与目标 Release

#### Scenario: Only one active release per installation
- **WHEN** 同一 `appInstallationId` 已存在一条 `status='active' AND cohort IS NULL` 的记录
- **THEN** 再次激活非 cohort Release MUST 被拒绝
- **AND** 灰度 cohort 记录 MAY 并存，但 cohort MUST 唯一且显式

#### Scenario: Rollback is a new activation
- **WHEN** 管理员回退到旧 Release
- **THEN** 系统 MUST 追加一条 `action='rollback'` 的新记录
- **AND** 系统 MUST NOT 修改旧 Release 或被回退的 activation 行

### Requirement: Release Pipeline Gates

系统 SHALL 在发布前执行 G0–G8 闸门，并为每个闸门记录证据或显式的“不适用原因”。

#### Scenario: Gate failure blocks publication
- **WHEN** 任一闸门失败
- **THEN** Release MUST 保持 `building` 或 `failed`
- **AND** 系统 MUST NOT 写入 `published` 状态

#### Scenario: Missing rollback plan is rejected
- **WHEN** Release 含迁移但没有回退计划或 `rollbackSafe=false` 且无补偿迁移
- **THEN** G3 MUST 拒绝发布
- **AND** 错误 MUST 指明缺失字段

#### Scenario: Non-applicable gate is explicit
- **WHEN** 某 Release 不涉及 Agent 变更
- **THEN** G5 MAY 标记为不适用
- **AND** 系统 MUST 记录 `notApplicableReason`

### Requirement: Preview Release Isolation

系统 SHALL 让预览 Release 对业务用户不可见，并只允许持有效签名 token 的审批人访问。

#### Scenario: Invalid preview token is rejected
- **WHEN** 访问 `GET /api/apps/:appKey/preview/:token` 且 token 无效或过期
- **THEN** 系统 MUST 返回 403
- **AND** 访问 MUST 被审计

#### Scenario: Business user cannot see preview
- **WHEN** 业务用户读取当前 Release 或 whats-new
- **THEN** 系统 MUST 只返回其 organization 当前 `active` 的 Release
- **AND** MUST NOT 返回 `channel='preview'` 的未激活 Release

### Requirement: Business-Facing Changelog

每个 Release SHALL 带面向业务人员的 changelog，并提供 whats-new 与未读游标。

#### Scenario: Release requires changelog
- **WHEN** 发布一个 Release
- **THEN** 该 Release MUST 包含至少一条 zh-CN changelog
- **AND** changelog MUST 用业务语言描述“新增/变化/修复”，不得只贴 schema diff

#### Scenario: User sees only own active release changelog
- **WHEN** 业务用户打开 whats-new
- **THEN** 系统 MUST 展示其 organization 当前 active Release 的 changelog
- **AND** 用户标记已读后 MUST 更新 `app_user_release_views`

#### Scenario: Canary user is marked
- **WHEN** 用户处于灰度 cohort
- **THEN** 界面 MUST 显示“体验版”标识
- **AND** 该用户提交的反馈 MUST 带 `releaseId` 与 `cohort`

### Requirement: Release Traceability

系统 SHALL 在每个业务请求、审计记录与 Agent turn 中记录当前 `releaseId`。

#### Scenario: Request carries release id
- **WHEN** 业务请求在某个已激活 Release 下执行
- **THEN** 应用上下文 MUST 包含 `releaseId`
- **AND** 审计记录 MUST 能追溯到该 Release

#### Scenario: Legacy mode still works
- **WHEN** `release.enabled=false`
- **THEN** 现有 install/upgrade/rollback 路径 MUST 继续可用
- **AND** 新发布 API MUST 返回 `UNAVAILABLE`，不得静默降级为旧发布语义
