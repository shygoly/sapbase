# Change: 外部集成连接器

## Why

平台目前只有内部 outbox：

- 业务事件可以在进程内/跨进程投递，但没有“外部 REST/Webhook 连接器”；
- 没有外部系统凭证、限流、重试、DLQ、对账；
- 没有只读数据库连接器，无法从教务等系统同步班级/学生；
- 教育项目 A-025/A-027/A-048—A-050、B-016 需要对外 API、异步回调、
  内网数据库只读同步、字段映射、失败重试、对账核验、审计与 IP 白名单。

这些是跨行业集成能力，不能写进教育业务。

## What Changes

- **ADDED** `external-integration`：连接器注册表（REST / Webhook / Database），
  凭证走 secretRef，按组织/应用隔离。
- **ADDED** 出站 REST/Webhook：认证（Bearer/API Key/OAuth2 Client Credentials/Basic）、
  限流、超时、重试/退避、幂等键、DLQ、熔断、SSRF allowlist。
- **ADDED** 入站 Webhook：签名/时间戳校验、幂等、事件映射、重放/死信。
- **ADDED** 数据库连接器：只读账号、TLS、IP 白名单、连接测试、
  查询模板、字段映射、游标/水位、批量、调度、重试、对账。
- **ADDED** 同步运行与对账：`data_sync_runs`、差异报告、失败告警；
  通过 `async-job` 执行。
- **ADDED** 外部 API 门面：结合 `add-identity-federation-and-session-governance`
  的服务令牌/委托身份，外部系统可调用平台 API；平台二次校验。
- **NOT CHANGED** 内部 outbox、cron、现有同步导入接口。
- **NON-GOALS** 通用 ESB/iPaaS、任意 SQL、双向写回源库、跨库实时复制、ETL 平台。
- **BREAKING** 无。新连接器为可选；旧接口继续可用。

## Impact

- 受影响规格：`external-integration`（新增）、`async-job`（消费方）、
  `identity-federation`（服务令牌）
- 受影响代码：
  - 新模块 `apps/api/src/integrations/**` 或 `libs/platform-core/src/integrations/**`
  - `apps/api/src/outbox/**`（内部事件不变，外部投递另走 job）
  - `apps/api/src/identity/**`（服务令牌/委托身份）
  - `apps/web-console` 连接器/同步管理
  - `DOMAIN.md`、`FLOWS.md`、`DECISIONS.md`
- 依赖：`add-async-job-and-callback-facade`（投递/同步/重试）、
  `add-identity-federation-and-session-governance`（服务令牌）、
  `add-audit-compliance-and-tamper-evidence`（同步/调用审计）。
- 迁移：新增表；旧 outbox/导入不变；连接器按客户环境配置。
- 风险：SSRF、凭证泄露、源库压力、字段映射错误、重复同步、对账差异。
