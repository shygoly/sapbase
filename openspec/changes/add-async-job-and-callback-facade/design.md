# Design: 异步任务与回调门面

## Context

已核对的现状：

- `apps/api/src/outbox/**`：事务内写事件、至少一次投递、幂等键、失败可查、可重投；
  但它是**事件**模型，不是可查询进度/可取消/可重试的命令任务。
- `apps/api/src/monitor/scheduled-job.registry.ts` + `@Cron`：静态 cron，适合系统定时任务；
  不能承载用户触发的生成、解析、转码、导入导出。
- 依赖里有 `redis`，没有 BullMQ/pg-boss/agenda。
- `refactor-ai-native-business-app-platform` 第 4 节已规划持久 Agent Runtime：
  session/run/step/wait/event replay/budget/cancel；它不是通用 job 门面，但可以复用其 run 状态。
- 教育项目的任务要求：异步回调、状态（待处理/处理中/成功/失败）、失败重试、唯一任务标识、
  幂等、进度、取消、外部系统轮询。

## Goals / Non-Goals

**Goals**

1. 通用任务入队/执行/查询/取消/重试/退避/DLQ。
2. 事务内入队：业务写入与任务创建同事务，回滚不留任务。
3. 幂等：同一组织/类型/幂等键只执行一次，重复请求返回同一任务。
4. 外部任务门面：唯一任务 ID、状态/进度/结果、回调/轮询。
5. 可观测：成功率、耗时、积压、重试、DLQ。
6. 为媒体、导入导出、文档解析、内容生成、Agent 长任务提供统一底座。

**Non-Goals**

- 不做 BPMN/通用工作流、补偿事务、子任务编排（由 review/Agent Runtime 负责）。
- 不做 exactly-once；采用至少一次 + 幂等。
- 不做用户自定义脚本/任意代码执行。
- 不替代 outbox（事件）与 cron（系统定时任务）。

## Decisions

### D1：PostgreSQL 真源 + Redis 唤醒

`jobs` 表为真源，worker 用 `FOR UPDATE SKIP LOCKED` 领取；Redis pub/sub 只做“有新任务”唤醒，
cron 兜底扫描 `runAt <= now()` 的 queued 任务。理由：

- 业务写入与 enqueue 可以在同一事务内，回滚一致；
- 复用现有 RLS/组织上下文；
- 避免引入新队列依赖；
- 教育项目量级（10k 增量/日、少量媒体/解析任务）足够。
- 如果后续吞吐/多租户隔离需要，可在 `JobQueue` 接口后切换 BullMQ/pg-boss，不改变业务 API。

考虑过的替代：BullMQ（成熟，但事务一致性与 RLS 需要额外桥接）；pg-boss（PG 真源，但定制
DLQ/回调仍需二次封装）。v1 自建轻量层，接口预留。

### D2：任务类型注册

```ts
interface JobTypeDefinition<T> {
  type: string
  payloadSchema: JSONSchema
  handler: (ctx: JobContext, payload: T) => Promise<JobResult>
  timeoutMs: number
  maxAttempts: number
  backoff: { kind: 'fixed' | 'exponential'; baseMs: number; maxMs: number }
  concurrency: number
  priority?: number
  idempotencyScope: 'organization' | 'app' | 'global'
}
```

- 类型在启动时注册；未知类型拒绝入队。
- payload 必须通过 schema；不合法拒绝，不进入队列。
- 版本化：`typeVersion` 可选；升级时旧任务按旧版本处理或迁移。

### D3：任务生命周期

```text
queued → running → succeeded
                 ↘ failed → retrying → running
                          ↘ dead (DLQ)
queued/running → cancelled
running → waiting (可选，等待外部回调/人工)
```

- `progress` 0—100；`job_events` 记录进度/日志/阶段。
- worker 领取时写 `leaseUntil` + `workerId`；心跳续租；超时/worker 崩溃 → 重新入队。
- 超时按类型 `timeoutMs`；超时算一次失败，可重试。
- 重试：最多 `maxAttempts`，指数退避；超过进入 `dead`（DLQ）。
- 取消：queued 直接取消；running 设置 `cancelRequested`，handler 需协作检查；不可强杀时等超时。
- `waiting` 用于外部回调：任务发出请求后等待回调，超时转 failed/retry。

### D4：幂等

- 唯一键：`(organizationId, type, idempotencyKey)`；`appInstallationId` 参与 scope（可选）。
- 重复入队返回已存在任务（200/409 按 API 语义），不重复执行。
- handler 仍需幂等：任务可能因 worker 崩溃被重投（至少一次）。
- 外部任务 ID 即 `jobs.id`；客户端可用 `Idempotency-Key` 头或 payload 字段。

### D5：外部回调

`jobs` 携带：

- `callbackUrl`、`callbackSecretRef`、`callbackStatus`、`callbackAttempts`
- 回调 body：`{ jobId, type, status, progress, result, error, finishedAt }`
- 签名：HMAC-SHA256(`timestamp + body`, secret)，头 `X-Job-Signature` / `X-Job-Timestamp`
- 重试：2xx 成功；4xx 不重试（除 408/429）；5xx/超时重试；最多 N 次，进 DLQ。
- 安全：回调 URL 必须 https（内网可按配置允许 http）、allowlist、禁止重定向到未授权地址；
  防 SSRF（私网/元数据地址默认拒绝，客户可配置内网 allowlist）。
- 回调失败不改变任务业务结果；记录 `callbackStatus`，可手动重放。

### D6：外部任务 API

```text
POST /jobs
  { type, payload, idempotencyKey?, callbackUrl?, priority? }
  → { id, status, progress, createdAt }

GET /jobs/:id
  → { id, type, status, progress, result?, error?, attempts, createdAt, finishedAt }

POST /jobs/:id/cancel
  → { id, status }

GET /jobs?status=&type=&from=&to=
  → 分页列表（管理员/所有者）
```

- 权限：调用方必须有任务类型的 `job:<type>:create` 或对应业务权限；
  查询/取消只能看自己/本组织/管理员范围。
- 组织/应用上下文来自可信身份，不接受 body 中的 organizationId。
- 限流/最大 payload/并发配额。

### D7：Agent Runtime 边界

- Agent 的 `run/step/wait` 状态归 `refactor-ai-native-business-app-platform`，job 不复制。
- 长 Agent run 可由 job 触发，job payload 携带 `agentRunId`；
  job 的进度/事件桥接 agent run 事件；job 完成时返回 `agentRunId`/最终状态。
- 不回写 agent run 的业务状态；两者通过 ID 关联。
- 这样避免“两套 run 状态”与“两套取消/预算”。

### D8：进度与事件

`job_events`：

- `jobId`、`seq`、`type`（`progress` / `stage` / `log` / `callback` / `error`）、`payload`、`createdAt`
- 进度更新写事件（可节流）；WebSocket/SSE 推送；查询接口支持 `afterSeq` 回放。
- 事件保留期可配置；DLQ 任务保留完整事件。

### D9：安全与隔离

- 每个 job 带 `organizationId`（可带 `appInstallationId`），纳入 RLS。
- payload schema 限定；不执行任意代码/URL/命令。
- 回调 URL/外部 provider 走 allowlist；secrets 用 secretRef。
- 任务创建/取消/重试/回调写审计；日志脱敏。
- worker 进程与 API 进程可分离；worker 使用独立 DB 角色（最小权限）。

### D10：可观测与管理

- 指标：queued/running/dead 数、成功率、P50/P95 耗时、重试次数、回调失败率。
- 管理页：筛选、详情、事件、重试、取消、DLQ 重放。
- 告警：积压/失败率/回调失败超阈值。

## Data Model

```sql
jobs (
  id uuid pk,
  "organizationId" uuid not null,
  "appInstallationId" uuid,
  type varchar(128) not null,
  "typeVersion" int not null default 1,
  status varchar(32) not null,
  priority int not null default 0,
  payload jsonb not null,
  result jsonb,
  error jsonb,
  progress int not null default 0,
  "idempotencyKey" varchar(255),
  attempts int not null default 0,
  "maxAttempts" int not null default 3,
  "runAt" timestamptz not null default now(),
  "startedAt" timestamptz,
  "finishedAt" timestamptz,
  "leaseUntil" timestamptz,
  "workerId" varchar(128),
  "cancelRequested" boolean not null default false,
  "callbackUrl" varchar(1024),
  "callbackSecretRef" varchar(255),
  "callbackStatus" varchar(32),
  "callbackAttempts" int not null default 0,
  "createdBy" uuid,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
)
-- unique ("organizationId", type, "idempotencyKey") where "idempotencyKey" is not null
-- index (status, "runAt", priority), index ("organizationId", status, "createdAt")

job_attempts (
  id uuid pk,
  "jobId" uuid not null,
  attempt int not null,
  status varchar(32) not null,
  error jsonb,
  "startedAt" timestamptz not null,
  "finishedAt" timestamptz,
  "durationMs" int
)

job_events (
  id uuid pk,
  "jobId" uuid not null,
  seq bigint not null,
  type varchar(32) not null,
  payload jsonb not null default '{}',
  "createdAt" timestamptz not null default now(),
  unique ("jobId", seq)
)
```

所有表纳入 RLS（`jobs` 直接；`job_attempts`/`job_events` 通过 `jobId` 继承）。

## Flows

### 入队与执行

```text
业务事务:
  write business row
  insert jobs (queued, runAt, idempotencyKey)
  commit
  → Redis publish "job:queued"

worker:
  claim queued/running-expired with SKIP LOCKED
  → set running, leaseUntil, attempts+1
  → execute handler
      progress → job_events
      success → succeeded + result + callback
      failure → retry/backoff or dead
  → release lease
```

### 外部回调

```text
job succeeded/failed
  → if callbackUrl: enqueue callback attempt (or inline)
  → POST body + HMAC
  → 2xx: callbackStatus=succeeded
  → 5xx/timeout: retry with backoff; after max → callbackStatus=dead
  → 手动重放
```

### 取消

```text
POST /jobs/:id/cancel
  → queued: status=cancelled
  → running: cancelRequested=true；handler 检查后抛 Cancelled
  → 超时仍未停：标记 cancelled，worker 结果丢弃
```

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| 重复执行 | 至少一次 + 幂等键 + handler 幂等 + 唯一约束 |
| worker 崩溃/任务卡住 | lease/heartbeat + 超时重新入队 + 管理重试 |
| 任务积压 | 指标/告警 + 并发/优先级 + 水平扩 worker |
| 回调 SSRF | allowlist + 私网默认拒绝 + 禁止重定向 + 签名 |
| 长事务/大 payload | 限制大小；大文件走 asset pipeline；payload 只存引用 |
| 与 Agent Runtime 重复 | job 只做传输；agent run 状态归 Agent Runtime |
| RLS/多租户 | organizationId + appInstallationId + RLS + 可信上下文 |
| 回调重复/乱序 | 幂等键 + jobId+status+timestamp；接收方去重 |
| 类型升级 | typeVersion + 兼容/迁移策略 |

## Migration Plan

1. 新表 + RLS + worker 骨架；先接一个非关键任务（如审计导出）试点。
2. 接入导入/导出，保留同步路径。
3. 接入媒体/文档解析任务。
4. 接入 Agent 长任务（携带 agentRunId）。
5. 回滚：停用 worker/新入口；旧同步路径仍可用；任务表保留。

## Open Questions

- worker 与 API 是否分进程部署？建议支持，开发默认同进程。
- 是否需要定时任务（cron）也走 job？系统 cron 保留；用户级定时（如预警）可由 job scheduler 扩展。
- 回调是否需要 mTLS/双向认证？按客户集成要求，v1 先 HMAC + allowlist。
- 任务结果保留期与大小限制？按类型配置，默认 7—30 天。
