# session-governance Specification

## Purpose
TBD - created by archiving change add-identity-federation-and-session-governance. Update Purpose after archive.
## Requirements
### Requirement: Persistent Sessions and Token Binding

每次登录 SHALL 创建持久会话（`auth_sessions`），JWT MUST 携带会话标识 `sid`。
服务端在验签后 MUST 校验会话存在、未过期且未吊销；不满足 MUST 拒绝请求。
会话 MUST 记录设备、IP、User-Agent 与最后活跃时间。

#### Scenario: 有效会话

- **WHEN** 用户使用带有效 `sid` 的 JWT 请求受保护接口
- **THEN** 请求 SHALL 通过
- **AND** 会话最后活跃时间 SHALL 更新

#### Scenario: 会话已过期

- **WHEN** `sid` 对应会话已过期
- **THEN** 请求 SHALL 返回 401
- **AND** MUST NOT 继续访问业务数据

### Requirement: Logout and Token Revocation

登出 SHALL 在服务端吊销当前会话与 refresh token；管理员 MUST 能吊销指定会话或该用户全部会话。
refresh token MUST 只存哈希，并支持轮换；旧 refresh token 使用后 MUST 失效。

#### Scenario: 登出立即失效

- **WHEN** 用户登出
- **THEN** 该 `sid` 的后续请求 SHALL 返回 401
- **AND** refresh token MUST NOT 再换取新 access token

#### Scenario: refresh 轮换

- **WHEN** 客户端用 refresh token 换取新 access token
- **THEN** 系统 SHALL 轮换 refresh token
- **AND** 旧 refresh token MUST NOT 再次使用

### Requirement: Force Logout and Concurrent Sessions

管理员 SHALL 能强制下线指定用户/会话；系统 SHALL 支持并发会话上限与设备列表。
被强制下线的会话 MUST 立即失效，WebSocket 连接 SHALL 被断开或拒绝续期。

#### Scenario: 管理员强制下线

- **WHEN** 管理员吊销用户 U 的全部会话
- **THEN** U 的所有 `sid` MUST 失效
- **AND** 其 WebSocket 连接 SHALL 被断开

#### Scenario: 并发会话上限

- **WHEN** 同一用户活跃会话数超过配置上限
- **THEN** 系统 SHALL 拒绝新登录或按策略淘汰最旧会话
- **AND** 行为 SHALL 可配置、可审计

### Requirement: Abnormal Login Detection

平台 SHALL 记录登录成功/失败事件（用户、组织、provider、IP、设备、时间、原因）。
连续失败、新设备/新 IP 等异常 MUST 能触发告警或通知；管理员 MUST 能按条件查询与导出。

#### Scenario: 连续失败锁定

- **WHEN** 同一账号在时间窗内连续失败达到阈值
- **THEN** 系统 SHALL 短时锁定或要求额外验证
- **AND** 写入异常登录事件与告警

#### Scenario: 新设备登录通知

- **WHEN** 用户从新设备/新 IP 成功登录
- **THEN** 系统 SHALL 通知该用户
- **AND** 管理员 SHALL 能查询该事件

### Requirement: Session and Device Visibility

用户 SHALL 能查看自己的活跃会话/设备并主动下线；管理员 SHALL 能按用户、组织、时间查询会话。
会话与登录事件的查询 MUST 受租户与角色权限约束。

#### Scenario: 用户下线其他设备

- **WHEN** 用户在自己的安全页选择“下线其他设备”
- **THEN** 除当前会话外的该用户会话 SHALL 被吊销
- **AND** 当前会话 SHALL 保持有效

#### Scenario: 跨租户不可见

- **WHEN** A 组织管理员查询 B 组织的会话或登录事件
- **THEN** 结果 SHALL 为空或拒绝

### Requirement: Token Rotation and Legacy Compatibility

access token SHALL 使用短 TTL，refresh token SHALL 支持轮换与过期。
旧版无 `sid` 的 JWT MUST 在过期前继续可用，MUST NOT 因本能力被强制失效；
新登录 MUST 使用 `sid`。

#### Scenario: 旧 token 过渡

- **WHEN** 用户持有升级前签发、尚未过期的 JWT
- **THEN** 请求 SHALL 继续可用
- **AND** 管理员仍可通过其他手段（改密/停用）使其失效

#### Scenario: 密码修改吊销

- **WHEN** 用户修改或重置密码
- **THEN** 系统 SHALL 吊销该用户全部会话或按配置保留当前会话
- **AND** 行为 SHALL 写入审计

