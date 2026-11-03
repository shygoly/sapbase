## Context

A1 的闭环是：反馈 → 提议 → 校验 → 预览 → 人批准 → 发布 → 激活 → 观察。
A2 只替换“人批准 + 发布”这一小段，且只对白名单变更类、在应用级开关打开时生效。

关键边界：**发布者不是 PiAgent**。PiAgent 仍然只能起草；
`release-automation` 是平台策略服务，`actor_agent` 必须为空，审计能区分“Agent 建议”与“平台执行”。

## Goals / Non-Goals

- Goals
  - 白名单外的变更 100% 被 A2 拒绝
  - 无阈值配置时绝不自动回退
  - 自动回退可演练、可审计、可一键关闭
  - 结构性变更自动发布次数为 0
- Non-Goals
  - 不追求“无人值守”
  - 不让 Agent 修改策略
  - 不自动发布数据模型/流程/权限/工具/迁移

## Decisions

- Decision: A2 白名单按**变更类**，不按“改动行数”。
  - 允许：帮助文案、字段提示、错误消息、changelog 措辞、菜单名称/图标（不改权限）、表单布局（不增删字段/不改校验）、校验消息、纯操作知识条目。
  - 拒绝：新增可选字段、页面/流程、规则/审批/权限、工具/技能、迁移。
- Decision: 白名单之外的提议必须走 A1 人工发布，不得降级为 A2。
- Decision: 策略服务执行发布/激活/回退；Agent 无 publish 权限。
- Decision: 灰度默认 `5% → 25% → 100%`，每档观察窗口 ≥ 24h；A2 首次只到 25%，100% 仍需人工确认（可配置）。
- Decision: 自动回退必须同时满足：`autonomy=A2`、白名单、阈值显式配置、目标 Release 可用且兼容、回退动作写审计与通知。
- Decision: 默认**不自动回退**；即使 A2，也先跑一段人工观察。
- Decision: 连续 5 次无回退才保留资格；发生回退、护栏触发或 24h 未复核则自动降回 A1。
- Decision: 策略修改视为高风险变更，不能由 Agent 起草自动生效。

## Policy Data

`release_automation_policies`：

- `organizationId`、`appKey`
- `autonomy`：`A1 | A2`
- `enabled`
- `allowedChangeClasses`：文案/菜单/布局/校验消息/知识等
- `guardrails`：错误率、任务完成率下降、5xx、工具失败率、答疑差评率阈值
- `canaryStages`：默认 `[5,25,100]`
- `autoRollbackEnabled`
- `consecutiveCleanRuns`
- `lastReviewedAt`、`reviewedBy`

`release_automation_runs`：

- `policyId`、`proposalId`、`releaseId`、`action`、`status`、`actorId`、`actorAgent`（必须 NULL）、`details`、`createdAt`

## Risks / Trade-offs

- 风险：A2 范围蔓延 → 白名单只缩不扩；季度审计；一键关闭。
- 风险：护栏指标缺失 → 未配置阈值时禁止自动回退，只能人工。
- 风险：自动回退造成数据不一致 → 只允许 `rollbackSafe` 或已补偿迁移的目标。
- 风险：Agent 被误记为发布者 → 审计强制 `actor_agent=NULL`，并在测试中断言。
- 权衡：A2 首发只到灰度，不直接 100%，牺牲一点效率换可回退。

## Migration Plan

1. 建策略/运行表，A2 默认关闭。
2. 实现策略校验与 A2 发布服务，但只允许 dry-run。
3. 对文案类变更开一个小 app 的 5% 灰度。
4. 连续 5 次无回退后扩大到 25%；100% 仍人工。
5. 回退：一键 `enabled=false`，所有 A2 行为停止，回到 A1。
