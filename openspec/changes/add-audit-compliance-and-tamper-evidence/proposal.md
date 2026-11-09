# Change: 审计合规与防篡改

## Why

现有 `audit_logs` 只是普通表：

- 字段 `action/resource/actor/status/changes/metadata/timestamp`；
- 有查询与 CSV/JSON 导出，但没有哈希链、防篡改、序列号、检查点、归档保留、法律保留；
- 没有统一的“必须审计”事件目录，模块可能漏记或直接写表；
- 没有异常导出/权限变更/登录失败的告警。

教育项目要求 A-013 生成任务审计防篡改、A-023/A-045 全场景操作审计、
A-046 多维查询与台账导出、A-039/A-044 异常登录。审计是采购与合规的硬门槛。

## What Changes

- **ADDED** `audit-compliance`：追加式审计 + 每组织哈希链 + 检查点 + 验证。
- **ADDED** 审计事件目录与单一写入器：登录、权限/角色、发布/复核、导出、配置、
  AI 生成、数据同步、服务令牌等事件统一经 `AuditService.record()`。
- **ADDED** 防篡改：`seq`、`prevHash`、`hash`、检查点签名；验证 API/定时任务；
  数据库层拒绝 UPDATE/DELETE（break-glass 例外留痕）。
- **ADDED** 保留与归档：`retentionUntil`、法律保留、对象存储归档（JSONL + manifest）、
  恢复审计。
- **ADDED** 查询/导出增强：更多筛选、异步台账导出（走批量导出）、访问审计。
- **ADDED** 异常告警：批量导出、权限变更、连续登录失败、配置修改等规则，
  通过通知中心告警。
- **MODIFIED** 现有 `audit_logs`：保留旧字段，新增链字段；旧行标记 `legacy`，
  不重写历史。
- **NOT CHANGED** 业务模块的审计调用语义；现有查询/CSV/JSON 导出继续可用。
- **NON-GOALS** 区块链、SIEM 集成、全量 DLP、跨租户审计汇聚。
- **BREAKING** 无。旧数据可读；新链从迁移点开始。

## Impact

- 受影响规格：`audit-compliance`（新增）、`audit-logs`（现有实现扩展）
- 受影响代码：
  - `libs/platform-core/src/audit-logs/**`
  - `apps/api/src/audit-logs/**`
  - 各模块的审计写入点（登录、角色、复核、导出、AI、同步）
  - 新模块/服务 `AuditChainService` / `AuditVerificationJob`
  - `apps/web-console` 审计查询/验证页
  - `DOMAIN.md`、`DECISIONS.md`、`FLOWS.md`
- 依赖：`add-async-job-and-callback-facade`（验证/归档/导出）、
  `add-asset-and-media-pipeline`（归档文件）、`add-notification-center-and-announcements`（告警）。
- 迁移：新增列/表；旧行 `seq=null`/`hash='legacy'`；链从迁移点开始。
- 风险：高并发序列号、哈希链性能、归档恢复、数据库权限、告警误报。
