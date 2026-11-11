# Change: Builder Agent 与 A1 治理闭环（P4）

> 执行顺序：**6 / 8**
> 依赖：变更 3（Release/Proposal）、变更 4（Runtime/工具面）、变更 5（Knowledge/Eval）
> 参考：`docs/reference/06-evolution-loop.md`、`05-piagent.md` §5、`07-adoption-and-checks.md` §P4

## Why

当前 `ai_modules` 已有“六步定义 / 测试 / 评审”的雏形，但没有把业务反馈、
发布提议、校验、预览、审批串成一条可追溯的闭环；也没有 Builder Agent 的独立 profile。
如果让 Runtime Agent 也能起草/批准提议，或让 Builder 直接写生产表，治理就失效了。

本变更实现 **A1（起草 + 校验）**：Builder 可以读反馈/指标、写草稿与提议、
跑校验、生成预览与 changelog 草稿；**批准、发布、激活仍然只能由人完成**。
A2（低风险自动发布）保持关闭，留给变更 8。

## What Changes

- **ADDED** `agent_feedback`：业务反馈，自动带 `releaseId`、`cohort`、`screen`、`traceId`、脱敏正文
- **ADDED** `agent_feedback_topics`：反馈聚类后的候选议题与证据
- **ADDED** `POST /agent/feedback` 与反馈合并/去重
- **ADDED** Builder Agent profile：`piagent-builder`，独立工具集、提示词、知识范围与权限点
- **ADDED** 工具面：`builder_feedback_list`、`builder_metrics_get`、`builder_proposal_create`、`builder_proposal_validate`、`builder_release_preview`、`builder_changelog_draft`
- **ADDED** Agent 身份进入工具网关：`allowedAgents` 由平台校验，不再是“声明了也执行不了”
- **ADDED** 提议硬要求：至少一条证据、结构化 diff、风险、测试计划、回退计划
- **ADDED** 管理端治理台：反馈列表、议题、提议 diff/证据/影响面、审批记录
- **ADDED** `ai_modules` 六步定义作为 `ChangeProposal` 的来源之一
- **MODIFIED** `ReleaseValidationService`：Builder 起草的提议必须带 G0–G6 证据与 G7 审批
- **MODIFIED** 配置：`autonomy=A1` 为默认；`A2` 关闭

**BREAKING**：工具契约新增 `allowedAgents` 语义；现有工具若声明该字段，必须能被 profile 校验。

## Impact

- Affected specs: `agent-governance`（新增）
- Affected code:
  - `backend/src/agent-feedback/**`、`backend/src/agent-builder/**`
  - `backend/src/agent-tools/**`（profile 校验、builder 分派）
  - `backend/src/ai-modules/**`（提议来源）
  - `contracts/tools.json`、`AGENT-TOOLS.md`
  - `backend/src/migrations/*CreateAgentFeedback*`
  - `speckit` 治理台页面
  - `DOMAIN.md`、`FLOWS.md`、`DECISIONS.md`

## Out of Scope

- 不做 A2 自动发布（变更 8）
- 不让 Builder 写业务表
- 不让 Builder 批准/发布/激活
- 不做跨租户反馈读取
- 不做反馈的自动修复承诺
