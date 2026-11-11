## 1. 契约与元语

- [x] 1.1 持久化形状与 JSON Schema（`schemas/notification-center.schema.json`）
- [x] 1.2 META_LANGUAGE §3.14 + 不变量 29–33（INV-NT-01..05）
- [x] 1.3 在 `DOMAIN.md` 新增通知/公告小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [x] 1.4 DECISIONS D-11（站内真相/偏好）/ D-12（幂等扇出/软删除）
- [x] 1.5 notification-outbox 增加 Notification Center Boundary

## 2. 存储与 RLS

- [x] 2.1 扩展 `notifications`：`category/priority/actionUrl/expiresAt/readAt/mandatory`
- [x] 2.2 回填旧数据：`category='system'`、`priority='normal'`、`readAt` 由 `read` 推导
- [x] 2.3 新增 `notification_preferences` / `announcements` / `announcement_audiences` / `announcement_deliveries`
- [x] 2.4a 索引与 RLS 登记
- [x] 2.4b e2e：随机组织头 403；跨租户 scope 节点 404
- [x] 2.5 TypeORM 实体与模块注册

## 3. 通知中心

- [x] 3.1 `NotificationService.publish()`：分类/优先级/动作链接/幂等（sourceEventId）
- [x] 3.2 列表/未读计数/按分类/优先级筛选
- [x] 3.3 单条/批量已读；批量幂等
- [x] 3.4a 过期通知过滤（列表默认排除）
- [x] 3.4b `notifications.cleanup_expired` 每日 03:15 软删除
- [x] 3.5a WebSocket 实时推送/未读补发（现有 connect 路径）
- [x] 3.5b e2e：WS 在线推送 + 断线重连 pending 补发
- [x] 3.6a 单测：未读计数/批量已读/偏好
- [x] 3.6b e2e：重复发布 delivery 不翻倍；跨租户拒绝

## 4. 用户偏好

- [x] 4.1 `notification_preferences` CRUD
- [x] 4.2 分类/渠道开关、免打扰、mandatory 绕过
- [x] 4.3 `sendToUsers` 按偏好跳过 WS，站内仍落库；mandatory 绕过
- [x] 4.4 偏好变更写 audit_logs（`notification.preference.update`）
- [x] 4.5 单测：关闭类别、免打扰、mandatory 绕过

## 5. 公告

- [x] 5.1a 公告 CRUD（草稿/编辑）
- [x] 5.1b `POST :id/copy` + `DELETE :id`（已发布先撤回）
- [x] 5.2 安全 Markdown 子集 + 协议白名单附件（`announcement-body.tsx`）
- [x] 5.3a Audience：all/role/user 并集
- [x] 5.3b scope 节点/子树成员解析（含角色成员、有效期）
- [x] 5.4a 立即发布 + 权限校验
- [x] 5.4b `publishAt` → scheduled；cron 每 5 分钟发布到期公告
- [x] 5.5a 撤回 + 统计保留
- [x] 5.5b 过期/超期未读通知与过期公告软删除
- [x] 5.6a 已读统计 delivered/read/failed
- [x] 5.6b `GET :id/deliveries?page=&pageSize=&status=` + 前端分页
- [x] 5.7 可选：以“复制为草稿”覆盖复用；未建独立模板表
- [x] 5.8a 单测：all/role/空 audience/撤回/统计
- [x] 5.8b e2e：跨租户 scope 节点 404

## 6. 扇出与投递

- [x] 6.1 发布时创建 deliveries（逐用户幂等）
- [x] 6.2 `notification.announcement_fanout`（阈值 200，进度/取消/重试）
- [x] 6.3a 逐用户写 notifications + WebSocket；sourceEventId 幂等
- [x] 6.3b 每批 100 人，bulk INSERT ... ON CONFLICT DO NOTHING
- [x] 6.4 阈值走 job、job concurrency=1、单组织 30 次/分钟限流
- [x] 6.5a 单测：重复发布不重复 delivery、空 audience
- [x] 6.5b job 重试 3 次；取消在批次边界停止，已投递保留

## 7. 保留期与清理

- [x] 7.1 通知默认 30 天（`NOTIFICATION_RETENTION_DAYS`）；公告 `retentionDays` 1–3650
- [x] 7.2 每批 500 行，最多 40 批；未删除公告的 delivery 统计保留
- [x] 7.3 通知/公告/投递只写 `deletedAt`
- [x] 7.4 `notification_cleanup_runs` 记保留天数与计数
- [x] 7.5 `notification-retention.service.spec.ts`（到期/分批/延长/失败）

## 8. 管理端与 API

- [x] 8.1 Portal 消息中心：分类/未读/批量/偏好/角标
- [x] 8.2 Portal 公告管理：草稿/发布/撤回/统计（定时发布仍待后端 cron）
- [x] 8.3 可选，N/A：模板复用走复制；强制策略固定为 `mandatory`，不开放租户改
- [x] 8.4 API 文档与 `api-client`
- [x] 8.5 权限点：`notifications:read` / `announcements:manage` / `announcements:publish`

## 9. 兼容与验收

- [x] 9.1 旧 `GET /notifications`、`read-all`、`:id/read` 不变；新字段有默认值
- [x] 9.2 事件名 `notification` 不变；修复 WS JwtModule 密钥（此前连接无法认证）
- [x] 9.3 `tests/notification-center.e2e.js`
- [x] 9.4 e2e 跨租户/越权/重复；单测 XSS
- [x] 9.5 validate 通过
- [x] 9.6 check-domain-doc / check-meta-docs 0 error
