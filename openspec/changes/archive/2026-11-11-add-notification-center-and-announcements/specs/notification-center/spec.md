## ADDED Requirements

### Requirement: Notification Categories and Persistence

通知 SHALL 持久化并带分类、优先级、动作链接、过期时间与已读时间。
通知 MUST 绑定组织与用户，MUST 支持按分类/已读/时间筛选；旧字段 MUST 保持兼容。

#### Scenario: 分类筛选

- **WHEN** 用户按 `approval` 分类查询通知
- **THEN** 结果 SHALL 只包含该分类
- **AND** 其他分类 MUST NOT 混入

#### Scenario: 过期通知

- **WHEN** 通知超过 `expiresAt`
- **THEN** 列表 SHALL 不再返回或标记过期
- **AND** 清理任务 SHALL 最终删除

### Requirement: Read/Unread and Batch Actions

用户 SHALL 能将单条/多条/全部通知标记已读，并查看未读计数。
批量操作 MUST 幂等；已读/删除 MUST 只作用于当前用户自己的通知。

#### Scenario: 批量已读

- **WHEN** 用户选择多条未读通知并标记已读
- **THEN** 这些通知 SHALL 变为已读
- **AND** 未读计数 SHALL 相应减少

#### Scenario: 越权操作他人通知

- **WHEN** 用户尝试标记他人的通知
- **THEN** 请求 SHALL 被拒绝
- **AND** 通知状态 MUST NOT 改变

### Requirement: Preferences and Muting

用户 SHALL 能按分类/渠道配置接收偏好与免打扰。
非强制通知 MUST 尊重用户偏好；强制/紧急通知 MAY 按组织策略绕过偏好，
但 MUST 显式标记并可审计。

#### Scenario: 关闭某类通知

- **WHEN** 用户关闭 `course` 分类的站内通知
- **THEN** 新通知 MUST NOT 以该渠道投递
- **AND** 用户 MAY 仍可在消息中心查看历史

#### Scenario: 强制通知

- **WHEN** 组织策略将某类通知标记为 mandatory
- **THEN** 该通知 SHALL 投递
- **AND** 其强制属性 SHALL 可查询/审计

### Requirement: Announcements and Audience

系统 SHALL 支持公告草稿、编辑、定时发布、立即发布、撤回与复用。
公告 MUST 支持定向：全员、角色、用户、组织节点、节点子树；多个 audience MUST 取并集。
Audience 解析 MUST 受组织与数据范围约束。

#### Scenario: 按班级公告

- **WHEN** 教师向“高二3班”节点发布公告
- **THEN** 只有该节点成员/关联用户 SHALL 收到
- **AND** 其他班级 MUST NOT 收到

#### Scenario: 跨租户节点

- **WHEN** 公告 audience 引用其他组织的节点
- **THEN** 发布 SHALL 被拒绝
- **AND** MUST NOT 产生投递

### Requirement: Announcement Delivery and Read Stats

公告发布 SHALL 通过异步任务分批扇出，幂等且可查询进度。
系统 MUST 提供投递数、已读数、失败数与明细分页；重复发布 MUST NOT 重复投递。

#### Scenario: 大批量公告

- **WHEN** 向 1000 名用户发布公告
- **THEN** 系统 SHALL 异步分批投递
- **AND** 进度/成功/失败 SHALL 可查

#### Scenario: 已读统计

- **WHEN** 用户阅读公告
- **THEN** 已读数 SHALL 增加
- **AND** 管理员 SHALL 能查看已读/未读明细

### Requirement: Recall and Expiry

公告 SHALL 支持撤回与过期。撤回后未读通知 MUST 不再展示或标记撤回；
已读通知 MUST 保留并显示撤回状态；统计 MUST 保留。

#### Scenario: 撤回公告

- **WHEN** 管理员撤回一条已发布公告
- **THEN** 未读用户 MUST NOT 再看到可操作公告
- **AND** 已读用户 SHALL 看到撤回状态
- **AND** 投递/已读统计 MUST 保留

#### Scenario: 定时过期

- **WHEN** 公告到达 `expiresAt`
- **THEN** 公告 SHALL 标记过期
- **AND** 不再新增投递

### Requirement: Real-time Delivery

新通知 SHALL 通过现有 WebSocket 实时推送；断线后 MUST 能补发未读。
实时推送失败 MUST NOT 丢失持久化通知。

#### Scenario: 在线推送

- **WHEN** 用户在线且收到新通知
- **THEN** 客户端 SHALL 实时收到
- **AND** 通知 SHALL 同时已持久化

#### Scenario: 断线补发

- **WHEN** 用户断线后重连
- **THEN** 未读通知 SHALL 可拉取/补发
- **AND** MUST NOT 重复计未读

### Requirement: Retention and Cleanup

通知与公告 SHALL 按组织策略保留；过期数据 MUST 分批清理或软删除。
被审计/合规引用的数据 MUST NOT 被静默物理删除。

#### Scenario: 30 天保留

- **WHEN** 通知超过保留期
- **THEN** 清理任务 SHALL 删除或软删除
- **AND** 操作 SHALL 可审计

#### Scenario: 合规保留

- **WHEN** 公告被标记为审计/合规引用
- **THEN** 清理 MUST 跳过或软删除
- **AND** 不得物理删除

### Requirement: Tenant Isolation and Permissions

通知/偏好/公告/投递 MUST 绑定组织并受 RLS 约束。
用户只能读自己的通知/偏好；公告管理/发布 MUST 需要对应权限。
MUST NOT 通过 audience 或 API 跨租户投递。

#### Scenario: 跨租户读取

- **WHEN** A 组织用户请求 B 组织通知/公告
- **THEN** 请求 SHALL 被拒绝
- **AND** 结果 MUST NOT 包含他租数据

#### Scenario: 无发布权限

- **WHEN** 用户缺少公告发布权限
- **THEN** 发布 SHALL 返回 403
- **AND** MUST NOT 创建投递

### Requirement: Backward Compatibility

本能力 MUST NOT 破坏现有通知接口、WebSocket 推送、审批待办与 outbox 事件。
旧通知数据 MUST 可读；旧客户端 MUST 继续工作。

#### Scenario: 旧通知客户端

- **WHEN** 旧客户端调用原通知列表/已读接口
- **THEN** 行为 SHALL 与升级前一致
- **AND** 新字段缺失时 SHALL 使用默认值

#### Scenario: 审批待办

- **WHEN** 审批进入待审
- **THEN** 原审批待办/通知 SHALL 继续工作
- **AND** 新消息中心 MAY 展示同一工作项
