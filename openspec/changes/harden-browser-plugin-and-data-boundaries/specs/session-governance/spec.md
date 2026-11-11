## ADDED Requirements

### Requirement: Required Session Wiring at Real Authentication Entry Points

平台 SHALL 在实际 login/SSO/switch/refresh/logout 调用链复用已有 auth_sessions 与 AuthSessionsService。sid 验证器 MUST 通过显式运行时 DI token/具体provider必需注入，不得因 TypeScript 接口擦除或 Optional 缺 provider 跳过。守卫 MUST 核验有效状态、到期、修订及 session.userId/session.organizationId 与可信主体/组织匹配。新浏览器选组织后 MUST 有持久sid，组织未选只能使用不能访问业务的受限pre-session；组织切换/refresh MUST 用预期修订/CAS短事务原子轮换并撤销旧绑定。既有受控非浏览器旧无sid JWT 到期前兼容 SHALL 保留，不得成为新浏览器旁路；不得重建第二会话真源。

#### Scenario: 实际入口创建并原子轮换持久会话
- **WHEN** 真实Nest装配的登录/SSO完成选组织，或持有效sid及预期修订调用实际切组织/refresh入口
- **THEN** 平台 SHALL 创建或轮换原PG账本中的会话，返回匹配可信主体/组织的新状态
- **AND** 轮换成功后旧绑定与refresh秘密 SHALL 失效，登出后后续请求拒绝

#### Scenario: 缺注入或并发旧修订
- **WHEN** 验证provider缺失、sid主体/组织不符、会话过期/撤销、数据库不可用或并发提交旧修订
- **THEN** 系统 MUST 拒绝启动或请求，MUST NOT 省略会话验证继续访问业务
- **AND** CAS冲突 MUST 无第二份成功轮换且保持已确定有效绑定，pre-session/新无sid浏览器请求不得进入业务

### Requirement: Credential-Free Browser Session Transport

Portal与Console SHALL 共用同源BFF契约及固定路由/方法/upstream白名单，主浏览器会话 MUST 使用不透明host-only HttpOnly/Secure/Path=/无Domain cookie及明确SameSite策略。login/SSO/refresh/switch/logout响应、浏览器localStorage/状态/bundle/source map/日志/桥 MUST NOT 含bearer、refresh秘密或模型密钥；模型秘密 MUST NOT 使用NEXT_PUBLIC变量。所有状态变更 MUST 验证精确Origin/必要Referer及pre-session/会话绑定CSRF，不得只靠SameSite。会话/profile/桥响应 MUST no-store，插件origin不得凭据CORS。浏览器组织/应用提示 MUST 由服务端重新授权；真实SSE/WS消费者 SHALL 保持通信语义但不得要求浏览器读取主token。

#### Scenario: 正常登录与受保护通信无秘密返回
- **WHEN** 主应用通过合法同源BFF与有效CSRF完成登录或状态变更并建立受保护HTTP/SSE/WS通信
- **THEN** 系统 SHALL 只返回用户/组织/会话修订摘要，以安全cookie及服务端凭据完成鉴权
- **AND** 浏览器工件及消息 SHALL 无主bearer/refresh/provider秘密，旧localStorage token SHALL 清理并要求重新登录

#### Scenario: 跨站或凭据代理企图
- **WHEN** 请求缺CSRF、来自插件/错误origin、指定任意upstream或Authorization，或合成canary秘密出现在客户端产物/响应/桥
- **THEN** 请求或验证 MUST 失败且无真实副作用
- **AND** 系统 MUST NOT 回退裸bearer、开放凭据CORS或公开模型secret；未找到消费者的模块不能作为已通过真实调用证据
