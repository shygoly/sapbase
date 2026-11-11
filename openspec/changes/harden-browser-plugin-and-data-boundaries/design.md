# 浏览器隔离与事实边界设计（weichen 重审）

## Context / Goals / Non-Goals

基线 `ce1e538dcec6539f66bba80d5413a3b6741486c9`。主 app 通过 `@sap/app-shared` 兼容层消费 `@sap/api-client`；插件 UI 真正在 app-shared，插件后端仍在 apps/api；身份/会话真实 owner 在 platform-core。目标切断第三方主权限域、补真实 sid 入口、使业务来源诚实。非目标是重做已实现 identity、蓝图 UI、数据范围、安装事务或业务计算。

## 1. 插件准入、隔离与撤销

新增（尚未实现）`PluginUiDescriptor`：pluginId/version、artifactDigest、完整资源图摘要、origin、hostApiVersion、allowedCapabilities、平台来源分类、批准引用、signature/keyId、revocationRevision。扩展既有 `schemas/plugin-manifest.schema.json` 的可选 UI 资源引用；旧 metadata/dependencies 保持兼容，但未准入第三方只可发现不可挂载。平台重算全部脚本、chunk、样式与静态依赖摘要，使用现有可信签名设施/05 接口，不把插件提交的 trusted/digest 当事实、不另造 Blueprint 格式。签名有效的第三方仍隔离；只有平台代码管线审核的第一方固定摘要模块例外。

拟新增 `libs/app-shared/src/core/plugins/plugin-frame-host.tsx`、`plugin-message-bridge.ts` 与 `apps/api/src/plugins/` 的 UI 准入适配器；替换现有 `plugin-component-loader.ts:128–143` 的第三方 import 与 `plugin-runtime.tsx:184` 主树渲染。第三方自由 CSS 不再由 `plugin-theme-service.ts:64–84` 注入主 DOM；允许平台批准的有限主题变量名/值语法，不接受 url()/任意选择器。

静态资产为不同可注册站点（非仅不同路径/子域同站广域 cookie），每插件/摘要固定 origin，主 cookie 不带 Domain。iframe 默认仅 scripts；若模块装载要求 same-origin 标记，必须严格限定独立 origin，绝不容许主站资源或重定向。禁止 forms/popups/top-navigation/downloads/宿主设备能力；no-referrer。主站 script-src 不允许插件站，frame-src 只准登记 origin；插件响应 CSP 默认拒绝网络/对象/表单、仅允许签名资源图中的脚本样式，禁止 inline/eval，frame-ancestors 限主站。缺 CSP/签名/资源图/撤销状态一律拒绝，绝不回退主 React 树。合法授予插件的数据仍可被其展示/截图，不能承诺零外泄。

停用、卸载、资源摘要/身份/组织/安装/有效版本变化关闭 port、取消未提交请求并清显示数据。服务端每次请求查询权威准入修订，通知只加速而不授权；已提交事务保留真实审计，不谎称撤销自动回滚。

后端保持 `PluginRuntimeService`→`PluginHostProcess`→`node --permission`、清单 all-of 与既有 DataScopeGuard；当前 capability executor 仅 log.write，未实现能力仍抛错。Node 权限模型不控制出网，第三方后端还须独立部署层 egress 证据；浏览器隔离不能替该证据，也不在本项实现网络部署。

## 2. 窄桥与可信工具入口

拟定 `plugin-ui-bridge/v1` 共享封闭 Schema，字段仅 protocol/requestId/bridgeInstanceId/artifactDigest/type/payload。宿主验证精确 event.origin 与 event.source===iframe.contentWindow、一次性随机 nonce/实例、协议摘要，再用精确 targetOrigin 移交 MessageChannel；不使用 `*`。限额（bytes/depth/inflight/deadline）由批准的版本化 host policy 明确配置并拒绝超限，本稿不臆造通用数字。未知字段/重放/关闭后旧 port 拒绝。

消息仅 ready/resize/request-data/propose-action/result/error；不接任意 URL、SQL、JS、HTML、原始表/授权主体。resize 为有界数值。链路为 iframe→宿主→同源 BFF→服务端插件适配→Registry→确定性查询/命令。服务端从 session 及安装上下文解析 user/org/app/release，计算清单能力∩功能权限∩安装/有效版本允许能力，并复用既有 data-scope 的租户∩权限∩范围判定；字段最小化。跨安装显式能力仍按平台原判据，不靠桥标签扩权。

写消息只生成提议，主可信面显示来源/对象/args 摘要并确认；Registry 校验确认且真实 invoke 才成功。01 的事件、06 的 ReleaseContext、07/08 的完整确认/编辑协议为后置接口；缺提供者禁对应查询/写，不用 mock success。仅隔离契约开发无需生产 release。

## 3. 复用会话账本，修真实入口

`AuthController` login/switch 调 `auth-context` 应用服务，SSO/refresh/logout 调 AuthService；不能只修后者。`LoginService` 已在选组织后创建 PG sid/refresh hash；`SwitchOrganizationService` 仍无 sid；`JwtStrategy` 接口类型 `AuthSessionService` 无运行时 token 且 @Optional，IdentityModule 只导出具体类。拟新增显式 injection token（如 AUTH_SESSION_VALIDATOR）与 useExisting:AuthSessionsService 绑定，必需消费者不 Optional。缺 provider 拒绝启动/请求，接口不是 DI binding 本身。守卫校验 session.userId 与 JWT sub、session.organizationId 与可信上下文、status/expiry/revision；本项不重定义用户权限解析器。

两个 Next app 拟新增 `src/app/api/bff/` 固定路由/方法适配，共享服务端 handler；可部署为两个 origin 的独立 host-only 会话而共享 PG 真源，禁止 Domain 广域 cookie 或跨 app 自动复制凭据。BFF 只接受固定 API 白名单，拒绝绝对 URL、upstream/Authorization 注入；服务端持有上游凭据/secretRef，模型 provider 不移到浏览器。

cookie `__Host-sapbase_session` 为随机不透明秘密，HttpOnly/Secure/Path=/、无 Domain、SameSite=Lax；仅服务端保存其摘要和已有 sid 关联，若需要增量 browser binding/sessionRevision 字段则附着原账本，不新建第二真源。新 browser login/SSO/refresh/switch/logout 返回无 token/refresh secret 的用户/组织/sessionRevision 摘要。组织未选时只发短期受限 pre-session，不能访问业务；选组织后必须进入持久 sid。

切组织/refresh 用短事务及 expectedSessionRevision/CAS 原子创建下一绑定、撤销旧绑定；并发只一份成功，失败保留旧状态，登出先持久撤销后清 cookie。适配实际 SwitchOrganizationService，不把未被调用的 AuthService.switchOrganization 当验收目标。数据库不可用拒绝。原非浏览器旧无 sid JWT 在原到期内兼容，区分服务客户端而非改密钥一刀切；新浏览器不自动 localStorage bearer 兑换，清旧存储重新登录。遗留 bearer 登录入口不向第三方资源 origin 开放凭据 CORS；不强行否定 pending legacy 原场景。

BFF 状态变更（含登录前/SSO回调、refresh/switch/logout）验证精确 Origin/必要 Referer、pre-session 或会话绑定 CSRF、方法与 Content-Type；SSO state/nonce 原身份校验仍保留。SameSite 不单独代替 CSRF。会话/桥/profile no-store，不进 CDN/SW 缓存，不记录秘密。迁移 ApiClient/AuthApi/SharedState 与仍在使用的 WebSocket/SSE 消费者，保留通信语义但不 getAuthToken 向 browser 暴露秘密；已存在 identity 强制下线规则不重复建设。

禁止模型秘密进入 NEXT_PUBLIC、序列化响应、客户端 bundle/source map/日志/桥。KimiClient/PatchGateway 暂未找到运行消费者，做清点和合成 canary 构建负例，不宣称真实 provider 调用；只对真实消费者迁移，01 负责服务端 DTO/secretRef。

## 4. 数据模式、stale 与业务真相

新增 `BusinessDataEnvelope<T>` / `DataProvenance`：status=live|stale|demo|unavailable、可选 data、sourceRef/fetchedAt/expiresAt、namespace、recordVersions、errorCode/correlationId。namespace 由可信层给出 mode/user授权修订（含scopeVersion）/org/installation/effectiveReleaseDigest/queryKey，不采信客户端上下文；没有 release 的非安装资源明确其资源类别，不能用伪 digest。live 时间是实际成功获取时间。

迁移真实 `libs/api-client/src/api/shipping/{http,ships,voyages,charters,constants,reports,report-center}.ts` 及 `libs/ui-shipping` 消费者；兼容壳仍 re-export，不维护两套。生产 401/403 清相关缓存；500/网络/超时/无效格式/不存在 API 为 unavailable，有授权且同 namespace 缓存才可按策略显示 stale。合法成功 [] 是 live 空，不将缺字段/null/格式错强制 []。基线没有航运 HTTP 装配，缺提供者的功能显示不可用，不在此为了“看起来成功”临造业务接口。

demo 仅由受配置隔离 profile/env 启用，adapter 与生产 cookie/数据源/缓存/幂等键隔离，持续标识页面、表格、筛选/导出与上下文。移除报表页直接 mock 船舶身份进入生产筛选。demo 真 REST/Registry 写与真实导出零调用；本地模拟只标演示结果。后端也拒真实写，UI disabled 不是唯一边界。

stale 保留原 sourceRef/fetchedAt/过期原因，不把重渲染当新采集；身份/权限/scopeVersion/org/app/release 变化清缓存和桥，写前受权 live 重取 recordVersion，失败禁写。当前 cached-api.ts 有无命名空间缓存，但仅发现未被 Next page 消费的 page-optimized 使用；不按已证实生产串租户列 P0，只为将来启用设置同契约准入。07/08 使用最小来源信息作展示提示，生产事实由服务端查询获得，demo/unavailable 不进入生产 ContextEnvelope，stale 不作当前事实或 expectedVersion。

## 5. 迁移、回退与风险

先冻结 shared Schema/host policy/注入 token/浏览器路由兼容，再增量修会话接线、BFF、插件隔离、数据消费者。未完成隔离的第三方 UI 禁用，旧元数据发现保留；不重做蓝图消费者或拓扑。旧 token/无来源缓存不能重标 live，受控非浏览器兼容按原到期清退。

安全回退为停插件/关桥写、前一已验证隔离摘要、重新登录、明确业务不可用；不得恢复主域 import/自由 CSS/localStorage bearer/无 CSRF cookie/静默 mock/旧撤销修订。保留身份审计和兼容安装数据；任何数据库动作需另行批准执行。

成本为独立资源站点/CSP/跨域可访问性与双 app cookie运维；误配必须拒绝，性能按实际测量再调整 policy。BFF 仍不能防主站自身 XSS，需保留主站 CSP/输出控制，最小字段无法阻止合法获授内容的截图。

## 6. 验证与后置联合验收

本次只读静态复核与 OpenSpec 格式校验，无真浏览器、HTTP/PG、Node 恶意插件、模型或构建实测。已核对 build/test 命令使用 `@sap/web-portal`、`@sap/web-console`、`@sap/api`，不可用旧 speckit/backend 或 main dist。拟新增 `test:browser-boundaries`（两个 app）、`check:client-secrets`、API `test:browser-session-e2e` 均待新增，先落脚本/suite 后运行；根 CI 已有 test-evidence，扩展证据而不另造 runner。

需真实 Nest 模块装配证明 token provider 必需、真实隔离 PG 证明撤销/主体组织匹配/并发轮换/重启，真实独立站点浏览器证明合法/恶意插件、origin/source/CSP/资源图/撤销、cookie/CSRF、生产错误/demo/stale；记录 sourceSha/artifactDigest/可选冻结 candidateDigest/suiteVersion、实际 Node/Next/React/browser/PG版本、实际 case/assertions/failed/skipped、前置失败。零断言、初始化失败、missing/unavailable/skipped 不得 passed。

09 以冻结候选评测，不要求 published，缺真实模型评测不得自治。01/06/07/08 未接的能力默认拒绝，前段隔离开发可以继续。完整冻结→评测→审批→签名未公开工件→最终 GateDecision→published→activation 在05/06/09汇合，本项不重写发布系统或放行 A1/A2。
