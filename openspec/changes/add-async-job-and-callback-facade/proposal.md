# Change: 异步任务与回调门面

## Why

平台目前只有两种异步机制：

- **outbox**：业务事件投递，至少一次 + 幂等，但不是“可查询进度/可取消/可重试的命令任务”；
- **cron**：静态 registry + 装饰器，适合系统定时任务，不适合用户触发的生成、解析、转码、导入导出。

教育项目需要：内容生成任务、文档解析、视频转码、批量导入/导出、外部系统异步回调、
任务状态查询、失败重试、唯一任务标识、幂等。`refactor-ai-native-business-app-platform`
的 Agent Runtime 已覆盖 agent run/step 的长任务状态，但不是通用 job 门面；
不能为每个业务再造一套。

## What Changes

- **ADDED** `async-job`：通用异步任务能力
  - 入队、领取、执行、进度、取消、超时、重试、退避、死信（DLQ）、手动重放。
  - 幂等键：同一组织/任务类型/幂等键只产生一个任务。
  - 任务类型注册：payload schema、handler、超时、最大重试、并发、优先级。
- **ADDED** 外部任务门面：`POST /jobs`、`GET /jobs/:id`、`POST /jobs/:id/cancel`，
  返回任务唯一 ID、状态、进度、结果/错误；供现有系统轮询或回调。
- **ADDED** 外部回调：回调 URL + HMAC 签名 + 重试/退避 + 响应校验；
  回调目标 MUST 走 allowlist/SSRF 防护。
- **ADDED** 进度事件：任务事件持久化，WebSocket/SSE 推送；查询接口可回放。
- **ADDED** 管理面：任务列表、重试、取消、DLQ、指标（成功率/耗时/积压）。
- **MODIFIED** 现有长任务入口（导入/导出/媒体/文档解析/内容生成）逐步改走 job 门面。
- **BOUNDARY** Agent Runtime 的 run/step/wait 状态仍归 `refactor-ai-native-business-app-platform`；
  job 只做通用传输/执行/回调，可携带 `agentRunId`，不复制 agent run 状态。
- **NOT CHANGED** outbox 事件投递、cron 系统任务、现有同步 API 行为。
- **NON-GOALS** 通用 BPMN/工作流、分布式事务、exactly-once、用户自定义脚本执行。
- **BREAKING** 无。新任务走新接口；旧同步路径保留。

## Impact

- 受影响规格：`async-job`（新增）、`semantic-runtime`（导入/导出接入，可选）、
  `asset-pipeline` / `ai-content-governance`（消费方）
- 受影响代码：
  - 新模块 `apps/api/src/jobs/**` 或 `libs/platform-core/src/jobs/**`
  - `apps/api/src/outbox/**`（复用重试/幂等模式，不混同事件）
  - `apps/api/src/semantic-runtime/**`（导入/导出/长任务）
  - `apps/api/src/agent-*`（携带 agentRunId，不复制状态）
  - `apps/web-portal` / `web-console` 任务中心
  - `DOMAIN.md`、`FLOWS.md`、`DECISIONS.md`
- 依赖：Redis（唤醒）、PostgreSQL（真源）、`refactor-ai-native-business-app-platform`（应用上下文/配额）。
- 迁移：新增表；现有同步导入/导出保留；长任务逐步切换。
- 风险：重复执行、任务积压、回调 SSRF、长事务、payload 兼容、RLS。
