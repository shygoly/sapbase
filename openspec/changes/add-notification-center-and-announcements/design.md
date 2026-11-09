# Design: 通知中心与公告

## Context

已核对的现状：

- `apps/api/src/notifications/notification.entity.ts`：
  - `type`（info/success/warning/error）、`title`、`body`、`read`、`sourceEventId`、`metadata`；
  - 唯一 `(sourceEventId, userId)`；索引 `(userId, read, createdAt)`、`(organizationId, createdAt)`。
- `notification-subscriber.ts` / `inbox.service.ts`：审批事件 → 通知 / 待办；
  `inbox` 只查 `blueprint_approvals`。
- `websocket.gateway.ts`：JWT 连接、加入 org/user room、推送未读通知。
- `notification-outbox` spec：持久通知、至少一次投递、审批待办。
- 没有分类、偏好、公告、已读统计、撤回、批量、保留期。

## Goals / Non-Goals

**Goals**

1. 统一通知模型：分类、优先级、动作链接、过期、已读时间。
2. 用户可控制接收类型/免打扰；强制通知可配置绕过偏好。
3. 公告：草稿/定时/发布/撤回、富文本、附件、定向、已读统计、复用。
4. 大批量公告通过异步任务扇出，幂等、可取消、可重试。
5. 保留期与清理；旧通知/审批待办兼容。

**Non-Goals**

- 不做营销自动化、A/B 测试、用户分群平台。
- 不实现短信/邮件网关；通过渠道适配器接入现有/外部服务。
- 不做完整移动推送（APNs/FCM）v1；预留渠道接口。
- 不把通知做成业务事实来源；业务状态仍以源表为准。

## Decisions

### D1：扩展通知模型

`notifications` 增加：

- `category`：`system` / `approval` / `review` / `task` / `course` / `assessment` / `announcement` / `alert`
- `priority`：`low` / `normal` / `high` / `urgent`
- `actionUrl`：前端跳转（可空）
- `expiresAt`：过期时间（可空）
- `readAt`：已读时间（保留 `read` 布尔兼容）
- `metadata`：业务引用、来源类型/ID

保留 `type/title/body/read/sourceEventId`；旧数据回填 `category='system'`、`priority='normal'`。
唯一 `(sourceEventId, userId)` 继续保证事件幂等。

### D2：用户偏好与免打扰

`notification_preferences`：

- `organizationId`、`userId`、`category`、`channel`（`in_app` / `email` / `webhook` / `push`）
- `enabled`、`muteUntil`、`updatedAt`
- 唯一 `(organizationId, userId, category, channel)`

规则：

- 默认全部 `in_app` 开启；用户可关闭非强制类别。
- `priority='urgent'` 或标记 `mandatory` 的通知可按策略绕过偏好；策略由组织配置。
- 免打扰只影响推送，不影响站内持久化；用户仍可在消息中心看到。
- 偏好变更写审计（可选）。

### D3：公告模型

`announcements`：

- `organizationId`、`title`、`body`（富文本/JSON）、`format`（`rich_text` / `markdown` / `plain`）
- `status`：`draft` / `scheduled` / `published` / `recalled` / `expired`
- `publishAt`、`expiresAt`、`createdBy`、`updatedBy`
- `attachments`（assetId 列表）
- `audience`（摘要 JSONB）与 `audienceVersion`
- `readCount` / `deliveryCount`（可异步更新）
- `recalledAt`、`recallReason`

`announcement_audiences`：

- `announcementId`、`audienceType`（`all` / `role` / `user` / `scope_node` / `scope_subtree`）
- `refId`（roleId/userId/nodeId）
- 多个 audience 取并集；`all` 与其它组合按并集。

`announcement_deliveries`：

- `announcementId`、`userId`、`notificationId`、`status`（`pending` / `delivered` / `failed` / `recalled`）
- `deliveredAt`、`readAt`
- 唯一 `(announcementId, userId)`

`announcement_reads` 可由 deliveries 的 `readAt` 表达，不另建表（读模型）。

### D4：投递与扇出

- 单条通知：生产方调用 `NotificationCenter.publish()`，写 `notifications` + WebSocket 推送；
  事件幂等键 `sourceEventId`。
- 公告：发布时创建 `announcement_deliveries`（解析 audience）→ 通过 `async-job` 分批扇出；
  每批写 notifications / 更新 delivery；支持取消/重试。
- 大组织（>N 人）禁止同步扇出；必须异步。
- 撤回：公告状态 `recalled`；未读通知删除或标记撤回；已读保留但显示“已撤回”。
- 定时发布：`publishAt` 到点由 cron/job 触发发布；过期由清理 job 处理。

### D5：消息中心 API

```text
GET /notifications?category=&read=&from=&to=&page=
GET /notifications/unread-count
POST /notifications/:id/read
POST /notifications/read-all
POST /notifications/batch { ids, action: read|delete }
GET/PUT /notification-preferences
```

- 通知只返回当前用户；管理员公告统计另走公告 API。
- 未读计数可按分类返回，供角标。
- 批量操作幂等；删除为软删除/标记，保留审计。

### D6：公告 API

```text
POST /announcements                 # draft
PUT /announcements/:id
POST /announcements/:id/publish     # 立即或定时
POST /announcements/:id/recall
GET /announcements/:id/stats        # delivered/read/failed
GET /announcements?status=&from=&to=
POST /announcements/:id/duplicate   # 复用
```

- 发布权限：`announcements:publish`；范围权限按 audience。
- 公告正文/附件走资产/富文本安全过滤（XSS）。
- 撤回/过期后可查看统计，但不再新增投递。

### D7：保留期与清理

- 通知默认保留 30 天（可配置）；公告按组织策略（默认 180 天/永久可配）。
- 清理 job 分批删除过期通知/投递；保留聚合统计。
- 被审计/合规引用的公告不物理删除；软删除 + 保留期。
- 清理写审计（系统动作）。

### D8：安全与隔离

- 所有通知/公告/偏好带 `organizationId`，纳入 RLS。
- 用户只能读自己的通知/偏好；公告管理需权限。
- Audience 解析必须走数据范围：`scope_node`/`scope_subtree` 只解析当前组织节点；
  跨租户节点拒绝。
- 富文本 XSS 过滤；附件签名 URL；外链白名单。
- 公告发布/撤回/偏好变更写审计。

### D9：兼容与迁移

- 旧 `notifications` 行补 `category='system'`、`priority='normal'`；`readAt` 由 `read` 推导。
- 旧 `GET /notifications` 行为保持；新增筛选为可选参数。
- 旧审批待办保留；通知中心可展示审批/复核工作项链接。
- 回滚：停用公告/偏好；旧通知表和接口继续工作。

## Data Model

```sql
-- 扩展 notifications
ALTER TABLE notifications
  ADD COLUMN category varchar(32) NOT NULL DEFAULT 'system',
  ADD COLUMN priority varchar(16) NOT NULL DEFAULT 'normal',
  ADD COLUMN "actionUrl" varchar(1024),
  ADD COLUMN "expiresAt" timestamptz,
  ADD COLUMN "readAt" timestamptz,
  ADD COLUMN mandatory boolean NOT NULL DEFAULT false;

notification_preferences (
  id uuid pk,
  "organizationId" uuid not null,
  "userId" uuid not null,
  category varchar(32) not null,
  channel varchar(16) not null,
  enabled boolean not null default true,
  "muteUntil" timestamptz,
  "updatedAt" timestamptz not null default now(),
  unique ("organizationId", "userId", category, channel)
)

announcements (
  id uuid pk,
  "organizationId" uuid not null,
  title varchar(512) not null,
  body text not null,
  format varchar(16) not null default 'rich_text',
  status varchar(32) not null default 'draft',
  "publishAt" timestamptz,
  "expiresAt" timestamptz,
  attachments jsonb not null default '[]',
  audience jsonb not null default '{}',
  "readCount" int not null default 0,
  "deliveryCount" int not null default 0,
  "createdBy" uuid not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "recalledAt" timestamptz,
  "recallReason" text
)

announcement_audiences (
  id uuid pk,
  "organizationId" uuid not null,
  "announcementId" uuid not null,
  "audienceType" varchar(32) not null,
  "refId" varchar(128),
  unique ("announcementId", "audienceType", "refId")
)

announcement_deliveries (
  id uuid pk,
  "organizationId" uuid not null,
  "announcementId" uuid not null,
  "userId" uuid not null,
  "notificationId" uuid,
  status varchar(32) not null default 'pending',
  "deliveredAt" timestamptz,
  "readAt" timestamptz,
  unique ("announcementId", "userId")
)
```

新表纳入 RLS；`announcement_deliveries` 按组织/用户索引。

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| 大范围公告扇出 | 异步 job 分批；阈值；可取消/重试；进度可查 |
| 重复通知 | `sourceEventId` 唯一；公告 delivery 唯一 |
| 偏好与强制通知冲突 | 显式 `mandatory` + 组织策略；审计 |
| 撤回语义 | 未读删除/已读标记；统计保留；文档写清 |
| XSS/附件 | 富文本过滤、外链白名单、签名 URL |
| 保留期误删 | 软删除 + 审计/合规保留；清理 job 分批 |
| 旧接口兼容 | 新字段默认值；旧字段保留；可选参数 |

## Migration Plan

1. 扩展 notifications；回填 category/priority/readAt。
2. 新增 preference/announcement/audience/delivery 表 + RLS。
3. 旧接口回归；新消息中心逐步接入。
4. 公告先小范围试点，再开放全员。
5. 回滚：停用公告/偏好；旧通知继续工作。

## Open Questions

- 邮件/短信/移动推送是否 v1 接入？建议接口预留，按客户环境决定。
- 公告富文本用现有编辑器还是 Markdown？v1 支持 rich_text + markdown。
- 已读统计是否需要逐用户明细导出？v1 提供聚合 + 分页明细。
- 强制通知策略由平台还是组织配置？建议组织级，平台给默认值。
