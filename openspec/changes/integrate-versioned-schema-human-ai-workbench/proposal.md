# Change: 有效版本蓝图 UI 与人机工作台接线

## Why

本次重新审查固定于 **weichen `ce1e538dcec6539f66bba80d5413a3b6741486c9`**，文档分支 `weichen-ai-native-remediation-20261110` 分支。旧 main 结论仅是复核候选，不是本基线事实。优先级 **P1**，顺序 **08**；本 change 只补现有消费者的版本、参数编辑和协作闭环，不重建 UI Runtime。

weichen 已有正式动态路由及真实 Schema 渲染：`apps/web-portal/src/app/dashboard/apps/[packageId]/[[...page]]/page.tsx:1–13` 调用 `libs/ui-runtime/src/blueprint/BlueprintAppRuntime.tsx`，后者获取 UI/实体/权限并用 SchemaList、SchemaForm 查询和创建真实 Blueprint records（`:130–169`、`:239–272`）。因此删除“没有 Schema 路由/字段渲染/服务端 UI 消费者”的修复任务，只保留回归验收。Page/Form/Collection/Detail 的包装组件仍可供手写页面使用，不要求全部改写成另一套三层 Page→View→Object 引擎。

## 当前已实现与剩余证据

| 新基线落点 | 重新判定与本项剩余范围 |
| --- | --- |
| `libs/platform-release/src/blueprint/blueprint.controller.ts:153–191`；`apps/api/src/blueprint/blueprint.module.ts:1–2` | API 兼容壳转到真实平台库；实体/UI/权限通过真实装载器获取，签名、授权和编译链保留。当前读取按 URL packageId + tenant，不是安装有效版本读取接口。 |
| `BlueprintAppRuntime.tsx:125–155`、`:162–176`、`:203–272` | 动态 UI 已存在；无效 pageId 会选第一可访问页，权限请求任意失败被 catch 成 null，字段映射简化且未消费 page.fields，记录只保留 data 丢失 id/version/omittedFields，详情选中跨页面被清空。收紧精确路由、字段投影、记录信封与错误语义。 |
| `libs/ui-runtime/src/schema/resolver.ts:105–125` | basename 静态缓存仍在，但全仓调用检索未找到正式路由调用 resolvePage；不能称为已证实生产缓存串租户。本项为正式消费者建立完整 namespace，不修复未用解析器后再声称工作台完成。 |
| `libs/app-shared/src/core/patch/patch-manager.ts:88–118`、`:243–261` | 本地 executor 返回副本，manager 只存版本/失效，批量失败注释未做回滚；未找到正式页面构造 PatchManager，旧离线复现不计本次实测。仅限制其未来工作台适配，不把它描述为当前生产热改入口。 |
| `apps/api/src/ai-modules/ai-modules.service.ts:179–241`；`definition-patch.service.ts:59`、`:379–431` | 已有服务端应用、持久定义、版本递增、重编译，**五类 scope 均支持**，reorder/replace 明确拒绝。旧 pending `add-ai-patch-recompile` 的“仅 object/state”文本已落后于代码；不新增 scope 扩展任务。本项只补授权草稿/CAS/批量原子适配，不再造编译器。 |
| `apps/web-portal/src/app/dashboard/piagent/page.tsx:24–55`、`:89–94`；`libs/app-shared/src/features/chat/components/chat-page.tsx:50–58`、`:74–98` | 前者只有 message、事件 JSON；后者是本地单轮 PlanRenderer，edit 空返回、cancel 仅关闭面板。一个有状态/当前页工作台仍未接通。 |
| `libs/api-client/src/core/interaction/plan-decision.ts:112–175`；`libs/platform-core/src/common/protocol/chat-protocol-validator.ts:74–92`、`:148–155` | 客户端仅 kind/confirm-tool 准入；服务器已有 JSON Schema 与部分跨字段检查。补同一冻结协议的完整客户端验证和共同拒绝集，不否定已有封闭 Renderer。 |
| `apps/api/src/app.module.ts:104–139`；`libs/domain-shipping/src/index.ts:1–4`；`libs/api-client/src/api/shipping/ships.api.ts:17–39` | 当前组合根未注册船舶 CRUD；航运域导出迁移/脚本；前端仍消费 /api/shipping/ships，GET fallback 见 http.ts:3–9。仅静态未发现该后端链，不推导实际部署不存在或已发生越权。船舶样板必须先批准真实对象绑定。 |
| `apps/api/src/semantic-runtime/semantic-runtime.service.ts:641–726`；`apps/api/src/agent-tools/agent-tools.module.ts:44–82` | 语义查询已有权限、ownership、dataScope；Registry 真实 DI 无船舶写适配器。本项消费既有拒绝边界和 04 共享命令，不能绕过数据范围或自建 AI CRUD。 |

本次仅静态阅读、调用链/包配置核对与 OpenSpec 格式验证；未运行真实 PostgreSQL、模型、浏览器、服务或业务测试，未复用 main 的探针、诊断数或测试数字。新锁文件记录 Next 15.5.12、React 18.3.1、Nest core 10.4.22、TypeORM 0.3.28、jsonschema 1.5.0；不是本次运行环境验收。

## What Changes

- 新增 `schema-workbench` 的**集成缺口**条款：复用已存在 blueprint-ui/v1 + compiled entities + permissions，route 与查询/动作绑定同一可信组织、安装修订和有效 releaseDigest；独立授权候选使用 candidateDigest，不要求先 published。
- 精确消费现有 page.identifier/route/fields，保留 RecordEnvelope 的 id/version/omittedFields，显示真正的单条详情与错误；不把权限 403/500 当成“无权限层”，不把未知字段类型静默变成 text。
- 同冻结 JSON Schema 和共享纯跨字段检查驱动前后端计划/字段验证；协议扩展先审批，旧 edit 无可信关联只读回放，业务金额与规则仍属确定性内核。
- 复用现有 PlanRenderer，整合成**一个当前页壳层** conversation 工作台；独立 chat/piagent 页只作历史/Builder/兼容入口，不重造已有 pending change 的壳、布局、selection、三态和 dirty 基础能力。
- edit 真正修改授权 args，消费 07 的修订/确认接口；实际命令成功才同步数据，保留 dirty 输入并拒绝旧对象/旧 release 提交。
- **BREAKING**：工作台 Patch“应用”只表示平台草稿提交，不能表示生产生效；MODIFIED 完整保留正式 Publish Pipeline 两个原场景，增加有序累计、CAS/事务批量修订。复用五类 scope 纯应用与既有 Delta/草稿生命周期，不支持的 operation 继续明确拒绝。
- 船舶 name 查询/修改作为低风险隔离样板；先冻结与真实业务事实对应的查询/Command binding，若复用 semantic Ship Blueprint，须业务负责人批准其数据映射，禁止把 mock 或另造示例事实冒充现有航运数据。若保留 /api/shipping/ships，必须由实际 owner 提供后端并接受相同边界验收。

## 前置与既有 changes 分工

| 依赖 | 本项消费的边界 |
| --- | --- |
| `harden-browser-plugin-and-data-boundaries` | 第一方壳、Cookie/BFF/CSRF、live/stale/demo/unavailable；本项不实施凭据迁移或插件隔离。 |
| `enforce-deterministic-business-command-invariants` | 查询、expectedVersion、共享 Command 与对象事件；不定义金额/库存/流程算法。 |
| `harden-approved-release-artifact-integrity` | 可信草稿、expectedRevision、Delta 应用与 candidateDigest；Patch 适配不另建审批/冻结/编译生命周期。 |
| `unify-effective-release-activation-and-recovery` | 唯一可信 ReleaseContext/安装修订；本项不重做安装事务/灰度/回退。 |
| `connect-runtime-ai-context-and-tool-lifecycle` | ContextEnvelope、pendingAction 修订、Registry 确认/调用、实时 SSE/history/取消；本项不重写服务端模型/预算状态机。 |
| `add-blueprint-ui-runtime-consumer` | 保留已落地 UI 消费资产；本项仅收紧其有效版本与记录上下文。 |
| `enhance-ui-runtime-scenario-capabilities` | 复用 selection、dirty、三态和工作台原语，补事件/有效版本触发的集成验收，不重造基础条款。 |
| `enhance-piagent-help-and-action-shell` | 复用当前页壳入口；本项统一数据/会话消费者，不扩答疑知识或另造浮层。 |

`add-ai-patch-recompile`、`migrate-schema-system-from-legacy`、`add-chat-first-erp` 和 workspace split 保持原资产及完成状态；仅登记此处补充关系，不修改其它 change。上述依赖是接口/联合验收前置，不阻止前端在隔离契约桩上开发；桩不得计真实验收。本项输出供 09 消费，09 是后置验收，不设为本项开发前置，避免循环。

## Impact / Non-Goals

影响 `libs/ui-runtime` 的 BlueprintAppRuntime/SchemaForm、`libs/api-client` 的协议/HTTP适配、`libs/app-shared` 的 PlanRenderer/chat/Patch适配、`libs/ui-layout` 的壳接线、`apps/web-portal` 的动态路由，及 `apps/api` 中会话/AI模块/语义适配与 `libs/platform-release` 读取端口。capabilities 为 `schema-workbench`、`patch-dsl-system`；新增端口只是待批准设计，不是存在性声明。

保留 Next/React/Nest/PG/TypeORM/Nx/npm 和现有拓扑，不更换技术栈，不强迫四类包装 Runtime 全量重做，不复制 Page/View/Object、Blueprint、Delta、金额库、PG jobs/identity/dataScope 或安装事务。Kernel 不依赖模型；Agent 只经 Registry、平台授权与确认操作，不接 SQL/HTML/任意URL/源码热改。不实现评测 runner、签名/激活、自治或部署。本次不 apply/archive/commit/push/PR，不改业务代码、权威 docs、lockfiles 或台账。

## 可验收退出条件

真实路由/查询/turn 必须使用同一可信有效 namespace，旧包不能旁路，新增已支持字段无新字段 JSX；权限请求失败、非法定义和不支持操作不冒充成功。两端保存相同协议摘要及逐例正负断言。真实浏览器经 HTTP/SSE/模型/Registry/共享 Command 完成“这艘船”、编辑新修订重确认、并发冲突、dirty 保留、查询同步、取消与恢复；船舶真实 owner/dataScope/RLS 未就绪则阻塞。

真实 PostgreSQL 证明批量 Patch 累计、全有或全无、旧 revision 拒绝与持久重放，生产 digest 不因草稿改变。证据记录 candidateDigest、基线 releaseDigest、安装修订、代码 SHA、suiteVersion、协议/验证器版本、实际服务/模型/浏览器/PG版本、用例/断言数量和失败/skip/unavailable；空套件、mock、缺服务不计 PASS。09 汇总真实测试评测 → 审批 → 签名未公开工件 → 最终 GateDecision → published → activation，不要求先发布才能预览评测。所有生产新发布/A1/A2 放行依赖真实门禁，不因本提案或格式验证关闭；已安装稳定版本仍可受控确定性运行。汽配交易验收只消费 04 的完整窄切片。所有 tasks 本次均未完成。
