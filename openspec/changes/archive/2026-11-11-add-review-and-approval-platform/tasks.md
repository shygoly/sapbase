## 1. 契约与元语

- [x] 1.1 `schemas/review-approval.schema.json`（review-step/selector/check-result/work-item）
- [x] 1.2 META §3.16 + 不变量 39–43
- [x] 1.3 在 `DOMAIN.md` 新增复核与工作项小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [x] 1.4 DECISIONS D-15
- [x] 1.5 blueprint-delivery §10.3 复核/审批扩展

## 2. 存储与迁移

- [x] 2.1 扩展 `blueprint_approvals`：`round/kind/selector/assignee/checkProvider/checkResult/comment/decidedBy/dueAt`
- [x] 2.2 唯一约束改为 `(recordId, ruleId, round, stepIndex)`；旧行回填 `round=1, kind='human'`
- [x] 2.3 新增 `review_comments` / `review_events` / `review_delegations` / `work_items`
- [x] 2.4a 索引与 RLS；新表加入 `TENANT_RLS_DDL`
- [x] 2.4b `tests/review-approval.e2e.js` 跨租户 403
- [x] 2.5 TypeORM 实体与 app.entities 注册

## 3. 审批人解析

- [x] 3.1 `AssigneeSelector` 解析：role / user / position / creator
- [x] 3.2 `ReviewAssigneeService` 按 `scope_bindings` 字段取节点，再查节点岗位成员（含有效期过滤）
- [x] 3.3a 解析为空返回空集合，调用方阻塞
- [x] 3.3b 解析为空 → 日志 + 管理员通知（不自动跳过）
- [x] 3.4 `review.reconcile` 任务重新解析未决 selector 并重投影待办
- [x] 3.5a 单测：角色/用户/岗位/creator、去重
- [x] 3.5b 单测空绑定/空节点/无成员 + e2e 跨租户

## 4. 机器检测

- [x] 4.1 `CheckProvider` 接口 + registry
- [x] 4.2a `review.check` JobTypeDefinition（走 async-job 队列/重试/事件）
- [x] 4.2b 注册到 app JobsModule + 结果回写审批步骤
- [x] 4.3 pass/fail/warn 状态；warn 保留人工确认；provider 异常/超时 fail-closed
- [x] 4.4 检测证据（provider/version/input/output）写入步骤与审计
- [x] 4.5 单测：pass、fail、warn、超时、provider 异常

## 5. 人工动作与轮次

- [x] 5.1a `approve` / `reject` / `request-changes`
- [x] 5.1b `resubmit` 新 round（旧 round 只读）
- [x] 5.2 只有当前步骤合法审批人可操作；越权 403（role/assignee/selector）
- [x] 5.3 `resubmit` 创建新 round，旧 round 只读
- [x] 5.4a 评论写入 review_comments
- [x] 5.4b 评论附件校验 `assets.status=ready` 且同组织；记录资产快照
- [x] 5.5 委托/撤销 + `delegatedFrom` 审计（e2e）
- [x] 5.6 发布/状态迁移在整体 approved 前拒绝（最新 round 判定）
- [x] 5.7 `tests/review-workflow.e2e.js`：pass→驳回→round2→再检测→通过

## 6. 通用工作项

- [x] 6.1 `work_items` 投影：通用 sourceType + 幂等 upsert
- [x] 6.2 `ReviewWorkItemSubscriber` 订阅 outbox approval.pending/decided，按源表对账
- [x] 6.3 `GET /inbox` 保持旧行为；`GET /inbox/work-items` 返回新待办
- [x] 6.4 read/read-all/unread-count + priority/dueAt 排序
- [x] 6.5a 单测：投影幂等/关闭
- [x] 6.5b `review.reconcile` 任务 + `POST /review/reconcile`

## 7. SLA、提醒与升级

- [x] 7.1 编译校验 slaHours 1–720；建链计算 dueAt
- [x] 7.2 cron `review.sla_scan` 每 10 分钟；到期前 24h 提醒，`reminderSentAt` 幂等
- [x] 7.3 超时通知 + urgent 待办；`REVIEW_ESCALATION_ROLE`（默认 Admin）兜底，不自动通过
- [x] 7.4 走 `NotificationService` 统一通知中心
- [x] 7.5 `review-sla.service.spec.ts` 4 tests

## 8. 管理端与 API

- [x] 8.1 `/admin/review` 运行配置与待处理步骤
- [x] 8.2 `/dashboard/work-items` 分类/筛选/批量已读/未读红点
- [x] 8.3 `/dashboard/work-items/[id]` 轮次/步骤/评论/附件/证据/事件
- [x] 8.4 `docs/review-approval.md` + `reviewApi`
- [x] 8.5 权限点已加入 seed/catalog 并由 @Auth 引用

## 9. 兼容与验收

- [x] 9.1 `decision-runtime.e2e-spec.ts` 旧 approve 通过
- [x] 9.2 旧行 round/kind 回填；e2e 旧链可继续审批
- [x] 9.3 `notifications-inbox.e2e-spec.ts` 覆盖旧 inbox
- [x] 9.4 e2e/单测：越权 403；未完成检测 409；warn 无理由 409；驳回后发布由审批链阻断
- [x] 9.5 `openspec validate add-review-and-approval-platform --strict`
- [x] 9.6 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
