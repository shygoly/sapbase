## 1. 契约与元语

- [x] 1.1 定义 `identity-provider`、`identity-link`、`session`、`service-client` 的持久化形状与 JSON Schema（`schemas/identity.schema.json`）
- [x] 1.2 在 `docs/META_LANGUAGE.md` 登记身份联邦/会话/服务令牌术语与不变量（INV-ID-01..04，05/06 随 SSO/服务令牌实现补）
- [x] 1.3 在 `DOMAIN.md` 新增身份与会话小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [x] 1.4 在 `DECISIONS.md` 登记关键决策（D-25：多角色按组织、sid/pv 吊销、服务令牌二次校验、fail-closed）
- [x] 1.5 更新 `openspec/project.md` 的认证/多租户约定

## 2. 存储与 RLS

- [x] 2.1a 迁移/实体：`organization_member_roles`（多角色绑定）
- [x] 2.1b 迁移/实体：`identity_providers` / `identity_links` / `auth_sessions` / `auth_login_events` / `identity_sync_runs` / `service_clients`
- [x] 2.2 索引与唯一约束：provider key、identity link、活跃角色绑定、session 状态、login event 时间
- [x] 2.3 新表已在 `TENANT_RLS_DDL.DIRECT_TABLES`；跨租户负例见 `tests/identity-federation.e2e.js`
- [x] 2.4a `organization_member_roles` 实体/模块/RLS 注册
- [x] 2.4b 其余身份/会话实体注册

## 3. 多角色与有效权限

- [x] 3.1 `organization_member_roles` 服务：授予/撤销/列表/有效期
- [x] 3.2 有效权限解析改为“本组织角色并集 ∪ 直授”，保留 `users.roleId` 回退
- [x] 3.3 `users.permissionVersion` + JWT `pv`；角色/直授变更递增，守卫拒绝旧 token
- [x] 3.4 `scripts/identity/backfill-member-roles.mjs` 回填主组织角色绑定 + 差异报告（已 dry-run/apply）
- [x] 3.5 单测：多角色并集、跨组织隔离、停用角色、过期绑定、旧字段回退

## 4. 会话治理

- [x] 4.1 `auth_sessions` 服务：创建/刷新/轮换/吊销/查询
- [x] 4.2a JWT 增加 `sid`；`JwtStrategy` 校验 DB 会话状态
- [x] 4.2b 会话缓存走 cache-manager（生产 Redis）；双实例共享缓存吊销 miss 单测
- [x] 4.3a `logout` 吊销当前会话；refresh token 哈希字段与 `rotateRefresh`
- [x] 4.3b refresh token 端点与轮换（`POST /auth/refresh`，旧 session 吊销）
- [x] 4.4a 管理员强制下线服务：单会话/全会话
- [x] 4.4b 管理 API：按 sid / 按用户强制下线
- [x] 4.4c 会话吊销事件 → WebSocket 主动断开；gateway 单测
- [x] 4.5 密码/角色/停用/删除发布 `UserSecurityChangedEvent`，吊销全部会话
- [x] 4.6a 单测：吊销/过期/批量吊销/轮换
- [x] 4.6b 负例：吊销后 JWT 401、过期 refresh、旧无 sid token 兼容
- [x] 4.6c 并发会话上限策略与测试（超过上限吊销最老会话）

## 5. SSO 与身份映射

- [x] 5.1a `IdentityProvider` 管理 service（CRUD + key 校验 + secretRef）
- [x] 5.1b 管理 API（`/identity/providers` CRUD）+ secretRef
- [x] 5.2 CAS adapter（redirect + ticket 校验 + 属性映射）
- [x] 5.3 OIDC adapter（state/nonce/PKCE、token exchange、id_token 验签）
- [x] 5.3b OAuth2-only adapter（token exchange + userinfo）
- [x] 5.4a SAML adapter：断言解析/时间窗/签名 verifier 端口（fail-closed）
- [x] 5.4b 生产 XML DSig verifier（xml-crypto，证书/指纹固定，fail-closed）
- [x] 5.5 `identity_links` 映射 + JIT 建号 + 默认角色校验
- [x] 5.6a SSO 授权/回调 HTTP e2e + adapter 失败/nonce 负例
- [x] 5.6b 本地协议级 CAS/OIDC provider e2e；真实客户 IdP 联调需现场配置（适配器已验收）
- [x] 5.7 登录页 SSO 入口（CAS/OIDC，回调完成 JWT/会话签发；SAML 浏览器 POST 待联调；组织用 `?organizationId=` 或 `NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID`）

## 6. 生命周期同步

- [x] 6.1 `IdentitySourceAdapter` 接口与 registry
- [x] 6.2 `identity_sync_runs` + 差异计算（新增/更新/离职/删除）
- [x] 6.3a 手动触发 + 差异报告 API（`/identity/sync/:key/run`、`/identity/sync/runs`）
- [x] 6.3b `identity.sync_scan` 每小时 cron（FLOWS/registry/@Cron 三向对拍）
- [x] 6.4 离职/删除：停用用户、吊销会话、停用角色绑定
- [x] 6.5a 失败隔离：单条失败计入 failed，源不可用 run failed 不降级删除
- [x] 6.5b 单条 3 次重试；`confirmDeactivations` 高风险离职 pending → 人工 confirm
- [x] 6.6a 单测：离职回收、源不可用不降级、默认角色缺失
- [x] 6.6b 幂等重跑：同一外部身份不重复建号/链接

## 7. 异常登录与审计

- [x] 7.1a `auth_login_events` service + 登录成功写入（ip/ua/provider）
- [x] 7.1b 登录事件查询 API（`/identity/login-events`）
- [x] 7.1c 登录失败写入 + 连续失败锁定/新设备规则（新设备告警仍待 7.2b）
- [x] 7.2a 连续失败锁定（窗口内失败计数，成功重置）
- [x] 7.2b 新设备/新 IP 成功登录通知本人与管理员
- [x] 7.3 告警走 notification-center（站内持久化 + WS 推送）
- [x] 7.4 登录/登出/强制下线/角色变更/令牌创建/轮换/使用/拒绝写审计

## 8. 服务令牌与委托身份

- [x] 8.1 `service_clients` 管理 API（创建/轮换/停用/scope）
- [x] 8.2 服务令牌认证守卫：组织/app 绑定、scope、过期/吊销、IP 白名单
- [x] 8.3a `on_behalf_of`：服务端重新解析用户/组织/角色/功能权限
- [x] 8.3b `DelegatedIdentityService.resolveDataScope()` + `/identity/delegation/scope`
- [x] 8.4a IP 白名单 + scope/跨组织/过期负例
- [x] 8.4b 服务令牌每分钟限流 + 拒绝/使用审计

## 9. 管理端与文档

- [x] 9.1 Portal 组织设置：身份提供方/SSO/默认角色页面
- [x] 9.2 Portal 账号安全：会话列表/强制下线/登录事件页面
- [x] 9.3 Console 平台治理：服务客户端/scope 页面
- [x] 9.4 API 文档 + `identityApi` api-client
- [x] 9.5 更新 `docs/ARCHITECTURE.md` / `AGENTS.md` 的认证边界
- [x] 9.6 `openspec validate add-identity-federation-and-session-governance --strict`

## 10. 验收

- [x] 10.1 两组织 CAS/OIDC 登录成功；provider 列表互不可见
- [x] 10.2 JIT 只给默认角色（permissions 仅默认角色权限）
- [x] 10.3 强制下线后旧 token 401；WebSocket 断开会话事件单测
- [x] 10.4 离职同步后账号停用、会话吊销、角色回收（pending→confirm）
- [x] 10.5 服务令牌代用户调用：无教育权限 403，Student 200；错误 scope 403
- [x] 10.6 跨租户 API 负例 + RLS DIRECT_TABLES
