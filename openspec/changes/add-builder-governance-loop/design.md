## Context

现有资产：

- `ai_modules`：六步定义 / 测试 / 评审
- `ChangeProposal` / `Release`（变更 3）
- `AgentToolRegistry` + `ConfirmationTokenService`（Runtime 工具面）
- `KnowledgeEntry` / `EvalRun`（变更 5）

缺口：

- 没有反馈表与聚类
- 没有 Builder profile；`contracts-loader` 目前直接拒绝非空 `allowedAgents`
- 没有“提议必须带证据/diff/风险/测试/回退”的服务端校验
- 没有治理台查看反馈、证据、影响面与审批

## Goals / Non-Goals

- Goals
  - 反馈 → 议题 → 提议 → 校验 → 预览 → 审批 → 发布全链路可追溯
  - Builder 工具集里不存在 `approve` / `publish` / `activate`
  - 每条提议至少一条证据
  - 作者 ≠ 批准人；高风险双人审批
- Non-Goals
  - 不自动发布（A2 在变更 8）
  - 不让 Builder 写 `biz_*` 表
  - 不做跨租户运营视图

## Decisions

- Decision: 反馈正文先脱敏再入库；脱敏失败则不记正文，只记结构化上下文。
  - 反馈是不可信数据，读入模型时用 nonce 包裹。
- Decision: 议题聚类由规则 + Builder 辅助完成，聚类结果持久化到 `agent_feedback_topics`。
  - 没有证据的议题不进入提议阶段（INV-EVO-01）。
- Decision: Agent profile 进入工具网关。
  - `AgentToolRegistry.invoke()` 接收 `agentProfile`；未在 `allowedAgents` 的 profile 直接拒绝。
  - 这会替换 `contracts-loader` 中“非空 allowedAgents 一律拒绝”的临时规则。
- Decision: Builder 工具只写草稿/提议/知识草稿；业务表写入不在其工具集内。
- Decision: 提议创建时服务端校验必填字段，不依赖提示词。
- Decision: 审批人修改后批准时，修改留痕；原作者仍记 Agent/发起人，批准人记实际修改人。
- Decision: `autonomy` 配置默认 `A1`；`A2` 必须显式开启且本变更不实现。

## Builder Tool Surface

| 工具 | 权限 | 写 | 允许 profile |
|---|---|---|---|
| `builder_feedback_list` | `tool:builder:read` | 否 | `piagent-builder` |
| `builder_metrics_get` | `tool:builder:read` | 否 | `piagent-builder` |
| `builder_proposal_create` | `tool:builder:write` | 是 | `piagent-builder` |
| `builder_proposal_validate` | `tool:builder:validate` | 否 | `piagent-builder` |
| `builder_release_preview` | `tool:builder:validate` | 否 | `piagent-builder` |
| `builder_changelog_draft` | `tool:builder:write` | 是 | `piagent-builder` |

Builder 工具集中 MUST NOT 出现 `approve` / `publish` / `activate`。

## Proposal Hard Requirements

| 要求 | 服务端判据 |
|---|---|
| 证据 | `evidence` 至少一条 feedback/metric/error |
| 差异 | `diff` 是结构化 Delta，不是自然语言 |
| 风险 | `risk` 含 `breaking` / `permissionChange` / `migration` / `agentBehaviorChange` |
| 测试 | `testPlan` 至少一个可执行测试或评测用例 |
| 回退 | `rollbackPlan.strategy` 非空；数据不安全标 `dataSafe:false` |
| 范围 | 只能改目标 app 的 draft，不能跨 app |
| 作者 | 记录 `createdByAgent` 与 `createdBy` |

## Risks / Trade-offs

- 风险：反馈聚类质量差 → 先规则 + 人工确认；不因聚类噪声放宽证据要求。
- 风险：Agent profile 改造影响现有工具调用 → 默认 profile 为 `piagent-runtime`，旧调用保持兼容。
- 风险：Builder 误写生产 → 工具集与权限点双重限制，服务端再校验目标表/资源。
- 风险：治理台页面过大 → 先做最小可用视图，diff 用结构化渲染。

## Migration Plan

1. 建反馈表与 API，只采集不闭环。
2. 加议题聚类与只读 Builder（不写提议）。
3. 加提议草稿工具与服务端硬校验。
4. 接治理台与审批。
5. 回退：关闭 `builder.enabled`，回到人工用 `ai_modules`。
