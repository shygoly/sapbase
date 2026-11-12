# Change: 身份联邦与会话治理

## Why

当前平台只有邮箱密码登录 + JWT：

- `AuthService.login` 签发 `{ sub, email, role, permissions, organizationId }`，`logout` 只返回提示，token 由客户端删除，服务端没有吊销能力；
- 用户只有一个全局 `users.roleId`，`organization_members.role` 只有 `owner/member`，无法表达“同一用户在不同组织/不同岗位有多角色”；
- 没有 SSO、身份源同步、账号生命周期、异常登录、强制下线、服务令牌。

教育项目的 A-037—A-040、A-044、A-047 要求统一身份治理、CAS/OAuth2 单点登录、账号生命周期、越权防护、异常登录、现有系统身份复用；这些不是登录页观感能覆盖的，必须补平台能力。

## What Changes

- **ADDED** `identity-federation`：按组织配置身份提供方（CAS / OAuth2 / OIDC / SAML），
  SSO 登录、身份映射、JIT 建号、属性映射、账号生命周期同步与离职回收。
- **ADDED** 多角色绑定：`organization_member_roles`（组织 + 用户 + 角色 + 来源 + 有效期），
  有效权限 = 本组织内角色并集 ∪ 直授权限；保留 `users.roleId` 作为兼容回退。
- **ADDED** `session-governance`：`auth_sessions` 持久会话、`sid` 写入 JWT、
  refresh token 轮换、登出/强制下线/角色变更时吊销、设备/IP/UA 记录、异常登录检测。
- **ADDED** 服务令牌与委托身份：`service_clients` / `service_tokens`，
  支持客户端凭证、组织/应用绑定、scope、过期与轮换；外部系统代用户调用时仍由服务端
  重新执行功能权限与数据范围校验。
- **ADDED** 身份同步与对账：可插拔 `IdentitySourceAdapter`，定时/手动同步，
  记录 `identity_sync_runs` 与差异报告；停用/删除时吊销会话与角色绑定。
- **MODIFIED** 登录与守卫：登录响应可返回 `sid`；`JwtAuthGuard` 在会话被吊销时拒绝；
  `AuthService` 的有效权限改为“组织内多角色并集 + 直授”。
- **NOT CHANGED** 邮箱密码登录、现有 JWT 字段、`organization_members` 成员关系。
- **NON-GOALS** Passkey/MFA 全套、跨租户身份联邦、通用 IAM 策略语言、替换现有 RBAC。
- **BREAKING** 无。SSO 与服务令牌均为可选；旧 token 在过期前仍可用。

## Impact

- 受影响规格：`identity-federation`、`session-governance`（新增）
- 受影响代码：
  - `libs/platform-core/src/auth/**`、`auth-context/**`
  - `libs/platform-core/src/organizations/**`、`roles/**`
  - `apps/api/src/auth/**`、`common/**`（守卫/上下文）
  - 新模块 `apps/api/src/identity/**`（或 `libs/platform-core/src/identity/**`）
  - `apps/web-portal` / `web-console` 登录与账号安全页
  - `DOMAIN.md`、`DECISIONS.md`、`docs/META_LANGUAGE.md`
- 依赖：现有 `organization_members`、`roles`、`permissions`；`refactor-ai-native-business-app-platform`
  的 RLS/应用上下文（服务令牌绑定 app installation 时使用）。
- 迁移：只新增表；`users.roleId` 回填为默认组织角色绑定；不删除旧列。
- 风险：SSO 协议差异、JWT 无状态与会话吊销的取舍、身份源不可用时的降级、角色膨胀。
