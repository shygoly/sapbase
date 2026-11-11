# 审计与防篡改证据（Audit & Tamper Evidence）

审计是只追加证据链；业务表才是状态真源，审计用于事后还原与合规。

## 事件

`audit_logs` 一行 = 一个事件。已知 action 定义在
`libs/platform-core/src/audit-logs/audit-event-catalog.ts`：

| 类别 | action 示例 |
|---|---|
| 认证 | `auth.login` / `auth.login.failed` / `auth.logout` / `auth.session.revoked` |
| 权限 | `role.*` / `permission.changed` / `menu.changed` |
| 业务 | `release.*` / `review.*` / `announcement.*` / `data.import` / `data.export` |
| AI | `ai.generate` / `ai.model.call` / `ai.content.review` |
| 集成 | `integration.sync` / `connector.changed` |
| 审计自身 | `audit.query` / `audit.export` / `audit.verify` / `audit.break_glass` / `audit.archive` / `audit.restore` |

- 已知 action 缺必填字段 → 400。
- 未知 action → `source=custom` + `metadata.auditUnknownAction=true`，由告警消费。
- `retentionClass` → `retentionUntil`：short 30d / standard 180d / long 3650d / legal 不自动过期。

## 链

- 每组织 `pg_advisory_xact_lock` 串行分配 `seq`。
- `hash = SHA256(prevHash + canonical payload)`；`prevHash` 首行 `genesis`。
- DDL 触发器拒绝 `UPDATE/DELETE`；只有 `app.audit_break_glass=on` 的清理/恢复例外。
- 失败审计用独立事务（`AuditLogsService.recordFailure`），业务回滚仍留痕。

## 检查点与验证

- `POST /api/audit-logs/checkpoint` 生成 HMAC-SHA256 checkpoint（`AUDIT_CHECKPOINT_SECRET`）。
- `GET /api/audit-logs/verify` 从最新 checkpoint 锚点向后重算；签名/链/hash 任一不符即失败。
- 每日 cron：`audit.checkpoint_scan` / `audit.verify_scan` / `audit.retention_scan`。

## 归档 / 保留 / 恢复

- `POST /api/audit-logs/archive`：JSONL + manifest → 对象存储，再标记 `archivedAt`。
- `POST /api/audit-logs/cleanup`：只删已归档、非 legalHold、已过 `retentionUntil` 的行，
  并写 `audit.break_glass`。
- `POST /api/audit-logs/:id/legal-hold`：法律保留开关，break-glass 留痕。
- `POST /api/audit-logs/restore`：从归档回灌，随后重新验证链。

## 查询与导出

`GET /api/audit-logs` 支持 actor/action/resource/时间/source/actorType/correlationId/status 过滤；
`POST /api/audit-logs/export?format=csv|json`。查询/导出本身写 `audit.query`/`audit.export`，
敏感字段（password/token/secret/authorization/cookie 等）输出为 `[REDACTED]`。

## 告警

`GET /api/audit-logs/alerts?windowMinutes=1440`：

- 登录失败超阈值（`AUDIT_ALERT_LOGIN_FAILURES`，默认 10）
- break-glass
- 审计链验证失败
- 大批量导出（`AUDIT_ALERT_EXPORT_ROWS`，默认 1000）
- 权限/角色变更

## 禁止直写

业务模块不得 `getRepository(AuditLog).save/update/delete` 或直接 SQL 写 `audit_logs`。
`npm run check:audit-writes` 会扫描 `apps/`、`libs/`；只允许
`audit-chain.service.ts`、`audit-logs.service.ts`、`audit-retention.service.ts`。
