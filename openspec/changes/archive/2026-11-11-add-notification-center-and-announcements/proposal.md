# Change: 通知中心与公告

## Why

现有通知只够“发一条消息”：

- `notifications` 只有 `type/title/body/read/sourceEventId/metadata`；
- 没有分类、优先级、用户偏好、免打扰、批量已读、角标、保留期；
- 没有公告（定向到班级/课程/角色/全员）、富文本、定时发布、已读统计、撤回；
- 教师/学生消息中心无法按类型筛选、批量处理、控制推送开关。

教育项目的 A-021、A-024、B-022 要求公告、消息中心、分类、已读/未读、推送开关、角标、
30 天留存；这些是跨行业通用能力。

## What Changes

- **ADDED** `notification-center`：分类、优先级、动作链接、未读计数、批量已读/删除、
  用户偏好/免打扰、保留期。
- **ADDED** `announcements`：公告草稿/定时/发布/撤回、富文本、附件、
  定向范围（全员/角色/用户/组织节点/班级/课程）、已读统计、复用。
- **ADDED** 公告投递：通过 `async-job` 分批扇出；每人一条通知或投递记录；
  支持撤回（未读消失/已读标记撤回）。
- **ADDED** 渠道抽象：`in_app` 为 v1 必选；`email`/`webhook`/移动推送作为可选适配器，
  避免把渠道写死。
- **MODIFIED** 现有通知：保留 `type/title/body/read/sourceEventId` 兼容；
  增加 `category/priority/actionUrl/expiresAt/readAt`。
- **MODIFIED** 审批/复核/任务/预警等生产方统一走通知中心接口，不直接插表。
- **NOT CHANGED** 现有 WebSocket 推送、审批待办、outbox 事件投递。
- **NON-GOALS** 营销自动化、短信/邮件网关实现、完整推送平台、A/B 测试。
- **BREAKING** 无。旧通知接口与字段继续可用。

## Impact

- 受影响规格：`notification-center`（新增）、`notification-outbox`（扩展待办/通知）
- 受影响代码：
  - `apps/api/src/notifications/**`
  - `apps/api/src/websocket/**`（实时推送）
  - 新模块 `apps/api/src/announcements/**` 或并入 notifications
  - `apps/web-portal` / `web-console` 消息中心、公告管理
  - `DOMAIN.md`、`DECISIONS.md`
- 依赖：`add-async-job-and-callback-facade`（公告扇出/大批量）、
  `add-generic-data-scope-authorization`（按班级/课程定向）、
  `add-review-and-approval-platform`（工作项通知）、`add-asset-and-media-pipeline`（附件）。
- 迁移：新增表/列；旧通知回填 `category='system'`；旧接口保留。
- 风险：大范围公告扇出、重复通知、偏好与强制通知冲突、撤回语义、保留期清理。
