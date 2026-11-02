# Change: A2 低风险发布自动化（P5）

> 执行顺序：**7 / 8**
> 依赖：变更 3–6（Release、Runtime、Knowledge/Eval、Builder A1）
> 参考：`docs/reference/06-evolution-loop.md` §0/§7、`07-adoption-and-checks.md` §P5

## Why

A1 已经让 Builder 能起草、校验、预览，但所有发布仍由人点按钮。
参考包允许对**低风险、可回退、非结构性**变更开启 A2：Agent 仍然只提议，
由平台策略服务 `release-automation` 按预授权规则发布到灰度，并受护栏与自动回退约束。

A2 不是“让 AI 自己改生产”。它是**人制定策略、平台执行、人事后复核**的受限自动化。
结构性变更（数据/流程/权限/工具/知识规则/迁移）永远不得 A2。

## What Changes

- **ADDED** `release_automation_policies`：应用级 A2 开关、白名单变更类、护栏阈值、连续无回退计数
- **ADDED** `release_automation_runs`：A2 发布/回退/复核运行记录
- **ADDED** `ReleaseAutomationService`：唯一有权执行 A2 发布的组件；`actorAgent` 必须为空
- **ADDED** A2 白名单校验：只允许文案、changelog、菜单名称/图标、表单布局、校验消息、纯操作知识
- **ADDED** 灰度与护栏：默认 `5% → 25% → 100%`；阈值未配置则只允许人工回退
- **ADDED** 自动回退：仅在阈值显式配置、目标 Release 可用且数据兼容时执行
- **ADDED** 发布后 24h 人工复核；连续 5 次无回退才保留 A2 资格
- **ADDED** 一键关闭 A2，回到 A1
- **ADDED** 季度审计：A2 使用范围、回退次数、结构性变更 0 次自动发布
- **MODIFIED** 配置与审计：A2 行为不得记在 Agent 名下；`actor_agent` 为空

**BREAKING**：无。A2 默认关闭；不改变 A1 行为。

## Impact

- Affected specs: `release-automation`（新增）
- Affected code:
  - `backend/src/release-automation/**`
  - `backend/src/releases/**`（发布/激活/回退复用）
  - `backend/src/agent-eval/**`（A2 前后评测）
  - `backend/src/monitor/scheduled-job.registry.ts`（护栏/复核 job）
  - `backend/src/migrations/*CreateReleaseAutomation*`
  - `speckit` 管理端 A2 策略与审计页面
  - `DOMAIN.md`、`FLOWS.md`、`DECISIONS.md`

## Out of Scope

- 不开启 A3（结构性自动发布）
- 不自动修改 A2 策略本身
- 不自动回退没有阈值配置的发布
- 不做跨应用批量 A2
