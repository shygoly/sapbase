# Change: 接通既有 Agent Host 的权威上下文与可恢复工具生命周期

## Why

本 change 基于 **weichen `ce1e538dcec6539f66bba80d5413a3b6741486c9`** 重新审查，推进位置 **07**，优先级 **P1；确认、授权与取消的剩余缺口是生产 AI 写入的阻断条件**。不是旧 main 结论的路径替换，也不是实施报告。业务 Kernel SHALL 保持确定性；模型只在外围 Agent Host 理解与提议，不引入设计时 Jev 或新的业务执行引擎。

实际入口是 `apps/api/src/app.module.ts:129–135` 装配的 `AgentSessionsModule/ChatModule/AgentToolsModule`。`apps/api/src/agent-tools/agent-tool.registry.ts:1–2`、`mcp/agent-tool-mcp.bridge.ts:1–2` 是兼容导出；真实执行与桥在 `libs/agent-tools/src/`。本 change 不重建已存在的 MCP 投影、桥、Registry、平台身份、数据范围或 PG jobs，只补这些资产在正式会话中的接线与验收。

### 当前已实现与剩余证据

| 新基线事实 | 精确证据与消费者 | 本次取舍 |
|---|---|---|
| 内嵌 MCP 桥已接入编排器，可信上下文按一次性引用传递 | `apps/api/src/chat/chat-orchestrator.ts:18–21,59–75`；`libs/agent-tools/src/mcp/agent-tool-mcp.bridge.ts:69–85,119–147` | 保留桥；不再提出“新增 Host/MCP 基建”。默认仍为 direct，生产启用与端到端语义待验收，未证明外部宿主已部署。 |
| MCP 按进程 profile 收窄、Registry 执行 allowedAgents 与数据范围守卫 | `libs/agent-tools/src/mcp/agent-tool-mcp.bridge.ts:173–184`；`libs/agent-tools/src/agent-tool.registry.ts:121,139–140,202–225`；`apps/api/src/agent-tools/agent-tools.module.ts:43–81` | 保留现有判定；补每 turn 的可信用户/版本子集，不能把进程 profile 列表当用户授权。范围主体当前使用 actor，而 HTTP actor 常为 email，需传稳定平台 userId。 |
| 默认意图仍只注入规则 | `apps/api/src/chat/chat.module.ts:13–16`；`hybrid-intent-parser.ts:11–14`；`llm-intent-planner.ts:16–49` | 接真实 Hybrid/provider。已有模型规划源码及超时不能当生产 DI、usage 或协议验证。 |
| Envelope 编译后只存 hash，执行没有拿到它 | `apps/api/src/agent-sessions/agent-sessions.service.ts:58–108` | 补同 turnId、可信安装/有效 Release、页面对象回读、历史与实际检索。当前 Envelope 随机 turnId 与随后持久 turn.id 分离也要消除。 |
| 平台安装上下文已有核验，但正式会话尚未消费 | `apps/api/src/business-apps/optional-app-context.guard.ts:16–36`、`business-apps.service.ts:270–288`；会话控制器 `:39–48` 取 body 安装 | 复用安装服务，接 06 有效版本接口；不重造安装事务。前端已发 X-App-Id（`apps/web-portal/src/app/dashboard/piagent/page.tsx:29–33`），不能再说前端完全没有安装 header。 |
| 规范参数摘要、五分钟 TTL、组织/安装/工具绑定和条件一次性消费存在 | `libs/agent-tools/src/confirmation-token.service.ts:14–33,59–105` | 删除重做这几项的修复任务；只扩稳定 user/turn/pendingAction/release 绑定、修订与原子命令接缝，保留并发回归验收。 |
| 写幂等 Map 仍先于权限与范围，HTTP 当前不传该 key | `libs/agent-tools/src/agent-tool.registry.ts:125–140`；`apps/api/src/agent-tools/agent-tools.controller.ts:54–65` | 接 04 持久 claim/result 且命中仍授权；仅静态发现，不声称已利用 HTTP。 |
| 工具成功仍从 plan.trace 推测 | `apps/api/src/agent-sessions/agent-sessions.service.ts:119–136` | 事实边界整改归 01；07 只消费它的真实生命周期和关联，不新建第二套审计规则。 |
| SSE 缓冲到结束、取消没有中断/CAS、PG 只存有限元数据 | 控制器 `:39–58`；会话服务 `:140–153,193–205`；`entities/agent-turn.entity.ts:18–37` | 补实时持久事件、CAS 和必要脱敏内容；不复用旧离线竞态复现数字。 |
| PG jobs 与 identity 已有真实模块，不等于 Agent 已接入 | `libs/platform-core/src/jobs/jobs.module.ts:16–37`、`job-types.ts:10–22`；`libs/platform-core/src/auth/auth.module.ts:16–17,34` | 复用 jobs 驱动/中断和 identity 身份解析。JWT sid 校验仍是 Optional 接口注入（`jwt.strategy.ts:20,30–32`），不能凭 identity 模块存在宣称 Agent 吊销已验证。 |

以上仅为源码/DI/路由/现有规格静态复核；没有运行真实 PG、Redis、模型、HTTP 或浏览器，没有安装、迁移、服务启动或部署。OpenSpec 校验只证明提案格式。

## What Changes

- 将 `INTENT_PARSER` 真实接至既有 Hybrid 与服务端 provider adapter；规则快路和显式不可用路由可观测，密钥只走 01 服务端引用，协议/版本/usage 不用旗标或占位模拟。
- 以持久 turn.id 编译同一 ContextEnvelope，贯通模型、selector、既有 MCP 引用桥与 Registry。可信身份/安装/有效版本来自平台；页面、记录版本、allowedActions/可见权限原因通过查询服务回读；历史与已发布知识只使用实际裁剪输入及版本来源。
- 将既有 profile 收窄扩为每 turn 的用户权限、agentInvocable、allowedAgents、有效版本绑定与相关性子集；保留 Registry all-of 和数据范围判定。不可信内容仅为数据，不能扩大 SQL/HTML/URL、宿主或发布能力。
- 在既有确认机制上持久化 pendingAction 修订；稳定用户、turn、安装、Release、tool/契约摘要、argsDigest、expiry 全绑定；编辑服务端重算并撤旧确认。复用 04 短事务命令及持久幂等，结果未知不得自动重写。
- 共享持久累计 token/tool/deadline 与 AbortSignal；接既有 PG jobs 的驱动/取消接缝，Agent 自己拥有 turn 状态，不能由 job.succeeded 推定 Agent 或业务成功。
- 实时 SSE、PG CAS、授权游标、断线/重启恢复同 turn/待确认动作、脱敏内容和真实 usage 接通。每段 DB 工作保留事务内 RLS；模型网络与 SSE 等待不得留在全请求长事务中（`libs/platform-core/src/common/transaction/tenant-transaction.interceptor.ts:35–40`）。
- **BREAKING**：生产应用 AI 会话要求经核验的稳定用户、安装及有效 Release；旧弱绑定令牌不可迁移为可执行新确认。body 安装提示与 X-App-Id 冲突拒绝；同会话换安装、旧 action 修订与越界恢复游标拒绝。兼容入口不保留弱授权执行旁路。

## Dependencies and sequencing

硬前置接口如下，缺失时相关能力为 `unavailable`，不是自动 PASS：

1. `fix-ai-trust-and-execution-evidence`：安全模型凭据/知识来源、真实 Registry 生命周期；生产自治关闭。
2. `harden-browser-plugin-and-data-boundaries`：可信会话/CSRF、真实数据来源，配合既有 identity 完成 Agent 入口与吊销验收。
3. `restore-reproducible-build-and-quality-gates`：实际 workspace、依赖、RLS readiness 和严格 CI 证据入口。
4. `enforce-deterministic-business-command-invariants`：统一 CommandService、expectedVersion、同 EntityManager 的确认前置接缝和持久 claim/result。
5. `unify-effective-release-activation-and-recovery`：唯一 ReleaseContext、安装修订/cohort 资格及固定版本消费。

上述是联合执行/验收依赖，不阻断模型 adapter、纯协议、只读隔离路径的前段开发。无需等待已有 `add-agent-host-and-instance-evolution` 全部外部宿主/实例进化任务；07 补它已实现桥的用户上下文，不接管进化。08 消费本协议建设工作台；09 使用同链入口，平台可解析冻结 **candidateDigest** 的隔离测试绑定，不能要求候选先 published。最终放行顺序为候选冻结 → 真实测试/评测 → 审批 → 签名未公开工件 → 最终 GateDecision → published → activation。

## Impact

规格仅涉及 `piagent-runtime`、`chat-erp` 的独立接线验收增量。新基线正式 `openspec/specs/` 尚无这两个能力，因此使用 **ADDED**，不伪造 MODIFIED 原条款。既有 pending `add-piagent-runtime-context-and-session`、`add-chat-first-erp`、`refactor-ai-native-business-app-platform/specs/agent-runtime` 已覆盖一般会话/预算/工具规则；本提案只收紧实际遗漏的消费者和失败验收，不重抄协议，不改它们任务状态。

拟实施 owner：`apps/api/src/chat/**`、`apps/api/src/agent-sessions/**` 的装配/应用服务；`libs/agent-tools/src/**` 的桥/确认与命令适配；`libs/agent-kernel/src/index.ts` 的纯上下文/预算契约；平台身份、jobs、事务接缝复用 `libs/platform-core/src/`，有效版本复用 `libs/platform-release/src/`。正式 UI 归 08，本 change 只冻结 HTTP/SSE/修订/确认/取消/恢复协议。

不做：替换技术栈、重建 Host/MCP/Registry/PG jobs/identity/data-scope/安装事务、引入旧 workflow 引擎、改金额库/Blueprint/Delta、开放 SQL/shell/发布/审批/激活工具、部署外部 OpenClaw、实现 Builder/A2、另造 eval runner 或正式前端。全局架构解释及权威 docs 更新按 00/各 owner 在实施后处理，本次不改它们。

## Acceptance exit

批准后必须获得：实际 Nest DI + 每个拟启用 provider 的真实请求/版本/usage；同一 Envelope/turn/安装/有效版本贯通；跨用户/安装/版本/权限、恶意文本、改参数重确认负例；真实 PG 多实例一次性消费/撤权幂等/取消提交竞态；PG 及进程重建、Redis 丢失、待确认恢复；阻塞模型完成前可见首 SSE、断线游标与背压；08 浏览器联调，以及交给 09 的同 candidateDigest 实际事件。写入越权与未确认执行必须为零。保留原封闭 interaction-plan 整份拒绝及只读优先判据。

现有命令核对为 `npm run test --workspace @sap/api`、`npm run test:e2e --workspace @sap/api`、根 `npm run ci`。新增 `test:runtime-ai-contract` / `test:runtime-ai-e2e` 是**待新增命令**，尚不能宣称可运行。根 `check:ci` 仍 warn-only（`package.json:27`），但统一 pipeline 已执行 `check:all`（`scripts/ci/pipeline.sh:2–9`），`.github/workflows/ci.yml:309` 仍另调 warn-only；不能把所有 CI 概括为同一个入口，收敛归 03。

报告必须记录实际基线 SHA、suite/case/断言、失败/skipped/unavailable、模型/provider/adapter/工具/知识/技能版本、PG/Redis/Node 版本及脱敏证据。缺依赖、仅 mock、零断言或预检失败不得 PASS。业务、安全、平台共同审阅隔离验收；09 真实门禁未完成前不得据本提案开放生产新发布/A1/A2，已安装稳定版本可继续确定性运行，A2 还等待 10 的批准政策。
