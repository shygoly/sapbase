## 1. 契约与元语

- [ ] 1.1 定义 `review-step`、`assignee-selector`、`check-result`、`work-item` 的持久化形状与 JSON Schema
- [ ] 1.2 在 `docs/META_LANGUAGE.md` 登记复核/审批/工作项术语与不变量（INV-RV-01..05）
- [ ] 1.3 在 `DOMAIN.md` 新增复核与工作项小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [ ] 1.4 在 `DECISIONS.md` 登记关键决策（扩展现有审批、work item 投影、机器检测 fail-closed）
- [ ] 1.5 更新 `docs/protocols/blueprint-delivery.md` 的审批/复核小节

## 2. 存储与迁移

- [ ] 2.1 扩展 `blueprint_approvals`：`round/kind/selector/assignee/checkProvider/checkResult/comment/decidedBy/dueAt`
- [ ] 2.2 唯一约束改为 `(recordId, ruleId, round, stepIndex)`；旧行回填 `round=1, kind='human'`
- [ ] 2.3 新增 `review_comments` / `review_events` / `review_delegations` / `work_items`
- [ ] 2.4 索引与 RLS；新表加入 `TENANT_RLS_DDL`
- [ ] 2.5 TypeORM 实体与模块注册

## 3. 审批人解析

- [ ] 3.1 `AssigneeSelector` 解析：role / user / position / creator
- [ ] 3.2 `position + anchor=record`：按记录 `dataScope` 绑定找节点，再查 `scope_memberships`
- [ ] 3.3 解析失败阻塞并告警，不自动跳过
- [ ] 3.4 审批人变更/离职时重新解析未决步骤
- [ ] 3.5 单测：角色/用户/岗位、跨组织隔离、空节点、无成员

## 4. 机器检测

- [ ] 4.1 `CheckProvider` 接口 + registry
- [ ] 4.2 `check` 步骤通过 `add-async-job-and-callback-facade` 执行
- [ ] 4.3 `pass/fail/warn` 状态机；warn 必须人工确认；provider 异常 fail-closed
- [ ] 4.4 检测证据（provider/version/input/output）写入步骤与审计
- [ ] 4.5 单测：pass、fail、warn、超时、provider 异常

## 5. 人工动作与轮次

- [ ] 5.1 `approve` / `reject` / `request-changes` / `resubmit`
- [ ] 5.2 只有当前步骤合法审批人可操作；越权 403
- [ ] 5.3 `resubmit` 创建新 round，旧 round 只读
- [ ] 5.4 评论/附件（走 `asset-pipeline`）
- [ ] 5.5 委托：`review_delegations` + 代决定审计
- [ ] 5.6 发布/状态迁移在整体 approved 前拒绝
- [ ] 5.7 e2e：提交→机器检测→人工驳回→修改→重提→通过

## 6. 通用工作项

- [ ] 6.1 `work_items` 投影：审批/复核/教学任务/申诉等 sourceType
- [ ] 6.2 事件驱动更新（outbox/事务内）；源表仍为真源
- [ ] 6.3 `inbox` 双读兼容：work_items + 旧 approvals
- [ ] 6.4 批量处理/已读/红点/优先级排序
- [ ] 6.5 重建/对账 job；单测投影一致性

## 7. SLA、提醒与升级

- [ ] 7.1 步骤 `slaHours/dueAt` 配置
- [ ] 7.2 到期前/到期提醒（幂等键 + 时间窗）
- [ ] 7.3 升级策略：上一级角色/岗位；管理员兜底
- [ ] 7.4 通知接 `notification-center-and-announcements`
- [ ] 7.5 单测：只提醒一次、升级路径、无审批人告警

## 8. 管理端与 API

- [ ] 8.1 审批/复核配置页（步骤、selector、SLA、机器检测）
- [ ] 8.2 待办中心：分类、筛选、批量、红点
- [ ] 8.3 详情页：轮次、步骤、评论、附件、检测证据
- [ ] 8.4 API 文档与 `api-client`
- [ ] 8.5 权限点：`review:read` / `review:act` / `review:configure` / `review:delegate`

## 9. 兼容与验收

- [ ] 9.1 旧 `POST /approvals/:ruleId/approve` 仍可用
- [ ] 9.2 旧 `blueprint_approvals` 数据可读、可继续审批
- [ ] 9.3 旧 inbox 行为不变
- [ ] 9.4 负例：越权审批、跳过机器检测、warn 当 pass、驳回后直接发布
- [ ] 9.5 `openspec validate add-review-and-approval-platform --strict`
- [ ] 9.6 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
