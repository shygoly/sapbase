## 1. 契约与元语

- [ ] 1.1 定义通知分类/优先级/偏好/公告/audience/delivery 的持久化形状与 Schema
- [ ] 1.2 在 `docs/META_LANGUAGE.md` 登记通知/公告术语与不变量（INV-NT-01..05）
- [x] 1.3 在 `DOMAIN.md` 新增通知/公告小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [ ] 1.4 在 `DECISIONS.md` 登记分类/偏好/公告扇出/撤回/保留期决策
- [ ] 1.5 更新 `openspec/specs/notification-outbox/spec.md` 的待办/通知边界（如需要）

## 2. 存储与 RLS

- [x] 2.1 扩展 `notifications`：`category/priority/actionUrl/expiresAt/readAt/mandatory`
- [x] 2.2 回填旧数据：`category='system'`、`priority='normal'`、`readAt` 由 `read` 推导
- [x] 2.3 新增 `notification_preferences` / `announcements` / `announcement_audiences` / `announcement_deliveries`
- [x] 2.4a 索引与 RLS 登记
- [ ] 2.4b 跨租户负例 e2e
- [x] 2.5 TypeORM 实体与模块注册

## 3. 通知中心

- [x] 3.1 `NotificationService.publish()`：分类/优先级/动作链接/幂等（sourceEventId）
- [x] 3.2 列表/未读计数/按分类/优先级筛选
- [x] 3.3 单条/批量已读；批量幂等
- [x] 3.4a 过期通知过滤（列表默认排除）
- [ ] 3.4b 过期通知清理 job
- [x] 3.5a WebSocket 实时推送/未读补发（现有 connect 路径）
- [ ] 3.5b 断线重连 e2e
- [x] 3.6a 单测：未读计数/批量已读/偏好
- [ ] 3.6b 幂等/跨租户 e2e

## 4. 用户偏好

- [x] 4.1 `notification_preferences` CRUD
- [x] 4.2 分类/渠道开关、免打扰、mandatory 绕过
- [ ] 4.3 偏好对投递的生效逻辑（站内持久化不受影响）
- [ ] 4.4 偏好变更审计（可选）
- [x] 4.5 单测：关闭类别、免打扰、mandatory 绕过

## 5. 公告

- [x] 5.1a 公告 CRUD（草稿/编辑）
- [ ] 5.1b 复制/删除
- [ ] 5.2 富文本/Markdown 渲染 + XSS 过滤 + 附件
- [x] 5.3a Audience：all/role/user 并集
- [ ] 5.3b scope_node/scope_subtree audience
- [x] 5.4a 立即发布 + 权限校验
- [ ] 5.4b 定时发布
- [x] 5.5a 撤回 + 统计保留
- [ ] 5.5b 过期/未读删除
- [x] 5.6a 已读统计 delivered/read/failed
- [ ] 5.6b 分页明细
- [ ] 5.7 公告复用/模板（可选）
- [x] 5.8a 单测：all/role/空 audience/撤回/统计
- [ ] 5.8b 跨租户 scope 节点拒绝 e2e

## 6. 扇出与投递

- [x] 6.1 发布时创建 deliveries（逐用户幂等）
- [ ] 6.2 通过 `add-async-job-and-callback-facade` 扇出；进度/取消/重试
- [x] 6.3a 逐用户写 notifications + WebSocket；sourceEventId 幂等
- [ ] 6.3b 分批/批量优化
- [ ] 6.4 大组织阈值/并发/限流
- [x] 6.5a 单测：重复发布不重复 delivery、空 audience
- [ ] 6.5b 部分失败重试/取消

## 7. 保留期与清理

- [ ] 7.1 通知默认 30 天、公告可配置保留期
- [ ] 7.2 清理 job：分批删除过期通知/投递；保留统计
- [ ] 7.3 合规/审计引用不物理删除；软删除
- [ ] 7.4 清理审计
- [ ] 7.5 单测：到期清理、保留期延长

## 8. 管理端与 API

- [x] 8.1 Portal 消息中心：分类/未读/批量/偏好/角标
- [x] 8.2 Portal 公告管理：草稿/发布/撤回/统计（定时发布仍待后端 cron）
- [ ] 8.3 Console 通知模板/强制策略（可选）
- [x] 8.4 API 文档与 `api-client`
- [x] 8.5 权限点：`notifications:read` / `announcements:manage` / `announcements:publish`

## 9. 兼容与验收

- [ ] 9.1 旧通知接口/字段兼容；旧审批待办不变
- [ ] 9.2 旧 WebSocket 客户端兼容
- [ ] 9.3 e2e：教师发公告→学生收到→已读统计→撤回
- [ ] 9.4 负例：跨租户、越权发布、XSS、重复扇出
- [ ] 9.5 `openspec validate add-notification-center-and-announcements --strict`
- [ ] 9.6 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
