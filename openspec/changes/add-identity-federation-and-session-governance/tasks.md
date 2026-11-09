## 1. 契约与元语

- [x] 1.1 定义 `identity-provider`、`identity-link`、`session`、`service-client` 的持久化形状与 JSON Schema（`schemas/identity.schema.json`）
- [x] 1.2 在 `docs/META_LANGUAGE.md` 登记身份联邦/会话/服务令牌术语与不变量（INV-ID-01..04，05/06 随 SSO/服务令牌实现补）
- [x] 1.3 在 `DOMAIN.md` 新增身份与会话小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [ ] 1.4 在 `DECISIONS.md` 登记关键决策（多角色按组织、sid 吊销、服务令牌二次校验、fail-closed）
- [ ] 1.5 更新 `openspec/project.md` 的认证/多租户约定（如需要）

## 2. 存储与 RLS

- [x] 2.1a 迁移/实体：`organization_member_roles`（多角色绑定）
- [x] 2.1b 迁移/实体：`identity_providers` / `identity_links` / `auth_sessions` / `auth_login_events` / `identity_sync_runs` / `service_clients`
- [ ] 2.2 索引与唯一约束：provider key、identity link、活跃角色绑定、session 状态、login event 时间
- [ ] 2.3 新表加入 `TENANT_RLS_DDL.DIRECT_TABLES`，补跨租户 RLS e2e
- [x] 2.4a `organization_member_roles` 实体/模块/RLS 注册
- [x] 2.4b 其余身份/会话实体注册

## 3. 多角色与有效权限

- [x] 3.1 `organization_member_roles` 服务：授予/撤销/列表/有效期
- [x] 3.2 有效权限解析改为“本组织角色并集 ∪ 直授”，保留 `users.roleId` 回退
- [ ] 3.3 权限版本 `permissionVersion` 与 JWT/缓存刷新
- [ ] 3.4 迁移脚本：`users.roleId` 回填主组织角色绑定 + 差异报告
- [x] 3.5 单测：多角色并集、跨组织隔离、停用角色、过期绑定、旧字段回退

## 4. 会话治理

- [x] 4.1 `auth_sessions` 服务：创建/刷新/轮换/吊销/查询
- [x] 4.2a JWT 增加 `sid`；`JwtStrategy` 校验 DB 会话状态
- [ ] 4.2b Redis 会话缓存（多实例）
- [x] 4.3a `logout` 吊销当前会话；refresh token 哈希字段与 `rotateRefresh`
- [x] 4.3b refresh token 端点与轮换（`POST /auth/refresh`，旧 session 吊销）
- [x] 4.4a 管理员强制下线服务：单会话/全会话
- [x] 4.4b 管理 API：按 sid / 按用户强制下线
- [ ] 4.4c WebSocket 同步断开
- [ ] 4.5 密码修改/角色变更/账号停用触发吊销策略
- [x] 4.6a 单测：吊销/过期/批量吊销/轮换
- [x] 4.6b 负例：吊销后 JWT 401、过期 refresh、旧无 sid token 兼容
- [ ] 4.6c 并发会话上限策略与测试

## 5. SSO 与身份映射

- [x] 5.1a `IdentityProvider` 管理 service（CRUD + key 校验 + secretRef）
- [x] 5.1b 管理 API（`/identity/providers` CRUD）+ secretRef
- [x] 5.2 CAS adapter（redirect + ticket 校验 + 属性映射）
- [x] 5.3 OIDC adapter（state/nonce/PKCE、token exchange、id_token 验签）
- [ ] 5.3b OAuth2-only（无 id_token）adapter
- [ ] 5.4 SAML adapter（签名/时间窗/断言解析）
- [ ] 5.5 `identity_links` 映射 + JIT 建号 + 默认角色校验
- [ ] 5.6 SSO 登录/回调/失败/降级 e2e；state/nonce/签名负例
- [ ] 5.7 登录页 SSO 入口（复用 `redesign-auth-login-surfaces` 的布局，不重复 UI）

## 6. 生命周期同步

- [ ] 6.1 `IdentitySourceAdapter` 接口与 registry
- [ ] 6.2 `identity_sync_runs` + 差异计算（新增/更新/离职/删除）
- [ ] 6.3 定时任务 + 手动触发 + 差异报告
- [ ] 6.4 离职/删除：停用用户、吊销会话、停用角色绑定
- [ ] 6.5 对账与失败重试；高风险差异人工确认
- [ ] 6.6 单测：离职回收、幂等同步、源不可用不降级

## 7. 异常登录与审计

- [x] 7.1a `auth_login_events` service + 登录成功写入（ip/ua/provider）
- [x] 7.1b 登录事件查询 API（`/identity/login-events`）
- [ ] 7.1c 登录失败写入 + 连续失败锁定/新设备规则
- [ ] 7.2 规则：连续失败锁定、新设备/新 IP 通知、管理员查询
- [ ] 7.3 告警接 `notification-center-and-announcements`
- [ ] 7.4 登录/登出/强制下线/角色变更/令牌创建与吊销写 `audit_logs`

## 8. 服务令牌与委托身份

- [x] 8.1 `service_clients` 管理 API（创建/轮换/停用/scope）
- [x] 8.2 服务令牌认证守卫：组织/app 绑定、scope、过期/吊销、IP 白名单
- [ ] 8.3 `on_behalf_of`（可选）：重新解析用户功能权限与数据范围，不信任调用方声明
- [ ] 8.4 限流/IP 白名单/审计；负例：越权 scope、跨组织、过期 token、伪造 subject

## 9. 管理端与文档

- [ ] 9.1 Portal 组织设置：身份提供方/SSO/默认角色
- [ ] 9.2 Portal 账号安全：会话列表/强制下线/异常登录
- [ ] 9.3 Console 平台治理：服务客户端/scope（如需要）
- [ ] 9.4 API 文档与 `api-client`
- [ ] 9.5 更新 `docs/ARCHITECTURE.md` / `AGENTS.md` 的认证边界
- [ ] 9.6 `openspec validate add-identity-federation-and-session-governance --strict`

## 10. 验收

- [ ] 10.1 一个组织用 CAS/OIDC 登录成功；另一组织不受影响
- [ ] 10.2 JIT 建号只给默认角色；高权限角色必须手工/同步授予
- [ ] 10.3 强制下线后旧 token 立即 401；WebSocket 断开
- [ ] 10.4 离职同步后账号停用、会话吊销、角色回收
- [ ] 10.5 服务令牌代用户调用被服务端二次校验；越权返回 403
- [ ] 10.6 跨租户 RLS 负例通过
