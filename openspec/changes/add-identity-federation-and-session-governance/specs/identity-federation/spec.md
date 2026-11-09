## ADDED Requirements

### Requirement: Per-Tenant Identity Providers

平台 SHALL 支持按组织配置身份提供方（CAS / OAuth2 / OIDC / SAML），
每个提供方 MUST 绑定唯一组织、唯一 key，并使用 secret 引用而非明文密钥。
同一组织 MAY 配置多个提供方；不同组织的提供方 MUST NOT 互相可见或复用。

#### Scenario: 两个组织各自配置 OIDC

- **WHEN** 组织 A 与组织 B 分别配置不同的 OIDC issuer
- **THEN** 两边的登录入口 SHALL 只解析各自组织的 provider
- **AND** A 组织的用户 MUST NOT 通过 B 组织的 provider 登录

#### Scenario: 明文密钥被拒

- **WHEN** 创建 provider 时直接提交客户端密钥明文
- **THEN** 系统 SHALL 拒绝或只保存 secret 引用
- **AND** 日志与响应 MUST NOT 回显密钥

### Requirement: SSO Login and Assertion Validation

SSO 登录 SHALL 校验 state、nonce、PKCE（适用时）、签名与时间窗；
任一校验失败 MUST 拒绝登录，MUST NOT 退化为信任断言或匿名登录。

#### Scenario: state/nonce 不匹配

- **WHEN** 回调携带的 state 或 nonce 与发起时不匹配
- **THEN** 登录 SHALL 被拒绝
- **AND** MUST NOT 创建会话

#### Scenario: SAML 断言过期或签名无效

- **WHEN** SAML 断言超出时间窗或签名校验失败
- **THEN** 登录 SHALL 被拒绝
- **AND** 事件 SHALL 写入登录审计

### Requirement: Identity Mapping and JIT Provisioning

平台 SHALL 通过 `identity_links` 把外部 subject 映射到本地用户。
未链接用户只有在 provider 的 JIT 策略允许时才可自动建号/链接；
JIT MUST 只创建成员关系与默认角色，MUST NOT 自动授予高权限角色。

#### Scenario: 首次 SSO 登录 JIT 建号

- **WHEN** provider 允许 JIT，外部用户属性通过校验且默认角色存在
- **THEN** 系统 SHALL 创建/链接用户、建立组织成员关系、绑定默认角色
- **AND** 登录 SHALL 成功

#### Scenario: 默认角色不存在

- **WHEN** provider 配置的默认角色在组织内不存在或已停用
- **THEN** JIT SHALL 失败并拒绝登录
- **AND** MUST NOT 以“无角色”方式放行

#### Scenario: 未链接且 JIT 关闭

- **WHEN** 外部 subject 未链接且 provider 的 JIT 为 disabled
- **THEN** 登录 SHALL 被拒绝并提示联系管理员

### Requirement: Account Lifecycle Synchronization

平台 SHALL 提供可插拔身份源同步，覆盖建号、属性更新、调权、停用、注销，
并 MUST 记录同步运行与差异报告。离职/删除 MUST 吊销会话并回收角色绑定。

#### Scenario: 离职回收

- **WHEN** 身份源标记某用户离职
- **THEN** 系统 SHALL 停用该用户、吊销其全部会话、停用组织角色绑定
- **AND** 该用户 MUST NOT 再登录或访问受保护资源

#### Scenario: 同步幂等

- **WHEN** 同一批身份数据被同步两次
- **THEN** 结果 SHALL 与同步一次一致
- **AND** MUST NOT 重复创建用户、链接或角色绑定

#### Scenario: 身份源不可用

- **WHEN** 身份源暂时不可用
- **THEN** 已有密码登录 SHALL 仍可用
- **AND** SSO MUST NOT 降级为信任本地缓存断言

### Requirement: Multi-Role Binding per Organization

用户 SHALL 可在同一组织内拥有多个角色；有效权限 MUST 按组织计算：
本组织内全部 active 角色权限的并集，再与用户直授权限取并集。
角色绑定 MUST 支持来源、有效期与停用；跨组织角色 MUST NOT 生效。

#### Scenario: 一人多角色

- **WHEN** 用户 U 在组织 A 同时拥有“教师”和“年级管理员”两个角色
- **THEN** 有效权限 SHALL 为两个角色权限的并集
- **AND** 在组织 B 中 MUST NOT 继承这两个角色

#### Scenario: 角色停用

- **WHEN** 一个角色被停用或绑定过期
- **THEN** 该角色权限 MUST NOT 出现在下一次解析结果中
- **AND** 权限版本 SHALL 递增

#### Scenario: 旧单角色兼容

- **WHEN** 某用户没有新的角色绑定，但仍有 `users.roleId`
- **THEN** 系统 SHALL 回退到旧字段解析
- **AND** MUST NOT 让该用户失去已有权限

### Requirement: Service Tokens and Delegated Identity

平台 SHALL 支持服务客户端/服务令牌，令牌 MUST 绑定组织（可再绑定应用）、
限定 scope、支持过期与轮换。外部系统代用户调用时，平台 MUST 重新校验
该用户的功能权限与数据范围，MUST NOT 信任调用方传入的权限声明。

#### Scenario: 服务令牌越界

- **WHEN** 服务令牌缺少目标 API/工具所需 scope
- **THEN** 调用 SHALL 被拒绝
- **AND** MUST NOT 以“服务身份”绕过用户权限

#### Scenario: 委托身份二次校验

- **WHEN** 服务令牌携带 `on_behalf_of` 用户调用业务接口
- **THEN** 平台 SHALL 重新解析该用户在本组织的功能权限与数据范围
- **AND** 越界数据 MUST NOT 返回

### Requirement: Fail-Closed and Auditable Identity

身份相关失败 MUST 拒绝而非放行：provider 不可用、映射失败、默认角色缺失、
断言校验失败、服务令牌过期/吊销。登录、登出、强制下线、角色变更、
令牌创建/吊销 MUST 写入审计。

#### Scenario: provider 不可用

- **WHEN** SSO provider 健康检查失败
- **THEN** 新 SSO 登录 SHALL 失败
- **AND** MUST NOT 回退到“信任上一次断言”

#### Scenario: 身份变更可审计

- **WHEN** 管理员修改 provider、角色绑定或服务令牌
- **THEN** 审计 SHALL 记录操作者、变更前后值与时间
