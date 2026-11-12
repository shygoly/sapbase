# Design: 身份联邦与会话治理

## Context

已核对的现状：

- `libs/platform-core/src/auth/auth.service.ts`：邮箱密码 → JWT，payload 为
  `{ sub, email, role, permissions, organizationId }`；没有 refresh token。
- `auth.controller.ts` 的 `logout` 注释是 “Token invalidation would be handled by client-side removal”。
- `JwtAuthGuard` / `JwtStrategy` 只验签；`TenantGuard` 校验组织成员关系。
- `users.roleId` 是全局单角色；`organization_members.role` 只有 `owner/member`；
  有效权限由“组织内同名角色 ∪ 直授”解析。
- `organization_members` 支持用户多组织；`switchOrganization` 重新签发 JWT。
- WebSocket 连接时只验 JWT；断开/强制下线没有服务端会话概念。
- 没有身份提供方、身份映射、账号生命周期、异常登录、服务令牌。

## Goals / Non-Goals

**Goals**

1. 按组织接入 CAS / OAuth2 / OIDC / SAML，支持 SSO 登录、JIT 建号、属性映射。
2. 同一用户可在不同组织/岗位拥有多角色；有效权限按组织计算。
3. 服务端可吊销会话：登出、强制下线、角色变更、离职停用。
4. 记录异常登录并告警；管理员可查会话与登录事件。
5. 外部系统可用服务令牌/委托身份调用，平台仍做功能与数据权限二次校验。
6. 兼容现有邮箱密码登录与 JWT。

**Non-Goals**

- 不做 Passkey/MFA 全套（可后续独立 change）。
- 不做跨租户身份联邦（一个用户跨多个组织仍走成员关系，不共享角色）。
- 不做通用 IAM 策略语言（继续用 RBAC + 数据范围）。
- 不替换 `redesign-auth-login-surfaces` 的登录页观感。
- 不做 SCIM 全量规范；v1 用可插拔适配器 + 定时同步。

## Decisions

### D1：身份提供方按组织配置

`identity_providers`：

- `organizationId`、`protocol`（`cas` / `oauth2` / `oidc` / `saml`）、`key`、`name`
- `config`（授权端点、token 端点、issuer、证书、属性映射）
- `secretRef`（密钥/客户端密钥的引用，不存明文）
- `jitPolicy`（`disabled` / `create` / `create-and-link`）
- `status`

同一个组织可配置多个 provider；登录入口带 `organizationSlug + providerKey` 或从子域解析。
provider 配置变更写审计，并 bump 身份配置版本使缓存失效。

### D2：身份映射与 JIT

`identity_links`：

- `providerId`、`externalSubject`、`userId`、`organizationId`
- `externalAttributes`（JSONB，最小化保存）
- `lastLoginAt`、`lastSyncedAt`、`status`

唯一键：`(providerId, externalSubject)`；同一用户在同一 provider 只链接一次。
JIT 建号必须校验：邮箱/工号等稳定属性、组织允许的域名/属性、默认角色。
JIT 只创建**成员关系**，不自动给高权限角色；默认角色由 provider 的 `defaultRoleId` 指定，
且必须在组织内存在、`status=active`。

### D3：多角色按组织绑定

`organization_member_roles`：

- `organizationId`、`userId`、`roleId`
- `source`（`manual` / `sso` / `sync` / `migration`）
- `validFrom`、`validTo`、`status`
- 唯一键：`(organizationId, userId, roleId)`（有效期可用部分唯一索引）

有效权限解析：

```text
effectivePermissions(org, user) =
  union(active roles of user in org, each role.permissions)
  ∪ user.permissions (直授)
```

- 保留 `users.roleId` 作为兼容回退：迁移时把它写成 `organization_member_roles.source='migration'`；
  新逻辑优先读绑定，读不到再回退旧字段。
- 角色变更/移除时 bump 权限版本，使 JWT 缓存与前端权限刷新。
- 不改变 `organization_members.role`（owner/member 仍是租户成员角色，不是业务角色）。

### D4：会话持久化与 JWT `sid`

`auth_sessions`：

- `id`（sid）、`userId`、`organizationId`、`refreshTokenHash`
- `deviceId`、`deviceName`、`ip`、`userAgent`
- `createdAt`、`lastSeenAt`、`expiresAt`、`revokedAt`、`revokedReason`
- `status`（`active` / `revoked` / `expired`）

JWT payload 增加可选 `sid`；`JwtAuthGuard` 验签后检查：

1. `sid` 存在 → 查会话缓存/DB，必须 `active` 且未过期；
2. 没有 `sid`（旧 token）→ 走旧路径，直到过期；
3. 会话吊销 → 401，并清缓存。

Access token 短 TTL（如 15 分钟），refresh token 长 TTL（如 30 天）并轮换；
refresh token 只存哈希。WebSocket 连接同样校验 `sid`，吊销后可主动断开。

### D5：吊销矩阵

| 事件 | 动作 |
|---|---|
| 用户登出 | 吊销当前 `sid` |
| 管理员强制下线 | 吊销该用户全部/指定会话 |
| 密码修改/重置 | 吊销该用户全部会话（可保留当前） |
| 角色/权限变更 | bump 权限版本；可选吊销全部会话 |
| 账号停用/离职 | 吊销全部会话、移除/停用角色绑定、拒绝登录 |
| 身份源删除用户 | 同上，并写对账差异 |
| provider 停用 | 拒绝该 provider 新登录；已有会话按策略保留/吊销 |

吊销写 `audit_logs`；Redis 缓存 `session:revoked:<sid>`，DB 为真源。

### D6：账号生命周期同步

`identity_sync_runs`：`providerId`、`mode`（`full` / `incremental`）、`status`、
`startedAt`、`finishedAt`、`stats`、`diff`、`error`。

`IdentitySourceAdapter` 接口（按 provider 实现）：

```ts
interface IdentitySourceAdapter {
  listUsers(cursor?: string): Promise<IdentityUserPage>
  getUser(externalId: string): Promise<IdentityUser | null>
}
```

同步策略：

- 新增 → 创建/链接用户 + 成员关系 + 默认角色；
- 属性变化 → 更新映射与可选角色（只在策略允许时）；
- 离职/删除 → 停用账号、吊销会话、停用角色绑定；
- 差异写 `diff`，支持人工确认后应用（v1 默认“同步 + 差异报告”，高风险变更需确认）。

### D7：异常登录

`auth_login_events`：`userId?`、`email`、`organizationId?`、`providerId?`、
`result`（`success` / `failure`）、`reason`、`ip`、`userAgent`、`deviceId`、`createdAt`。

规则（v1）：

- 连续 N 次失败（默认 5 次/10 分钟）→ 告警 + 短时锁定；
- 新设备/新 IP 登录成功 → 通知用户；
- 管理员可查询、筛选、导出；告警走 `notification-center`（P0 依赖）。

### D8：服务令牌与委托身份

`service_clients`：

- `organizationId`、`appInstallationId?`、`name`、`clientId`、`secretHash`
- `scopes`、`status`、`expiresAt`、`createdBy`

`service_tokens`（可选，若需要多 token 轮换）：

- `clientId`、`tokenHash`、`scopes`、`expiresAt`、`revokedAt`

调用方式：

- `Authorization: Bearer <service-token>` + `X-Organization-Id`；
- token 绑定组织/应用；scope 限定可调用的 API/工具；
- `on_behalf_of`（可选）：携带用户 subject，服务端必须重新解析该用户在本组织的
  功能权限与数据范围，MUST NOT 直接信任调用方传入的 permissions。

服务令牌不产生用户会话；每次调用写审计（client、org、scope、目标资源、结果）。

### D9：安全与失败方向

- provider secret / service secret 只存引用或哈希；禁止明文入库。
- SSO state/nonce/PKCE 必须校验；SAML 签名/时间窗必须校验；失败一律拒绝。
- 身份源不可用时：已有密码登录仍可用；SSO 登录失败，不降级为“信任断言”。
- 角色映射失败/JIT 默认角色不存在 → 拒绝登录或只给最小权限，按 fail-closed。
- 所有登录、登出、强制下线、角色变更、令牌创建/吊销写审计。

### D10：兼容与迁移

- 邮箱密码登录保留；SSO 是组织级可选能力。
- 旧 JWT 无 `sid` 仍可用到过期；新登录带 `sid`。
- 迁移脚本把 `users.roleId` 回填为组织绑定（若用户属于多个组织，只在主组织回填；
  其余组织由管理员/同步配置）。
- 不删除 `users.roleId` / `organization_members.role`；新逻辑优先读新表。

## Data Model

```sql
identity_providers (
  id uuid pk,
  "organizationId" uuid not null,
  key varchar(64) not null,
  name varchar(255) not null,
  protocol varchar(16) not null,       -- cas | oauth2 | oidc | saml
  config jsonb not null default '{}',
  "secretRef" varchar(255),
  "jitPolicy" varchar(32) not null default 'disabled',
  "defaultRoleId" uuid,
  status varchar(32) not null default 'active',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("organizationId", key)
)

identity_links (
  id uuid pk,
  "organizationId" uuid not null,
  "providerId" uuid not null,
  "externalSubject" varchar(512) not null,
  "userId" uuid not null,
  "externalAttributes" jsonb not null default '{}',
  "lastLoginAt" timestamptz,
  "lastSyncedAt" timestamptz,
  status varchar(32) not null default 'active',
  unique ("providerId", "externalSubject")
)

organization_member_roles (
  id uuid pk,
  "organizationId" uuid not null,
  "userId" uuid not null,
  "roleId" uuid not null,
  source varchar(16) not null default 'manual',
  "validFrom" timestamptz,
  "validTo" timestamptz,
  status varchar(32) not null default 'active',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
)
-- unique ("organizationId", "userId", "roleId") where status='active'

auth_sessions (
  id uuid pk,
  "userId" uuid not null,
  "organizationId" uuid not null,
  "refreshTokenHash" varchar(255),
  "deviceId" varchar(255),
  "deviceName" varchar(255),
  ip varchar(64),
  "userAgent" text,
  "createdAt" timestamptz not null default now(),
  "lastSeenAt" timestamptz not null default now(),
  "expiresAt" timestamptz not null,
  "revokedAt" timestamptz,
  "revokedReason" varchar(64),
  status varchar(32) not null default 'active'
)
-- index ("userId", status), index ("organizationId", status)

auth_login_events (
  id uuid pk,
  "organizationId" uuid,
  "userId" uuid,
  email varchar(255),
  "providerId" uuid,
  result varchar(16) not null,
  reason varchar(64),
  ip varchar(64),
  "userAgent" text,
  "deviceId" varchar(255),
  "createdAt" timestamptz not null default now()
)

identity_sync_runs (
  id uuid pk,
  "organizationId" uuid not null,
  "providerId" uuid not null,
  mode varchar(16) not null,
  status varchar(32) not null,
  "startedAt" timestamptz not null,
  "finishedAt" timestamptz,
  stats jsonb not null default '{}',
  diff jsonb not null default '{}',
  error text
)

service_clients (
  id uuid pk,
  "organizationId" uuid not null,
  "appInstallationId" uuid,
  name varchar(255) not null,
  "clientId" varchar(128) not null unique,
  "secretHash" varchar(255) not null,
  scopes text[] not null default '{}',
  status varchar(32) not null default 'active',
  "expiresAt" timestamptz,
  "createdBy" uuid,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
)
```

所有新表带 `organizationId` 并纳入 RLS（服务令牌/身份链接按组织可见）。

## Flows

### SSO 登录

```text
GET /auth/sso/:orgSlug/:providerKey/start
  → 生成 state/nonce/PKCE，写短期缓存
  → 跳转 provider
GET /auth/sso/:orgSlug/:providerKey/callback
  → 校验 state/nonce/签名
  → 解析断言 → identity_links
  → 已链接：检查用户/成员/角色状态
  → 未链接且 JIT：创建/链接 + 成员 + 默认角色
  → 创建 auth_session，签发 JWT(sid)
  → 写 auth_login_events / audit_logs
```

### 强制下线

```text
POST /auth/sessions/:sid/revoke
  → 校验管理员权限
  → auth_sessions.revokedAt = now()
  → Redis 写 revoked 缓存
  → WebSocket 断开该 sid
  → 审计
```

### 生命周期同步

```text
cron / manual → IdentitySourceAdapter.listUsers
  → 计算 diff（新增/更新/离职/删除）
  → 低风险自动应用；高风险写待确认
  → 离职：停用用户、吊销会话、停用角色绑定
  → 写 identity_sync_runs + 审计
```

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| SSO 协议差异大 | 每种协议独立 adapter + 固定样例 + 负例（state/nonce/签名/过期） |
| JWT 无状态 vs 会话吊销 | access token 短 TTL + `sid` 检查 + Redis 缓存；不追求即时全量，但登出/强制下线即时 |
| 多角色导致权限膨胀 | 默认角色最小化；角色变更审计；权限版本刷新；不自动给高权限 |
| 身份源不可用 | 密码登录保留；SSO 失败不降级；健康检查与告警 |
| 服务令牌泄露 | 哈希存储、scope 最小化、过期/轮换、IP 白名单、审计 |
| 旧 token 兼容 | 无 `sid` 走旧路径到过期；不强制一次性下线 |
| 迁移把用户 roleId 写错组织 | 只回填主组织；多组织由管理员/同步确认；提供差异报告 |

## Migration Plan

1. 新表 + RLS + 索引，纯增量。
2. 回填 `organization_member_roles`：以 `users.roleId` 对应的角色组织为准；找不到角色则跳过并记录。
3. 新登录开始签发 `sid`；旧 token 继续可用。
4. 先接一个客户 SSO provider 试点，再开放多 provider。
5. 回滚：停用 provider/服务令牌；会话表保留；密码登录不受影响。

## Open Questions

- 是否需要 MFA/Passkey？建议后续独立 change。
- 身份源同步是 SCIM 还是自定义 adapter？v1 用 adapter，SCIM 作为 adapter 的一种。
- 角色变更是否强制吊销全部会话？建议默认只 bump 权限版本，敏感角色可配置强制吊销。
- 服务令牌是否支持 `on_behalf_of`？v1 可选，默认关闭，按客户集成需求开启。
