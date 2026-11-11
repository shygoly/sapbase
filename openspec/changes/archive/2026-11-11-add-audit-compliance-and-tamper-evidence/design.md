# Design: 审计合规与防篡改

## Context

已核对的现状：

- `libs/platform-core/src/audit-logs/audit-log.entity.ts`：
  - `action/resource/actor/status/resourceId/changes/metadata/timestamp` + `organizationId`；
  - 索引 `resourceId/action/actor/timestamp/organizationId`。
- `audit-logs.controller.ts`：分页查询 + CSV/JSON 导出；没有验证/归档/保留。
- `common/events/handlers/audit-log-handler.ts`、插件审计、Agent 工具审计等分散写入。
- 没有追加式约束、哈希链、序列号、检查点、法律保留、异常告警。

## Goals / Non-Goals

**Goals**

1. 追加式审计：写入后不可改/不可删（break-glass 例外留痕）。
2. 每组织哈希链：`seq + prevHash + hash`，可验证完整性。
3. 检查点：定期签名/封存，支持快速验证与归档。
4. 保留/归档/法律保留：按策略保留，冷归档可恢复。
5. 统一事件目录与单一写入器，覆盖关键操作。
6. 查询/导出增强 + 访问审计 + 异常告警。
7. 兼容旧数据/旧接口。

**Non-Goals**

- 不做区块链/去中心化存证。
- 不做 SIEM/SOAR 集成、全量 DLP。
- 不做跨租户审计汇聚。
- 不重写历史审计行。

## Decisions

### D1：扩展审计记录

`audit_logs` 增加：

- `seq`：每组织单调递增（bigint）
- `prevHash`、`hash`、`hashAlgo`（`sha256`）
- `payload`：canonical JSON（参与哈希的稳定载荷）
- `actorType`：`user` / `service` / `system` / `agent`
- `appInstallationId?`、`ip`、`userAgent`、`correlationId`
- `retentionUntil`、`legalHold`、`archivedAt`
- `source`（模块/事件名）

旧字段保留；旧行 `seq=null`、`hash='legacy'`，不参与新链。
链从迁移时第一个新事件开始；验证报告把 legacy 段标记为“未链化历史”。

### D2：哈希链

每组织一条链：

```text
payloadHash = SHA256(canonical(payload))
hash = SHA256(prevHash || seq || createdAt || payloadHash)
```

- `seq` 在事务内用组织级计数/行锁分配；并发写入串行化每组织链。
- 写入必须与业务写入同事务（或至少同事务提交）以保证顺序；
  如果业务回滚，审计也回滚（除非是“失败审计”，单独事务写入）。
- `prevHash` 取该组织最后一条有效链记录；空链用 `genesis`。
- 哈希计算只在一处实现（`AuditChainService`），禁止模块自行拼。

### D3：检查点

`audit_checkpoints`：

- `organizationId`、`fromSeq`、`toSeq`、`lastHash`、`count`
- `signature`（平台 HMAC/Ed25519 对 checkpoint 内容签名）
- `createdAt`、`createdBy`（system）

- 定时（如每小时/每日）或手动封存；
- 验证时可从最近 checkpoint 开始，减少全链扫描；
- 归档时 checkpoint 与 JSONL 一起保存。

### D4：追加式与写入权限

- 应用层只暴露 `AuditService.record()`；禁止模块直接 `repository.insert/update/delete`；
- 数据库触发器/权限拒绝 `UPDATE`/`DELETE`（除 break-glass 角色）；
- break-glass 必须写“审计的审计”事件并告警；
- 代码检查：禁止在 audit-logs 之外直接写 `audit_logs`（脚本/评审清单）。

### D5：事件目录与覆盖

`AuditEventCatalog`（代码常量 + 文档）：

- 认证：登录成功/失败、登出、强制下线、SSO、服务令牌；
- 权限：角色/绑定/权限点/菜单变更；
- 业务：发布/复核/驳回/撤回、导出、导入、配置修改；
- AI：生成任务、模型调用、内容审核、AI 评分；
- 集成：同步运行、回调、连接器变更；
- 安全：异常登录、越权、break-glass。

每个事件声明 `action`、`resource`、`requiredFields`、`retentionClass`。
模块必须使用目录中的事件；未知事件拒绝或标记 `custom` 并告警。

### D6：保留、归档、法律保留

- `retentionClass`：`short`（90 天）/`standard`（1 年）/`compliance`（3—7 年）/`permanent`。
- `retentionUntil` 由策略计算；`legalHold=true` 时禁止清理。
- 归档：按时间段导出 JSONL + manifest（含 checkpoint/hash）到资产存储；
  归档后在线表可删除（保留索引/摘要）；恢复任务可回灌。
- 清理：分批、幂等、审计；不得删除 legal hold/未归档数据。

### D7：查询、导出、访问审计

- 查询：actor/action/resource/resourceId/时间/来源/结果/actorType/correlationId。
- 导出：CSV/JSON（现有）+ XLSX/PDF（走批量导出）；大导出异步。
- 访问审计：谁查询/导出了审计日志、筛选条件、行数；写审计。
- 敏感字段脱敏（changes/metadata 中的手机号/证件号）按权限显示。

### D8：异常告警

规则（v1）：

- 批量导出超过阈值；
- 权限/角色变更；
- 连续登录失败/异常登录；
- 审计查询/导出本身；
- break-glass；
- 哈希验证失败。

告警走 `add-notification-center-and-announcements`；规则可配置、可静默。

### D9：验证

- `AuditVerificationService.verify(orgId, fromSeq?, toSeq?)`：
  - 从最近 checkpoint 或 genesis 开始；
  - 重算 hash，找第一处断链；
  - 返回 `{ valid, checked, firstBrokenSeq?, checkpointValid }`。
- 定时 job 每日验证最近 N 条；失败告警。
- API：`GET /audit-logs/verify`（管理员）。
- 归档恢复后再次验证。

### D10：兼容与迁移

- 旧行不改写；`seq=null`、`hash='legacy'`。
- 新链从迁移后第一条开始；验证报告区分 legacy/链化段。
- 旧查询/CSV/JSON 导出保持；新筛选可选。
- 回滚：停止链写入/验证；旧字段仍可用；不删除新列。

## Data Model

```sql
ALTER TABLE audit_logs
  ADD COLUMN seq bigint,
  ADD COLUMN "prevHash" varchar(64),
  ADD COLUMN hash varchar(64),
  ADD COLUMN "hashAlgo" varchar(16) DEFAULT 'sha256',
  ADD COLUMN payload jsonb,
  ADD COLUMN "actorType" varchar(16) DEFAULT 'user',
  ADD COLUMN "appInstallationId" uuid,
  ADD COLUMN ip varchar(64),
  ADD COLUMN "userAgent" text,
  ADD COLUMN "correlationId" varchar(128),
  ADD COLUMN source varchar(128),
  ADD COLUMN "retentionUntil" timestamptz,
  ADD COLUMN "legalHold" boolean NOT NULL DEFAULT false,
  ADD COLUMN "archivedAt" timestamptz;
-- unique ("organizationId", seq) where seq is not null

audit_checkpoints (
  id uuid pk,
  "organizationId" uuid not null,
  "fromSeq" bigint not null,
  "toSeq" bigint not null,
  "lastHash" varchar(64) not null,
  count int not null,
  signature text not null,
  "createdAt" timestamptz not null default now(),
  "createdBy" varchar(128) not null default 'system'
)

audit_archives (
  id uuid pk,
  "organizationId" uuid not null,
  "fromSeq" bigint not null,
  "toSeq" bigint not null,
  "assetId" uuid not null,
  manifest jsonb not null,
  status varchar(32) not null,
  "createdAt" timestamptz not null default now(),
  "restoredAt" timestamptz
)
```

新表纳入 RLS；`audit_logs` 已有 RLS，增加 seq 唯一索引。

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| 每组织链串行化影响吞吐 | 按组织分链；批量写入合并；异步验证；必要时分区 |
| 哈希链实现错误 | 单一 `AuditChainService` + 固定向量测试 + 验证 job |
| 旧数据无法链化 | 明确 legacy 段；不回写；验证报告区分 |
| 归档恢复复杂 | JSONL + manifest + checkpoint；恢复后验证 |
| 数据库超级用户可改 | 应用角色最小权限；break-glass 审计告警；不承诺防 DBA |
| 告警误报 | 阈值可配 + 静默 + 白名单 |
| 导出泄露敏感信息 | 字段权限/脱敏 + 访问审计 + 批量导出告警 |

## Migration Plan

1. 扩展 `audit_logs` 列/索引；旧行标记 legacy。
2. 新增 checkpoints/archives 表 + RLS。
3. 实现 `AuditChainService` 与写入器，切换关键模块。
4. 启用验证 job/API；再接归档/保留。
5. 回滚：停止链写入/验证；旧查询/导出继续。

## Open Questions

- 检查点签名用平台 HMAC 还是 Ed25519？建议复用现有签名密钥体系。
- 审计链按组织分区还是单表？先单表 + 组织索引，量大再分区。
- 归档存储用资产管道还是独立 bucket？建议复用资产管道，单独保留策略。
- 是否提供外部时间戳（TSA）？v1 不做，预留 checkpoint 签名扩展。
