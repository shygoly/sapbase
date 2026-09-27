# 通知与待办协议

> 状态：`consolidate-platform-foundations` N1 / N2
> 相关：投递见 [`outbox.md`](./outbox.md)；审批链见 `blueprint_approvals`

本文件钉**持久化通知**与**审批待办**的身份来源、两层去重、投递时机与边界。
WebSocket 只是在线推送；表才是真相。

---

## 1. 身份来源（角色 → 用户）

现有模型里**没有** `user_roles` 关联表。权威分配是：

| 来源 | 是什么 | 是否用于审批通知 / 待办 |
| --- | --- | --- |
| `users.role` | 用户的角色字符串；登录写入 JWT `role` | **是**（与 `blueprint_approvals.role` 字符串相等） |
| `organization_members` | 用户是否属于该组织 | **是**（租户范围） |
| `roles` | 组织内角色目录（权限集合） | 否（不是分配） |
| `organization_members.role` | `owner` / `member` | 否（成员身份，不是审批角色） |
| 请求体 `role` | `approve` 的既有入参 | **否**（通知/待办绝不采信调用方自报角色） |

解析「这个审批步通知谁」：

```
users.role = :stepRole
AND organization_members.organizationId = :org
```

组织内无人持有该角色 ⇒ 不写通知（fail-closed）。
调用者 JWT 缺 `role` 或 `organizationId` ⇒ `GET /inbox` 返回 `[]`（fail-closed，不许「看不到就全给」）。

---

## 2. 通知表与 HTTP

`notifications`：`id / userId / organizationId / type / title / body / read / createdAt / updatedAt / sourceEventId / metadata`。

| 端点 | 语义 |
| --- | --- |
| `GET /notifications` | 当前用户 + 当前租户；默认未读；`?all=true` 含已读 |
| `POST /notifications/:id/read` | 已读持久；别人的 id / 别的租户 → **404** |

重启不丢：未读在表里。新的 service / app 实例读同一张表仍能列出。
缺 `organizationId` 的 `sendToUser` **不写表**（仍可 WS 推），订阅者路径总带租户。

WS：`sendToUser` / `sendPendingNotifications` / `markAsRead` 签名保持可用；在线则 `emit('notification')`。`sendPendingNotifications` 读未读并推送，**不**标已读。

---

## 3. 生产者：只在投递时写

业务事务（`transition` / `approve` / `importMaster`）只 `OutboxService.publish`。
通知由 `NotificationSubscriber` 在 **drain 调用订阅者时** 产生。

判据：业务提交后、`drain` 之前，`notifications` 没有该行；`drain` 之后才有。

| topic | 通知给谁 | 内容 |
| --- | --- | --- |
| `blueprint.record.approval.pending` | 该步 `role` 对应的组织成员（§1） | 「有一张单等你批」（entity / recordId / ruleId / stepIndex） |
| `blueprint.record.transitioned` | 该组织全部 `organization_members`（组织内可见） | 状态从 X → Y |
| `blueprint.import.completed` | payload.`actor`（触发导入的用户 id） | imported / failed；`failed>0` 时 `type=error` |

`actor` 必须是用户 UUID；`semantic-runtime` 等非用户值不写通知。
导入事件 payload 含 `actor`（`actorId(user)`，缺省 `semantic-runtime`）——这是 N0 payload 的**加字段**，既有 `toMatchObject` 不断。

投递器传给订阅者的对象在 `{topic, payload}` 之外带 `eventId` / `organizationId`（来自 `outbox_events` 行）。缺二者则订阅者跳过。

---

## 4. 两层去重

| 层 | 键 | 防什么 |
| --- | --- | --- |
| outbox 投递 | `outbox_deliveries UNIQUE(eventId, subscriber)` | 同一事件对同一订阅者重投 |
| 通知行 | `notifications UNIQUE(sourceEventId, userId)` | 同一事件对同一用户写成两条 |

`sendToUser(..., sourceEventId)` 写表时撞唯一约束 ⇒ 不插入、不重复推 WS。
`sourceEventId` 为空时 UNIQUE 不挡（PostgreSQL NULL 互不相等）——只给非事件路径用。

---

## 5. 待办（`GET /inbox`）

返回：

```
[{ approvalId, blueprintId, entity, recordId, ruleId, stepIndex, role, since }]
```

`since` = 该审批行的 `createdAt`。排序：`since` 升序，再 `id`。
范围：当前租户、`status='pending'`、`role = 调用者 JWT.role`。跨单据类型、跨蓝图，不要求调用方先知道是哪张单。

**不是另存一份待办。** 读的就是 `blueprint_approvals` 同一行的 `status`。
`approve` 在同一事务里把该步改成 `approved` / `rejected` ⇒ 提交后 `GET /inbox` 自然不再包含该项。
失败（角色不符 / 已全批）回滚 ⇒ 行仍是 `pending` ⇒ 待办条数不变。

越权：其它租户即使用同一角色字符串，也因 `organizationId` 过滤而得到空列表。

---

## 6. 边界

- 前端本轮不动；WS 客户端继续收 `notification` 事件（`message` 对应表的 `body`）。
- 不在 `transition` / `approve` 里直接写 `notifications`。
- 不做出站 webhook（Outbox 只留投递点）。
- `roles` 目录与用户没有关联时，不能靠目录「猜」通知对象。
