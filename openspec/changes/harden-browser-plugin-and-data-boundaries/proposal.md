# Change: 收紧浏览器插件、会话接线与业务数据来源边界

## Why

本 change 为 `harden-browser-plugin-and-data-boundaries`，顺序 02，优先级 **P0（浏览器信任与事实边界；不代表公网已利用）**。重新审查基线为 **weichen `ce1e538dcec6539f66bba80d5413a3b6741486c9`**，文档分支 `weichen-ai-native-remediation-20261110` 分支。前置为 `refactor-ai-native-control-plane-boundaries`；01/02/03 可并行隔离开发，后置联合验收不阻断前段契约开发。

此稿不是旧 main 结论搬运：后端、API 与 UI 已拆为多个 libs，已有 PG identity/sessions、data-scope、蓝图 UI consumer 与 test-evidence 资产；目录迁移既不证明修复，也不证明旧风险仍然成立。

### 已有实现与剩余证据

| weichen 实际证据 | 结论与本次取舍 |
| --- | --- |
| `apps/web-console/src/app/admin/plugins/[pluginId]/[page]/page.tsx:10,75–91` → `libs/app-shared/src/core/plugins/plugin-runtime.tsx:143–184` → `plugin-component-loader.ts:128–143` | 实际页面仍动态 import 后渲染到主 React 树；两个 app 的 providers 均启用插件。独立 origin、资源准入与消息桥仍需补。未测试资源可用性或恶意插件加载。 |
| `libs/app-shared/src/core/plugins/plugin-runtime.tsx:76–84` → `plugin-theme-service.ts:64–84` | 主题响应原文注入主 DOM style；平台准入分类与纯变量白名单仍缺。 |
| `libs/app-shared/src/lib/api/client.ts:1–2` 为兼容导出；真实 `libs/api-client/src/api/client.ts:40–56,107–117`、`auth.api.ts:41–61,89–127` | 真实登录、SSO 与切组织仍向浏览器交付并存储 bearer；HttpOnly/BFF/CSRF 是新增浏览器边界，不是替代插件隔离。 |
| `libs/platform-core/src/identity/auth-sessions.service.ts:36–96`，`auth-context/application/services/login.service.ts:123–147`，`auth/auth.service.ts:136–145,257–281` | PG 会话创建、refresh 哈希、撤销与部分入口已实现。删除旧“新建整套 PG 会话账本”任务；只补入口一致性和浏览器适配。 |
| `libs/platform-core/src/auth/auth.controller.ts:102–110` → `auth-context/application/services/switch-organization.service.ts:65–87`；`auth/jwt.strategy.ts:20–32`、`auth/auth-session.port.ts:5–7` | 实际切组织服务未带 sid；策略可选接口依赖无显式 token 绑定，声明缺失时可跳过检查。需真实 Nest DI/HTTP/PG 验证，不能把直接 new 的 mock 测试当完整链路。 |
| `libs/api-client/src/api/shipping/http.ts:3–9`、`ships.api.ts:17–39`、`reports.api.ts:6–25`、`report-center.api.ts:29–42` → `libs/ui-shipping/src/components/shipping/ships-page-client.tsx:22–34,44–63`、`report-page.tsx:36–61` | 实际读取失败仍返回演示数据，页面又允许真实写/导出；报表页还直接消费 mock 船舶选择项。生产失败必须诚实不可用，显式 demo 隔离禁写。 |
| `apps/api/src/app.module.ts:73–139`；`libs/domain-shipping/src/index.ts:1–4` | 基线树有航运迁移/导入脚本但未发现 HTTP controller/module 装配；不能把存在迁移表或前端 URL 当真实业务 API 已实现。没有后端提供者的页面只能 unavailable；完整业务样板另项负责。 |
| `libs/app-shared/src/lib/ai/kimi-client.ts:47–49,83–101` 与 `core/patch/gateway.ts:9–26` | 有客户端可达的直接 provider 模块，但未找到 app 实例化消费者或公开模型密钥变量；不声称实际 browser 调用/秘密暴露。保留合成 canary 防回归与无客户端秘密契约，不强迫重建已在服务端的模型链。 |

## What Changes

1. 第三方页面、组件及自由样式进入独立站点 origin 的 sandbox iframe；可信第一方例外必须来自平台审核的来源、完整资源摘要、签名与撤销记录，而非插件自述。
2. 新增封闭、版本化的窄消息桥；严格 origin/source/一次性实例握手和消息限额；查询/提议经平台授权、Registry 唯一工具入口及现有 data-scope，写只在主可信 UI 确认。没有提供者则拒绝，不能用任意 URL/SQL/HTML 代理。
3. 插件停用、撤销、资源变化及身份/安装/版本切换关闭旧桥、清数据；签名覆盖完整资源图，CSP 不代替验签。后端 Node 沙箱原判据不变。
4. **BREAKING（浏览器通道）**：Portal/Console 共用 cookie/BFF 适配契约，HttpOnly、Secure、host-only cookie + CSRF + 固定 upstream；login/SSO/refresh/switch/logout 不返回 bearer 或 refresh secret。复用已有 `auth_sessions`，补必需 DI token、sid 主体/组织匹配和实际切组织入口的原子轮换。
5. 生产航运读取保留真实错误及合法空列表，不自动 mock；demo 为受配置隔离 profile，持续标识且真实写/导出/工具写调用为零；stale 显示原来源时间，按完整 namespace 隔离，不用于生产事实或写版本。
6. 浏览器、桥、导出及后续 ContextEnvelope 交付最小 `DataProvenance`；模型秘密不得进入公开变量、客户端工件、响应或桥。未找到消费者的旧 Kimi/CachedApi 模块仅作清点/拒绝式回归，不列已证实生产事故。

## Impact

Affected specs：`plugin-system`（3 个独立 ADDED）、`session-governance`（2 个入口/浏览器增量 ADDED，正式 spec 尚无此 capability）、`business-data-presentation`（3 个 ADDED）。正式 plugin-system 依赖管理和发现全部保留，不改原条款，故不用 MODIFIED。已有 `add-identity-federation-and-session-governance` 的会话账本、管理员治理、SSO 和 legacy 兼容不重造，只收紧实现入口与浏览器 transport；旧无 sid JWT 的受控非浏览器 API 兼容保留到原到期，浏览器新通道不得据此继续裸 bearer。

实际 owner：`libs/app-shared/src/core/plugins/`，`libs/api-client/src/api/`，`libs/shared-state/src/core/store/`，两个 `apps/web-*/src/app/`，`libs/platform-core/src/auth/`、`auth-context/`、`identity/`，仍位于 `apps/api/src/plugins/` 的插件后端，以及 `libs/ui-shipping/src/`。不把 API 兼容壳当主要实施对象。

相关 changes：`add-plugin-sandbox` 后端已接子进程，补其明确排除的浏览器范围；`add-generic-data-scope-authorization` 的既有授权与范围原语直接复用；`redesign-auth-login-surfaces` 只管观感，不重做布局；`add-blueprint-ui-runtime-consumer` 的现有 UI/权限消费者保留；`kimi-api-configuration` 不扩为本项 provider 功能。01 提供无秘密 DTO 与 Registry 事实，06 提供可信有效 ReleaseContext，07/08 消费 BFF/来源/可信确认，09 消费真实浏览器证据；这些联调可后置，缺能力时对应调用拒绝，不制造前置 published 循环。

### 不做什么

不新建第二套 identity/RLS/data-scope/安装事务，不改 Kernel 确定性、Registry 唯一入口、Blueprint/Delta/单金额库，不实现航运算法或全套缺失 REST，不换 Next/React/Nest/PG/TypeORM/Nx/npm、不重做已有 workspace 拓扑。不执行实现、迁移、apply/archive、部署或服务启动，不读取真实秘密或连接用户库/模型；本次仅编写与格式校验，不改权威 docs/台账。

### 验收出口

批准实施后必须有同源码 SHA、插件 artifactDigest（联合发布时绑定冻结 candidateDigest）的真实浏览器、HTTP/Nest DI 与隔离 PG 正负证据：主 DOM/token/cookie 不可读，origin/source/重放/撤销/摘要漂移/CSRF/身份跨界拒绝无副作用；缺 session provider 不启动或拒绝、实际 switch 后 sid 有效且旧修订失效、并发轮换仅一份成功；生产 401/403/500/网络/无效响应及缺失 API 不冒充成功/演示，合法空列表正常，demo 真实写为零，stale 原采集时间和跨 namespace 清理正确。Node 沙箱、浏览器安全与模型质量证据分别记录；本次未跑浏览器、真库、模型或构建，不宣称通过、已利用或已关闭生产风险。

现有命令核对：两个 app 仅 build/lint/typecheck，无浏览器测试脚本；`@sap/api` 有 test/test:e2e；根 `ci` 指向 `scripts/ci/pipeline.sh`，会跑 `check:all` 和 Jest/test-evidence，但 `.github/workflows/ci.yml:309` 仍有 check:ci 调用；不能以旧 warn-only 线索否定新增统一入口，也不能以 test-evidence 文件替代浏览器实测。新增边界 suite/脚本均待新增，CI 承接 03，不在本项重造。

真实评测缺失始终不得放行自治。候选冻结→真实测试评测→审批→签名未公开工件→最终 GateDecision→published→activation；本项隔离测试不要求先 published。09 必需证据未验收前不据本项文档开放生产新发布或 A1/A2，既有稳定安装的确定性运行不被文档变更停用。
