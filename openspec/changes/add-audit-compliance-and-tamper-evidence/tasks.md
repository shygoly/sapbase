## 1. 契约与元语

- [ ] 1.1 定义审计事件目录、链字段、checkpoint/archive 的持久化形状与 Schema
- [ ] 1.2 在 `docs/META_LANGUAGE.md` 登记审计链/检查点/保留期术语与不变量（INV-AU-01..06）
- [ ] 1.3 在 `DOMAIN.md` 新增审计小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [ ] 1.4 在 `DECISIONS.md` 登记哈希链、append-only、legacy 段、break-glass
- [ ] 1.5 更新 `FLOWS.md`（验证/归档/清理 job）

## 2. 存储与迁移

- [ ] 2.1 扩展 `audit_logs`：`seq/prevHash/hash/hashAlgo/payload/actorType/appInstallationId/ip/userAgent/correlationId/source/retentionUntil/legalHold/archivedAt`
- [ ] 2.2 旧行标记 `seq=null/hash='legacy'`，不回写
- [ ] 2.3 唯一索引 `(organizationId, seq)`（seq 非空）
- [ ] 2.4 新增 `audit_checkpoints` / `audit_archives`
- [ ] 2.5 RLS/索引；跨租户负例

## 3. 链写入

- [ ] 3.1 `AuditChainService`：canonical payload、hash、prevHash、seq 分配
- [ ] 3.2 单一 `AuditService.record()`；禁止模块直写表
- [ ] 3.3 业务事务内写入；失败审计单独事务策略
- [ ] 3.4 每组织串行化/行锁/重试
- [ ] 3.5 固定向量测试：hash/prevHash/seq 稳定
- [ ] 3.6 并发写入测试：seq 不重复、链不断

## 4. 追加式与权限

- [ ] 4.1 数据库触发器/权限拒绝 UPDATE/DELETE（break-glass 例外）
- [ ] 4.2 break-glass 审计 + 告警
- [ ] 4.3 代码检查/评审清单：禁止直接写 `audit_logs`
- [ ] 4.4 负例：更新/删除被拒；break-glass 留痕

## 5. 事件目录与覆盖

- [ ] 5.1 `AuditEventCatalog`：action/resource/requiredFields/retentionClass
- [ ] 5.2 认证：登录/失败/登出/SSO/强制下线/服务令牌
- [ ] 5.3 权限：角色/绑定/权限点/菜单
- [ ] 5.4 业务：发布/复核/驳回/撤回/导入/导出/配置
- [ ] 5.5 AI：生成任务/模型调用/内容审核/AI 评分
- [ ] 5.6 集成：同步/回调/连接器变更
- [ ] 5.7 未知事件拒绝或标 custom + 告警

## 6. 检查点与验证

- [ ] 6.1 `audit_checkpoints` 生成（定时/手动）
- [ ] 6.2 checkpoint 签名（HMAC/Ed25519）
- [ ] 6.3 `AuditVerificationService.verify`：从 checkpoint/genesis 重算
- [ ] 6.4 验证 API（管理员）
- [ ] 6.5 定时验证 job；失败告警
- [ ] 6.6 单测：正常链、断链、篡改、checkpoint 失效、legacy 段

## 7. 保留/归档/法律保留

- [ ] 7.1 `retentionClass` → `retentionUntil` 策略
- [ ] 7.2 归档：JSONL + manifest + checkpoint → 资产
- [ ] 7.3 恢复：回灌 + 再验证
- [ ] 7.4 清理 job：分批/幂等/审计；跳过 legal hold/未归档
- [ ] 7.5 单测：到期清理、法律保留、归档恢复

## 8. 查询/导出/告警

- [ ] 8.1 查询筛选：actor/action/resource/时间/source/actorType/correlationId
- [ ] 8.2 导出 CSV/JSON/XLSX/PDF（走批量导出）
- [ ] 8.3 访问审计：谁查询/导出、筛选、行数
- [ ] 8.4 敏感字段脱敏
- [ ] 8.5 异常告警：批量导出/权限变更/登录失败/break-glass/验证失败
- [ ] 8.6 单测：越权查询、导出审计、告警触发

## 9. 管理端与兼容

- [ ] 9.1 Console 审计查询/详情/验证页
- [ ] 9.2 归档/恢复/保留策略配置
- [ ] 9.3 旧查询/CSV/JSON 导出兼容
- [ ] 9.4 API 文档与 `api-client`
- [ ] 9.5 `openspec validate add-audit-compliance-and-tamper-evidence --strict`
- [ ] 9.6 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
