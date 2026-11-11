# Design: 既有 Agent Host 的同轮上下文与生命周期接线

## Context and boundaries

基线为 weichen `ce1e538dcec6539f66bba80d5413a3b6741486c9`。当前 API 并非全为兼容层：`chat`、`agent-sessions` 的应用实现仍在 API；Registry、MCP、确认位于 `libs/agent-tools`，Release 位于 `libs/platform-release`，身份、范围、事务和 jobs 位于 `libs/platform-core`。保持 Nest DI 与 npm/Nx、PG/TypeORM、既有前端及 Rust/WASM 纯计算边界，不换框架。

已有 `AgentToolMcpBridge` 在进程内连接 MCP client/server，并以 `sapbase/contextId` 一次性取出平台输入（`:69–85,123–147`）。这个 Map 是短时传输引用，不是持久写幂等账本；不必因为 Registry 的 writeCache 有问题而删除可信上下文引用机制。`AGENT_TOOL_TRANSPORT=mcp` 已存在，不把它列为待新增实现。外部宿主部署与 sandbox 仍由已有 Host change 验收，本设计不重新规划其拓扑。

核心不变量：模型不拥有事实、规则、权限或发布权；Registry 是唯一工具执行判定入口；数据范围只收窄；业务写由同一确定性 CommandService；Blueprint、Delta、单金额库、安装事务、PG jobs 与身份边界不重造。数据包装不是提示注入的安全证明。

## Goals / Non-goals

目标是将正式会话接至现有模型端口、可信上下文、MCP/Registry、持久确认/命令和 PG 恢复路径，并用正负例证明各消费者确实接线。非目标是新建通用 Host、Registry、队列或身份系统、实例自进化、业务算法、UI 工作台、eval runner、迁移/部署执行。

## 1. One application path, existing transport

目标路径（接口扩展均待实施）：

`AgentSessionsController → identity/current-app → 06 ReleaseContext → AgentSessionsService → Context Compiler → INTENT_PARSER(Hybrid/provider) → scoped selector → AgentToolMcpBridge → AgentToolRegistry → Query/04 CommandService`。

`POST /api/chat/message` 当前直接调用相同 orchestrator，但只具 optional app context（`chat.controller.ts:34,70–75`）。保留时改为同一安全应用服务的同步投影，不能绕过同轮上下文、预算与确认。明确区分平台只读帮助和应用业务会话：帮助无安装时只能公开可授权帮助，不得调用应用业务工具；生产应用 AI 必须有核验安装/Release。生产 Agent 使用既有 MCP 桥；direct 可作为明确标识的确定性人工兼容/测试适配，但仍经同一 Registry，不得成为 MCP 故障后的隐式生产 Agent 旁路。沿用已有 Host change 的 MCP-only 判据，不另造协议。

扩展 `ChatContext`：只读 `envelope`、可信 `executionContext`、`profile` 和 `turnControl`。`TurnControl` 包含 turnId、stateRevision、deadlineAt、预算接口、AbortSignal、持久事件 sink。敏感身份、权限/令牌及完整执行参数只由平台引用传入，不进入模型 arguments。所有调用仍在网关再次检查，不把 Envelope 快照当永久授权。

MCP 列表由已有 `contracts/tools.json → contracts/mcp-tools.json` 投影派生，不写第二套。当前桥列表只按进程 `AGENT_HOST_PROFILE` 筛选；改为按可信 turn binding 生成每用户/profile/版本的视图。禁止通过模型参数设置 profile 或查询全实例列表。保留网关结构化错误 code/执行状态，不能经桥把 DENIED/CONFLICT/结果未知统一成可重试的普通 400。

## 2. Provider port and honest routing

保留 `IntentParser` 与 Hybrid 规则优先实现，但在实际 ChatModule 注册模型配置/credential resolver/provider adapter 并注入；不靠 `AGENT_LLM_ENABLED` 修改文案。拟 `ModelProviderAdapter.plan()` 输入为固定配置引用、最小 Envelope、冻结意图 schema、输出 token 上限与 TurnControl；输出为结构化意图、实际 usage/来源、provider requestId、模型标识/可得 resolved version、finishReason 和 adapter 版本。

当前 `LlmIntentPlanner` 拼 `/chat/completions`（`:20–49`），只能视为某类兼容协议草案，不能声称支持所有 provider。每个拟启用 provider 必须由已实现且真实验证的 adapter 注册；请求 baseUrl 来自平台批准配置，密钥由 01 服务端引用解出，不存 Envelope/正文/日志/SSE。模型版本固定至 turn 对应 Agent 配置，不能每步随意 findDefault 漂移。供应商不提供不可变版本或 seed 能力时如实记录限制，不承诺位级确定性。

规则命中记录 route=rule、模型调用数零；模型关闭/缺配置/超时记录明确原因并返回不可用/未完成，可引导同权限链的规则查询或人工表单。schema 非法、隐藏工具或权限拒绝不靠换 provider、换工具或临时放宽规则解决。usage 缺失不得填零：验证计数器/保守上界能强制限额时记录来源，否则该 adapter 不可启用。

## 3. Authoritative ContextEnvelope and history

先在短租户事务中取得或创建持久 turn.id，再用它编译 Envelope；消除当前 `randomUUID()` 与持久 turn.id 分离。上下文编译分为：

1. 复用平台 identity 的稳定 userId/org、会话 sid 与有效角色/权限；缺身份拒绝，不用 email/unknown 当主体。启动、确认、恢复及幂等读取重新验证会话/当前权限。当前 JWT 的 Optional 接口注入尚缺端到端证明，需由身份 owner 提供明确 DI token/可信解析接缝及吊销测试，不另建 Agent 登录体系。
2. `X-App-Id` 只提示安装，经 `BusinessAppsService` 组织/active 核验后接 06 的唯一 ReleaseContext。已有安装修订/摘要不得被客户端 body 覆盖；body 旧 appKey/appInstallationId 仅作迁移提示，与 header/平台事实冲突拒绝。恢复现有 conversation 同时校验 user/org/installation，不能用仅 user/org 的 lookup 跨应用复用。
3. 页面 route/entity 属于固定版本 Schema；recordId/selectedIds 经同一 QueryService 与数据范围回读。最小字段、状态、expectedVersion、allowedActions、允许可见权限原因来自平台，客户端 screenContext 仅作候选定位。受禁对象、工具与 Protected 定义不因解释拒绝而泄露。
4. 使用 01 已发布、租户/作用域过滤且固定知识/技能版本检索，不重建知识写治理。保存实际提供片段 entryId/version/digest/source；仅接受实际输入的引用，删除“查询到条目便自动列满参考知识”的路径。无依据如实表示不知道。NULL release 通用条目也需显式平台绑定，不能自动 latest 兜底。
5. PG 读取必要脱敏最近对话/摘要及原 turn/release provenance。历史只解释指代，跨版本当前事实重新查询；历史结果不能授予权限，也不自动升级为长期知识。
6. 工具入选为固定版本绑定 ∩ profile/allowedAgents ∩ agentInvocable ∩ 当前权限 ∩ 相关性/预算。模型获入选工具完整参数 schema/confirmation/timeout/契约摘要；selector 不再从全 catalog 重新选。Registry 继续完整契约与最新授权/范围核验，范围 principal 用稳定 userId，display actor/email 单独记录。角色/组来自平台服务，不伪填模型角色。
7. 保存必要脱敏快照与统一 canonical JSON hash；模型、selector、bridge 引用和真实事件绑定同一 turn/contextHash/安装/Release。知识、业务字段、反馈、外部结果是限长带 source/version/nonce 的数据，碰撞边界转义；不得让内容改变系统提示、schema、URL 白名单或权能。

06 决定固定版本执行资格及 stale/兼容判定；写前安装修订、路由/包摘要或数据代际不再有效时明确 RELEASE_CONTEXT_STALE，新 turn 回读并重确认，不在旧参数上偷偷切版本。07 不拥有第二个 activeRelease resolver。

## 4. Pending action, token and command seam

在既有 turn 存储扩展持久 pendingAction：id/revision、user/org、installation、固定 ReleaseContext 引用、tool/契约摘要、canonical argsDigest、对象 expectedVersion、expiry/status、必要脱敏参数展示和受控敏感参数引用。展示脱敏副本不能直接充当执行参数。

复用 `ConfirmationTokenService` 的 canonical SHA-256、五分钟上限和条件 UPDATE；只补消费谓词的稳定 user/turn/actionRevision/release 绑定。confirm 请求提交 conversationId/turnId/pendingActionId/expectedRevision，平台回读动作与当前授权再签发 opaque token；不接受模型任意 tool/args 自确认。编辑仅接受已声明可编辑参数，经完整校验后 CAS 新 revision、重算摘要、撤销旧 token；旧 token 对旧/新参数均不可执行。TTL 取五分钟、动作 expiry、turn deadline 最小值，不自动续期。

幂等复用 04 持久 Command claim/result。每次先验证身份/会话、请求绑定、参数、最新权限/数据范围和固定版本资格，随后才返回已完成结果。命名空间含 org/user/installation/release/tool，请求摘要绑定 turn/action revision/argsDigest；同 key 不同摘要冲突。当前 HTTP 没接 idempotencyKey，扩 DTO 以前不能把内部 Map 风险称为已利用 HTTP。

首次 DB 写由 04 CommandService 拥有短事务，在其 EntityManager/受控 precondition 接缝中锁定并比较 turn/action 状态、期限/版本资格，条件消费 token，认领/执行命令与 expectedVersion 业务规则、持久结果及业务事件一致提交。可在执行前按 04 预留 claim，但预留不是执行或成功；失败回滚不能留下已消费 token + 无结果的孤儿副作用。07 不自建嵌套业务事务、第二账本或 outbox。与 04/06 冻结统一锁序/接管 fence；不能安全衔接的文件/外部写工具保持不开放，不通过长事务或补偿承诺装作原子。

已完成重连只重新授权后读同一结果，不再消费 token；running/结果未知只查 claim/真实事件并返回进行中或 reconcileRequired，不换 key/tool 自动重写。取消先 CAS 时拒后续认领；命令先提交时保留已执行事实与 cancelled 后续状态，不能宣称 AbortSignal 回滚已提交事实。

01 拥有 Registry 真实生命周期协议；07 仅关联其 sourceEventId/toolCallId/contextHash 与 turn、去重持久投影。计划中的 trace 或 job 成功不是工具执行成功来源。

## 5. Durable budget and existing PG jobs

沿用当前协议默认 8 工具/12000 token/30000ms（`docs/protocols/piagent.md:340`、`libs/agent-kernel/src/index.ts:109–111`），作为兼容起点，不新造 A2 窗口/质量阈值。平台审批策略定义 limits 与 policyVersion。PG 保存累计已耗/预留 token、已认领工具数、deadlineAt；模型调用前保守计入输入并限制输出，结算真实 usage，超预留记录实际值并禁止后续调用。每个工具 timeout 为自身上限与剩余 deadline 最小值，三步循环不能代替预算。

采用绝对 deadline，包括默认策略下确认等待；重连、重启、编辑、幂等命中不重置。30s 可能不足人工确认，作为明确产品取舍提交审批；需要更长 wait 时只能批准版本化预算/wait policy，不暗中停表或无限续期。token/tool 累计仍不重置。

接现有 `JobTypeRegistry/JobQueue/JobWorkerService`，注册白名单 Agent turn 驱动类型（**待新增类型**），payload 只携带平台 turn/run 引用，不携模型身份/代码。入队与 turn 初始/推进状态在同一租户短事务；幂等入队指向同一 turn。worker 的 `JobContext.signal/isCancelled`（`job-types.ts:16–19`）合成 TurnControl 中断，claim 前检查状态/预算/有效 worker lease。Agent 状态留在 turn，job 只是驱动和事件桥，不另造通用队列；等待确认释放执行工作，不长期占 worker。

既有 job lease 回收可能重新 queued（`job-queue.ts:216–224`），Agent handler 必须可重入并先对账。自动重领不授予再次模型/写执行许可，未知写不盲重试；worker/attempt/lease 变化使旧持有者失去 turn 推进资格。候选隔离运行同样受限，不开放任意后台脚本。

## 6. Real-time SSE, CAS and resume protocol

扩展现有 `agent_conversations/agent_turns`，持久必要脱敏 message/Envelope/validatedPlan、pendingAction、预算、job/lease 引用、stateRevision 和事件序号；不再只靠 hash 或缓存 events。turn 可 queued/running/waiting_confirmation/completed，及 cancelled/timed_out/failed/interrupted 终态。状态迁移按可信 org/user/installation + expectedState + stateRevision + 当前驱动资格 CAS，短事务追加事件。终态不得被晚到 completed 覆盖；结果事实可以对账追加，但不抹掉取消。waiting_confirmation 不是 completed。

事件存储复用 PG 事件基建的序号/回放方式，冻结 Agent turn→事件的持久映射；`job_events` 如承载桥接事件仍必须通过会话 user/installation 授权，不能只按 job 的组织过滤当充分条件。Registry 来源事件去重；每帧 `id=turnId:seq`、turnId/stateRevision，至少一次投递，客户端按 id 去重。

实际路径统一使用全局 `/api` 前缀（`apps/api/src/main.ts:61`）：

- 既有 `POST /api/agent/chat` 新 turn body 保留 message/conversationId?/screenContext?，扩 requestId 去重；header X-App-Id 经核验。参数/身份/安装/归属预检后建立 SSE、flush `turn.start`，后续边执行边持久后推送，不等整轮返回数组。设置 X-Conversation-Id/X-Turn-Id 并按 02/08 冻结可读取响应头。
- **待新增** `GET /api/agent/conversations/:id/events?turnId=...&after=...` 支持授权 Last-Event-ID 回放并接实时订阅；游标冲突/越界拒绝。先回放再订阅对拍最大 seq，避免窗口丢事件。恢复不提交新 message/context、不重新执行。
- 既有 `GET /api/agent/conversations/:id` 扩授权分页历史、脱敏计划/动作/usage/cursor；按安装校验，不只最后一轮 toolCalls。
- **待新增** `PATCH /api/agent/conversations/:id/turns/:turnId/actions/:actionId` body `{expectedRevision,argsPatch}`，CAS 更新可编辑参数/返回新摘要及脱敏 diff，409 冲突；正式编辑 UI 归 08。
- 既有 `/api/agent-tools/:name/confirm` 与 `/invoke` 扩 action/turn/revision 引用与确认令牌/幂等键。路由 name 必须匹配动作，执行参数从服务端回读，不新增平行 confirmation HTTP consume 路径。
- 既有 `POST /api/agent/conversations/:id/cancel` 扩 `{turnId,expectedStateRevision}`，同一终态重复取消返回已知结果；CAS 取消桥接 job 中断，阻止后续认领，不误取消“最新”的另一个 turn。

保留 turn.start/text.delta/plan/tool.start/tool.result/turn.end/error；未知事件忽略并记录，完整校验过的封闭 interaction-plan 才能展示，文本不新增 HTML/SQL/URL 能力。慢客户端有界断开，PG 事件可恢复，断线不等同取消。

当前全局 tenant interceptor 包住 `lastValueFrom(next.handle())`。实施需为这些流式/worker 入口显式划分每段租户短事务，保留 withTenantContext/RLS 的 org/app/user 设置；不得仅跳过拦截器导致裸查询，也不得在模型网络、人工等待或 SSE 连接期间保留 DB 事务。

重启从 PG 对账原 turn、预算/deadline、有效版本、job/lease 与命令事实。未过期待确认恢复同一 action revision，不重新跑模型、不自动重签 token；失效动作只可历史展示。running 未知结果转 interrupted/reconcileRequired，确定完成只投影已有事实。Redis/内存仅通知/缓冲，清空不改变授权与执行状态。敏感内容按平台保留策略脱敏/服务端加密引用；沿用既有会话默认七天时不把它当法定审计保留期，过期明确不可恢复。

## 7. Compatibility, risks and exit

迁移为扩展 schema/DTO 与索引/RLS；旧记录标 legacy_unverified，仅保留可授权历史，不回填虚构执行，弱绑定未消费 token 撤销而不是升级有效。既有安装、金额、Blueprint/Delta 结构不变。回退 kill switch 关闭模型/新写动作，保留确定性人工入口与授权历史/结果查询，不能恢复旧弱确认、body 身份或授权前缓存。已提交业务按事实对账，不因会话回退逆转。

风险为 provider usage/version 能力不足、wait 预算太短、MCP 错误语义丢失、范围 actor 与 userId 混用、长事务、job 重领/迟到结果、内容泄露和背压；上述能力验证/稳定主体/短事务/CAS/ledger/保留政策分别处理。外部宿主部署、真实提示注入安全性和完整 sid 吊销尚未实测，不据静态包装声明通过。

验证层次：纯契约与真实 DI；隔离真实 PG/RLS 多实例/故障重启及 Redis 丢失；每个拟启用真实 provider + HTTP/SSE；08 浏览器联调；09 同候选真实评测。现有 @sap/api test/test:e2e 与根 ci 是入口，新 test:runtime-ai-contract/test:runtime-ai-e2e 尚待登记。pipeline 已有严格 check:all 与记录 test-evidence，但 GitHub meta job 仍用 check:ci；统一归 03，不从文档计数或记录文件生成推断测试通过。本次只 validate，无上述实施验收。

为 09 拟提供 `runTurn(ContextBinding,input)` 同链端口：正常用户只接平台有效 Release；隔离 runner 由平台授权解析已冻结 candidateDigest 和基线 release，不要求先 published、不接请求体伪造候选。证据绑定候选→测试/评测→审批→签名未公开工件→最终 GateDecision→published→activation，无循环。真实门禁缺失生产自治始终关闭，本 change 不自行启用 A1/A2。
