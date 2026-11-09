# Design: 外部集成连接器

## Context

已核对的现状：

- `apps/api/src/outbox/**`：内部事件持久化/投递/重试/幂等；不面向外部系统。
- 没有外部连接器、凭证、限流、重试、DLQ、对账。
- 没有只读数据库连接器；教务/班级/学生无法自动同步。
- `add-identity-federation-and-session-governance` 提供服务令牌/委托身份，
  可作为外部系统调用平台的认证基础。
- `add-async-job-and-callback-facade` 提供投递/同步/重试/回调底座。
- `add-ai-module...` / MCP 工具面是 Agent 集成，不是通用外部系统集成。

## Goals / Non-Goals

**Goals**

1. 连接器注册与凭证管理（REST / Webhook / Database）。
2. 出站调用：认证、限流、超时、重试、幂等、DLQ、熔断、SSRF 防护。
3. 入站 Webhook：签名、幂等、映射、重放。
4. 只读数据库同步：连接测试、查询模板、字段映射、游标/水位、批量、调度、对账。
5. 外部系统通过服务令牌调用平台 API，平台二次校验。
6. 可观测、可审计、可对账。

**Non-Goals**

- 不做通用 ESB/iPaaS/ETL 平台。
- 不做任意 SQL/脚本执行；查询模板受控。
- 不做源库写回/双向同步。
- 不做跨库实时 CDC；v1 批量/增量拉取。
- 不做公网匿名接入。

## Decisions

### D1：连接器注册表

`integration_connectors`：

- `organizationId`、`appInstallationId?`、`key`、`name`
- `type`：`rest` / `webhook` / `database`
- `config`（endpoint、authType、headers、timeout、rateLimit、retry、allowlist、db type/host/port/database/ssl）
- `secretRef`（凭证引用）
- `status`（`active` / `disabled`）、`createdBy`、`createdAt`

唯一 `(organizationId, key)`；配置变更写审计并 bump 版本。
连接器只能由具备 `integrations:manage` 的角色管理。

### D2：出站 REST/Webhook

`outbound_messages`（或复用 job payload + 结果）：

- `connectorId`、`organizationId`、`eventType`、`payload`
- `idempotencyKey`、`status`、`attempts`、`lastError`
- `responseStatus`、`responseBody`（截断/脱敏）
- `nextAttemptAt`、`deadAt`

流程：

```text
业务事件/手动触发
  → 创建 outbound message（幂等键）
  → async-job 投递
  → 认证/签名/限流/超时
  → 2xx: succeeded
  → 4xx(非408/429): dead（配置错误/不可重试）
  → 5xx/408/429/超时: retry/backoff → DLQ
  → 熔断：连续失败打开，半开探测
```

认证：

- Bearer / API Key（header/query? 建议 header）
- Basic
- OAuth2 Client Credentials（token 缓存/刷新）
- 凭证只从 secretRef 解析；日志脱敏。

### D3：入站 Webhook

`webhook_endpoints`：

- `organizationId`、`key`、`name`、`secretRef`、`eventType`、`mapping`、`status`

`webhook_events`：

- `endpointId`、`eventId`/`idempotencyKey`、`payloadHash`、`status`、`receivedAt`、`processedAt`、`error`

校验：

- HMAC 签名 + 时间戳（防重放）；可选 IP allowlist；
- 幂等：同一 eventId 只处理一次；
- 映射：声明式 JSON → 内部事件/工具调用；
- 失败可重放/死信；payload 大小限制；
- 不执行任意代码；未知事件拒绝或进 DLQ。

### D4：数据库连接器（只读）

`data_sources`：

- `organizationId`、`key`、`name`、`dbType`（`postgres` / `mysql` / `mssql` / `oracle` 可选）
- `host`、`port`、`database`、`ssl`、`readOnlyUserSecretRef`
- `allowlist`（IP/CIDR）、`status`

`data_sync_jobs`：

- `dataSourceId`、`key`、`queryTemplate`（受控模板 ID + 参数）
- `fieldMapping`（JSONB：源字段 → 目标字段/类型/默认值/转换）
- `targetResourceKey`（导入适配器或内部表）
- `cursorField`/`watermark`、`batchSize`、`schedule`、`mode`（full/incremental）
- `status`、`lastRunAt`

`data_sync_runs`：

- `jobId`、`status`、`rowsRead`、`rowsWritten`、`rowsFailed`、`watermarkBefore/After`
- `diff`/`error`、`startedAt`、`finishedAt`

安全：

- 只读账号、最小权限、TLS、IP allowlist；
- 查询模板注册在白名单，参数化；禁止任意 SQL/DDL/DML；
- 不修改源库；不执行存储过程（除非显式白名单）；
- 连接测试只读；
- 源库压力：限流/批量/超时/重试。

### D5：字段映射与同步

- 映射：源字段 → 目标字段、类型转换、默认值、必填、枚举映射、日期/金额格式。
- 游标：`updatedAt`/自增 ID/水位；增量拉取；无游标时要求 full 并提示。
- 幂等：目标资源使用导入适配器/唯一键；重复行更新或跳过（按策略）。
- 对账：源计数/目标计数/校验和；差异报告；失败告警。
- 调度：cron/job；并发限制；失败重试；手动重跑。

### D6：外部系统调用平台

- 外部系统用 `add-identity-federation-and-session-governance` 的服务令牌/委托身份；
- 平台按 scope + 用户/组织 + 功能权限 + 数据范围二次校验；
- 出站回调可用 `add-async-job-and-callback-facade`；
- API 文档/OpenAPI；限流/审计。

### D7：安全

- SSRF：出站 URL allowlist、私网/元数据地址默认拒绝、禁止重定向到未授权地址；
- 凭证 secretRef + 加密；日志/响应脱敏；
- TLS 校验；数据库 SSL；
- 入站签名/时间戳/重放保护；
- PII 最小化/脱敏；
- 所有连接器变更、调用、同步、失败写审计。

### D8：可观测

- 指标：投递成功率、重试、DLQ、同步行数/耗时/差异；
- 日志：connector、event、attempt、error（脱敏）；
- 管理页：连接器/同步/运行/差异/DLQ/重放。

### D9：兼容

- 内部 outbox 不变；
- 旧导入接口不变；
- 新连接器可选；不配置则无外部调用；
- 回滚：停用连接器；历史消息/运行保留。

## Data Model

```sql
integration_connectors (
  id uuid pk,
  "organizationId" uuid not null,
  "appInstallationId" uuid,
  key varchar(64) not null,
  name varchar(255) not null,
  type varchar(16) not null,          -- rest | webhook | database
  config jsonb not null default '{}',
  "secretRef" varchar(255),
  status varchar(32) not null default 'active',
  "createdBy" uuid,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("organizationId", key)
)

outbound_messages (
  id uuid pk,
  "organizationId" uuid not null,
  "connectorId" uuid not null,
  "eventType" varchar(128) not null,
  payload jsonb not null,
  "idempotencyKey" varchar(255),
  status varchar(32) not null,
  attempts int not null default 0,
  "responseStatus" int,
  "responseBody" text,
  "lastError" text,
  "nextAttemptAt" timestamptz,
  "deadAt" timestamptz,
  "createdAt" timestamptz not null default now()
)

webhook_endpoints (
  id uuid pk,
  "organizationId" uuid not null,
  key varchar(64) not null,
  name varchar(255) not null,
  "secretRef" varchar(255) not null,
  "eventType" varchar(128) not null,
  mapping jsonb not null default '{}',
  status varchar(32) not null default 'active',
  unique ("organizationId", key)
)

webhook_events (
  id uuid pk,
  "organizationId" uuid not null,
  "endpointId" uuid not null,
  "eventId" varchar(255) not null,
  "payloadHash" varchar(64) not null,
  status varchar(32) not null,
  "receivedAt" timestamptz not null default now(),
  "processedAt" timestamptz,
  error text,
  unique ("endpointId", "eventId")
)

data_sources (
  id uuid pk,
  "organizationId" uuid not null,
  key varchar(64) not null,
  name varchar(255) not null,
  "dbType" varchar(16) not null,
  host varchar(255) not null,
  port int not null,
  database varchar(255) not null,
  ssl boolean not null default true,
  "secretRef" varchar(255) not null,
  allowlist jsonb not null default '[]',
  status varchar(32) not null default 'active',
  unique ("organizationId", key)
)

data_sync_jobs (
  id uuid pk,
  "organizationId" uuid not null,
  "dataSourceId" uuid not null,
  key varchar(64) not null,
  "queryTemplate" varchar(128) not null,
  "fieldMapping" jsonb not null,
  "targetResourceKey" varchar(255) not null,
  "cursorField" varchar(128),
  watermark varchar(255),
  "batchSize" int not null default 500,
  schedule varchar(64),
  mode varchar(16) not null default 'incremental',
  status varchar(32) not null default 'active',
  "lastRunAt" timestamptz,
  unique ("organizationId", key)
)

data_sync_runs (
  id uuid pk,
  "organizationId" uuid not null,
  "syncJobId" uuid not null,
  "jobId" uuid,
  status varchar(32) not null,
  "rowsRead" int not null default 0,
  "rowsWritten" int not null default 0,
  "rowsFailed" int not null default 0,
  "watermarkBefore" varchar(255),
  "watermarkAfter" varchar(255),
  diff jsonb not null default '{}',
  error text,
  "startedAt" timestamptz not null default now(),
  "finishedAt" timestamptz
)
```

所有表纳入 RLS；`outbound_messages`/`webhook_events`/`data_sync_runs` 通过 connector/job 继承组织。

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| SSRF/内网探测 | allowlist、私网/元数据默认拒绝、禁止重定向、TLS |
| 凭证泄露 | secretRef、加密、日志脱敏、最小 scope |
| 源库压力/锁 | 只读、限流、批量、超时、只读副本 |
| 字段映射错误 | 模板/预览/校验/对账；失败行报告 |
| 重复同步 | 幂等键/唯一键/水位；重跑幂等 |
| 回调/投递重复 | 幂等键 + 接收方去重 + 重试 |
| 任意 SQL | 查询模板白名单 + 参数化；不执行用户 SQL |
| 对账差异 | 计数/校验和 + 差异报告 + 告警 |
| 旧接口兼容 | outbox/导入不变；连接器可选 |

## Migration Plan

1. 新增表 + RLS + secretRef 解析。
2. 先接出站 REST/Webhook；再接数据库只读同步。
3. 选一个客户教务源试点：字段映射、增量、对账。
4. 再接服务令牌/委托身份的外部 API 调用。
5. 回滚：停用连接器；历史消息/运行保留；旧接口不受影响。

## Open Questions

- Oracle/SQL Server 驱动是否纳入 v1？建议 Postgres/MySQL 先，其他按客户环境。
- 数据库连接走直连还是部署侧 sidecar？内网直连 + allowlist 先，跨网段用 sidecar。
- Webhook 是否支持 mTLS？v1 先 HMAC + IP allowlist，mTLS 后置。
- 对账差异是否自动修复？v1 只报告，人工确认后重跑。
