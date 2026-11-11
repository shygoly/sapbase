# Review & Approval（复核/审批）

复核是**审批步骤链**，复用 `blueprint_approvals`，不另建 workflow 引擎。
`work_items` 只是待办投影，业务表仍是唯一真源。

## 步骤

`blueprint_approvals` 一行 = 链上一步，唯一键 `(recordId, ruleId, round, stepIndex)`。

| 字段 | 说明 |
|---|---|
| `round` | 轮次；resubmit 追加新轮，旧轮只读 |
| `kind` | `human` / `check` |
| `role` | 旧角色步骤（兼容） |
| `selector` | `role` / `user` / `position` / `creator` |
| `assignee` | 解析后的审批人（`{ userId, userIds }`） |
| `checkProvider` / `checkResult` | 机器检测 provider 与 `pass/warn/fail` 证据 |
| `dueAt` / `reminderSentAt` / `escalatedAt` | SLA 与幂等提醒/升级 |
| `comment` / `decidedBy` / `decidedAt` | 决策与审计 |

编译期校验 `steps[].slaHours` 为 1–720 的整数；建链时计算 `dueAt`。

## 审批人解析

- `role`：`organization_member_roles` 中 active 角色成员。
- `user`：指定用户。
- `creator`：记录创建人。
- `position`：`scope_memberships` 中该岗位成员；`anchor=record` 时先从
  `scope_bindings` 字段绑定取记录上的 scope 节点，再查该节点的岗位成员。

解析为空 → 阻塞 + 告警管理员，**禁止自动跳过**。

## 人工决策

`POST /api/review/approvals/:id/act` `{ action: approve|reject|request-changes, comment? }`

- 只有当前 pending 步骤的合法审批人可操作，否则 403。
- `reject` / `request-changes` 阻断整体；`resubmit` 创建 round+1。
- 委托：`POST /approvals/:id/delegate`，受委托人在有效期内可代决定，
  事件 payload 记录 `delegatedFrom`。
- 机器检测 `warn` 必须人工填写确认理由；未确认 409，不能当 `pass`。

## 机器检测

- 任务类型 `review.check`，provider 通过 `ReviewCheckRegistry` 注册。
- 内置 `basic`：文本含手机号/身份证/邮箱 → `warn`，否则 `pass`。
- provider 异常、未知、超时 → `fail`（fail-closed）。
- `check` 步骤只能由检测结果推进；人工只能在 `warn` 时确认。

## 待办投影

- `work_items`：`sourceType + sourceId` 引用源对象，按 `(org, source, id)` 幂等。
- 事件驱动：`blueprint.record.approval.pending/decided` outbox 事件触发
  `ReviewWorkItemSubscriber` 对账，关闭已完成步骤。
- `inbox` 双读：`GET /api/inbox` 保持旧 approvals 行为；
  `GET /api/inbox/work-items` 返回新待办。
- 已读/红点：`POST /review/work-items/:id/read`、`/read-all`、
  `GET /review/work-items/unread-count`。
- 对账 job：`review.reconcile` / `POST /review/reconcile`，重新解析未决审批人并重建待办。

## SLA 与升级

- cron `review.sla_scan` 每 10 分钟扫描。
- 到期前 24h 提醒一次（`reminderSentAt` 幂等）。
- 超时通知 + 生成 urgent 待办（`escalatedAt` 幂等）；不自动通过。
- 无审批人时告警管理员。

## 附件

评论附件必须引用已就绪的 `assets` 资产（asset-pipeline），
记录 `assetId/name/mimeType/size` 快照；未就绪或跨租户资产拒绝。

## 权限

| 权限 | 用途 |
|---|---|
| `review:read` | 待办/审批/评论/事件/概览 |
| `review:act` | 批准/驳回/要求修改/重提/评论 |
| `review:configure` | 对账/配置运行 |
| `review:delegate` | 委托/撤销委托 |

## 兼容

- 旧 `POST /blueprints/:id/records/:entity/:recordId/approvals/:ruleId/approve` 不变。
- 旧 `role` 步骤等价于 `human + role` selector。
- 旧行回填 `round=1, kind='human'`，新列可空。
- 旧 inbox 行为不变。
