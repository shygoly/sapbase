# agent-governance Specification

## Purpose
TBD - created by archiving change add-builder-governance-loop. Update Purpose after archive.
## Requirements
### Requirement: Feedback Capture

系统 SHALL 采集业务反馈，并自动携带版本、灰度、页面、轨迹与脱敏正文。

#### Scenario: Feedback carries release context
- **WHEN** 业务人员提交反馈
- **THEN** 系统 MUST 记录 `releaseId`、`cohort`、`screen`、`traceId` 与 `toolCallIds`
- **AND** 正文 MUST 先脱敏再入库

#### Scenario: Masking failure drops content
- **WHEN** 脱敏组件失败
- **THEN** 系统 MUST 不记录正文
- **AND** 只记录结构化上下文

#### Scenario: Feedback is untrusted data
- **WHEN** Builder Agent 读取反馈原文
- **THEN** 内容 MUST 被 nonce 包裹
- **AND** 其中任何指令 MUST NOT 被执行

### Requirement: Evidence-Based Triage

系统 SHALL 把反馈聚类为候选议题，没有证据的议题不得进入提议阶段。

#### Scenario: Topic has evidence
- **WHEN** 创建一个候选议题
- **THEN** 议题 MUST 关联至少一条反馈、指标或错误
- **AND** MUST 标注影响角色、频次与严重度

#### Scenario: No evidence means no proposal
- **WHEN** 某议题没有任何证据
- **THEN** 系统 MUST NOT 允许创建提议

#### Scenario: Duplicate feedback is merged
- **WHEN** 同一组织、应用、页面在 24 小时内出现相似反馈
- **THEN** 系统 MUST 合并计数
- **AND** MUST NOT 重复刷屏

### Requirement: Builder Profile and Tool Surface

Builder Agent SHALL 使用独立 profile，只能调用 `builder_*` 工具，不得批准、发布或激活。

#### Scenario: Runtime cannot call builder tools
- **WHEN** `piagent-runtime` 调用 `builder_*`
- **THEN** 工具网关 MUST 拒绝
- **AND** 返回 `DENIED`

#### Scenario: Builder cannot write business data
- **WHEN** `piagent-builder` 调用 `erp_*` 写工具
- **THEN** 工具网关 MUST 拒绝
- **AND** Builder MUST NOT 拥有生产业务表写权限

#### Scenario: Builder has no approval tools
- **WHEN** 检查 Builder 的工具集
- **THEN** MUST 不存在 `approve` / `publish` / `activate`
- **AND** 即使模型声称“已发布”，平台 MUST NOT 执行

### Requirement: Proposal Hard Requirements

每个 `ChangeProposal` SHALL 包含证据、结构化 diff、风险、测试计划与回退计划。

#### Scenario: Missing evidence is rejected
- **WHEN** 提议没有 feedback、metric 或 error 证据
- **THEN** 服务端 MUST 拒绝创建
- **AND** MUST NOT 依赖提示词提醒

#### Scenario: Natural language diff is rejected
- **WHEN** `diff` 不是结构化 Delta
- **THEN** 服务端 MUST 拒绝
- **AND** 错误 MUST 指明缺少结构化字段

#### Scenario: Risk and rollback are explicit
- **WHEN** 提议涉及数据模型或迁移
- **THEN** `risk` MUST 标注 `breaking` / `migration`
- **AND** `rollbackPlan` MUST 给出策略与数据安全标记

### Requirement: Separation of Author and Approver

提议作者 SHALL NOT 批准、发布或激活自己起草的提议；高风险变更需要第二审批人。

#### Scenario: Agent cannot approve
- **WHEN** Builder Agent 起草的提议被提交审批
- **THEN** 批准人 MUST 是有权限的人
- **AND** 服务端 MUST 校验批准人不是 Agent

#### Scenario: High-risk change requires second approver
- **WHEN** 提议涉及权限、工具、知识或迁移
- **THEN** 系统 MUST 要求安全或技术负责人第二审批
- **AND** 缺少第二审批 MUST 返回 `CONFLICT`

#### Scenario: Rejection reason is retained
- **WHEN** 审批人驳回提议
- **THEN** 驳回原因 MUST 写回提议
- **AND** 关联反馈 MUST 回到可再次处理的状态

### Requirement: Transparent Review and Preview

审批人 SHALL 能看到改了什么、为什么改、影响谁、怎么验、怎么退、谁写的。

#### Scenario: Review shows required evidence
- **WHEN** 审批人打开提议详情
- **THEN** 页面 MUST 展示结构化 diff、证据、影响面、测试/评测结果、回退计划与作者
- **AND** 预览链接 MUST 签名、短 TTL、可撤销

#### Scenario: Preview is not visible to business users
- **WHEN** 业务用户访问预览链接
- **THEN** 系统 MUST 拒绝或要求有效预览 token
- **AND** 每次访问 MUST 记审计

### Requirement: AI Module Integration

`ai_modules` 的六步定义 SHALL 作为 ChangeProposal 的来源之一，而不是另起一套编辑器。

#### Scenario: AI module becomes proposal source
- **WHEN** 管理员从某个 `ai_module` 发起变更
- **THEN** 系统 MUST 把六步定义的结果落到同一份 `AppDraft`
- **AND** 后续走同一套提议/校验/发布流程

#### Scenario: Builder can be disabled
- **WHEN** `builder.enabled=false`
- **THEN** 管理员 MUST 能回到人工 `ai_modules` 六步定义流程
- **AND** 现有提议与 Release 数据 MUST 保留

### Requirement: A1 Default Autonomy

系统 SHALL 默认启用 A1（起草 + 校验），并保持 A2 关闭。

#### Scenario: Default is A1
- **WHEN** 部署本变更
- **THEN** 应用级 `autonomy` MUST 默认为 `A1`
- **AND** Agent MUST NOT 自动发布任何变更

#### Scenario: A2 requires explicit enablement
- **WHEN** `autonomy=A2`
- **THEN** 必须由变更 8 的策略服务执行发布
- **AND** 本变更 MUST NOT 提供自动发布路径

