## 1. 契约与元语

- [x] 1.1 `schemas/audit.schema.json` + `audit-event-catalog.ts`
- [x] 1.2 META §3.17 + 不变量 44–49
- [x] 1.3 在 `DOMAIN.md` 新增审计小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [x] 1.4 DECISIONS D-16
- [x] 1.5 FLOWS + registry + @Cron：checkpoint/verify/retention

## 2. 存储与迁移

- [x] 2.1 扩展 `audit_logs`：`seq/prevHash/hash/hashAlgo/payload/actorType/appInstallationId/ip/userAgent/correlationId/source/retentionUntil/legalHold/archivedAt`
- [x] 2.2 旧行标记 `seq=null/hash='legacy'`，不回写
- [x] 2.3 唯一索引 `(organizationId, seq)`（seq 非空）
- [x] 2.4 新增 `audit_checkpoints` / `audit_archives`
- [x] 2.5a RLS/索引登记
- [x] 2.5b `tests/audit.e2e.js` 随机组织头 403

## 3. 链写入

- [x] 3.1 `AuditChainService`：canonical payload、hash、prevHash、seq 分配
- [x] 3.2a `AuditLogsService.create()` 统一走链写入
- [x] 3.2b `check-audit-writes.mjs` + docs/audit.md
- [x] 3.3a `record(input, manager?)` 支持业务事务内写入
- [x] 3.3b `AuditLogsService.recordFailure` 独立事务；单测
- [x] 3.4 每组织 advisory lock 串行化
- [x] 3.5 固定向量测试：hash/prevHash/seq 稳定
- [x] 3.6 e2e 并发 20 条：seq 唯一且连续

## 4. 追加式与权限

- [x] 4.1 数据库触发器拒绝 UPDATE/DELETE（break-glass 例外）
- [x] 4.2 cleanup/restore/legalHold 写 audit.break_glass；告警含 break-glass
- [x] 4.3 check-audit-writes 纳入 check:all
- [x] 4.4 e2e：普通 UPDATE/DELETE 被触发器拒绝；cleanup 留痕

## 5. 事件目录与覆盖

- [x] 5.1 catalog + requiredFields/retentionClass
- [x] 5.2 登录/失败/SSO/登出(session revoke)/强制下线/服务令牌已接
- [x] 5.3 role/permission/role_binding/menu 已审计
- [x] 5.4 release/review/announcement/data.*/settings 已审计
- [x] 5.5 ai.generate / ai.model.call / ai.content.review 目录 + 生成/模型调用接入
- [x] 5.6 integration.sync（job callback）/connector.changed 目录
- [x] 5.7 未知 action → source=custom + auditUnknownAction；单测

## 6. 检查点与验证

- [x] 6.1 `audit_checkpoints` 生成（手动）
- [x] 6.1b `audit.checkpoint_scan` 每日 02:00
- [x] 6.2 checkpoint HMAC-SHA256 签名
- [x] 6.3 `AuditVerificationService.verify`：从 genesis 重算（checkpoint 锚点后续接入）
- [x] 6.4 验证 API（`GET /audit-logs/verify`）
- [x] 6.5 `audit.verify_scan` 每日 02:30；失败写 audit.verify + 告警
- [x] 6.6a 单测：正常链、断链/hash 篡改、seq 缺口
- [x] 6.6b checkpoint 签名篡改 + 锚点后校验单测

## 7. 保留/归档/法律保留

- [x] 7.1 short/standard/long/legal → retentionUntil
- [x] 7.2 归档：JSONL + manifest → 对象存储（checkpoint 关联后续补）
- [x] 7.3 `restore` 回灌 JSONL + audit.restore；可再 verify
- [x] 7.4 清理：break-glass 事务，跳过 legalHold/未归档；分批 job 后续补
- [x] 7.5a 单测：归档/清理/未配置存储
- [x] 7.5b legal hold/restore 单测 + cleanup 跳过 legalHold

## 8. 查询/导出/告警

- [x] 8.1 查询筛选全字段 + status
- [x] 8.2 同步 CSV/JSON + 异步 `audit.export` job 生成 xlsx/pdf
- [x] 8.3 audit.query / audit.export 记录 actor/filter/rows
- [x] 8.4 查询/导出 password/token/secret 等 → [REDACTED]
- [x] 8.5 `AuditAlertService` 五类告警 + API
- [x] 8.6 audit service/alert 单测 + audit e2e

## 9. 管理端与兼容

- [x] 9.1 Console 查询/验证/checkpoint/告警按钮
- [x] 9.2 归档列表/恢复 + legal-hold API（retentionClass 自动）
- [x] 9.3 旧查询/导出路径保留；StreamableFile 修复
- [x] 9.4 docs/audit.md + auditLogsApi 扩展
- [x] 9.5 `openspec validate add-audit-compliance-and-tamper-evidence --strict`
- [x] 9.6 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
