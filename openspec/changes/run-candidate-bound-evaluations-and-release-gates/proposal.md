# Change: 冻结候选真实评测、隔离预览与完整发布闸门

## Why

本次重新审查基线为 **weichen `ce1e538dcec6539f66bba80d5413a3b6741486c9`**。旧 main 评估仅是复核候选，不是本提案的事实依据。实际发布治理位于 `libs/platform-release`，`apps/api` 通过 DI 注入真实评测和测试证据端口；已有真实 Blueprint 编译、默认 Jest 执行、测试证据采集/缓存、MCP→Registry 工具桥和通用 Blueprint UI 消费者，不应重造或否定这些资产。

剩余问题仍足以阻断生产准入：`AgentEvalService.run` 只计数调用方 `caseResults`；G5 聚合历史 run 且按第一条 suite 判分；G4 新缓存只按组织/app/时间匹配，不验证成功、源码或候选；G6 接收非空 URL；G2/G3 读自述风险/回退字段；`validate` 允许 pending，而 publish 未消费验证结果。平台必须证明“这一份冻结候选实际执行过哪些断言”，而非把作者、模型或有验证权限用户的自述当执行证据。

## What Changes

### 顺序、优先级与依赖

- 顺序 `09`；**P0 发布阻断 / P1 评测基础**。候选 runner、回执格式和拒绝集可隔离开发；完整生产链联合验收后置，不能要求前段先 published 或先通过所有后段闸门。
- 前置接口：`restore-reproducible-build-and-quality-gates`（03 受控执行器）、`enforce-deterministic-business-command-invariants`（04 确定性命令）、`harden-approved-release-artifact-integrity`（05 冻结候选/审批/签名）、`connect-runtime-ai-context-and-tool-lifecycle`（07 正式模型/会话/真实工具事件）、`integrate-versioned-schema-human-ai-workbench`（08 正式页面）。
- 新增明确联合验收依赖：`unify-effective-release-activation-and-recovery`（06 影子迁移/兼容账本读取及安装隔离）。该接口依赖不阻断 03/04/05 或本主题前段的隔离开发，也不把 activation 当评测前置。

### 当前已实现与剩余证据

| 实际消费者与新基线证据 | 当前资产 | 本提案只收紧的缺口 |
| --- | --- | --- |
| `apps/api/src/app.module.ts:131-137`、`apps/api/src/releases/releases.module.ts:57-65,101-114` | 已装配发布库、评测及证据服务；API 发布服务是兼容导出 | 继续由应用装配端口，禁止库反向依赖 apps |
| `apps/api/src/agent-eval/agent-eval.service.ts:35-43,50-98`、`apps/api/src/agent-eval/entities/agent-eval-run.entity.ts:9-34` | 七类种子与 runs 存储，已加 modelId | 真实 runner、冻结候选/套件/模型绑定、逐例断言与作用域查询；modelId 存在不等于实跑版本 |
| `libs/platform-release/src/releases/release-validation.service.ts:61-82,188-192` | Agent 变更无记录会拒绝；模型 ID 存在性检查 | 删除自报 eval 快路，按完整 suite 逐例判分，不拼接不同版本/失败历史或使用 baseRelease 代替候选 |
| `scripts/ci/record-test-evidence.mjs:15-40,46-55`、`libs/platform-release/src/releases/release-test-evidence.service.ts:27-46` | Jest JSON 摘要与测试证据 API/缓存真实存在 | 认证执行器、完整报告验证、候选映射、成功及实际断言判据；不再仅凭“新鲜”复用 |
| `libs/platform-release/src/releases/release-validation.service.ts:85-119,139-176` | G0 实际跑严格 check-all，G1 真编译，G4 默认真 Jest | 绑定冻结输入；禁用 G4/零断言/缺前置不通过；不能说 G0 直接使用 warn-only |
| `libs/platform-release/src/releases/release-validation.service.ts:46-58,123-136` | G0–G8 状态结构存在 | 真实 diff 必需集合、真实权限/迁移证据、阶段状态与最终 fail-closed 判决 |
| `libs/platform-release/src/releases/releases.service.ts:165-192,300-368` | validateProposal 消费 validator，publish 独立保存 published | 给 05 提供不可绕过的 GateDecision 消费契约，不重复实施审批/签名 |
| `libs/platform-release/src/releases/releases.service.ts:529-567`、`libs/platform-release/src/releases/releases.controller.ts:335-343` | HMAC 预览 token 签发/组织校验；API 当前只返回 claims | 未发布候选隔离加载、当前用户/作用域/撤销校验与真实 browser 冒烟；URL/claims 本身不作证据 |
| `apps/web-console/src/app/admin/releases/[id]/preview/page.tsx:39-54,97-149` | 发布详情/changelog 对比 UI | 不是候选业务页面或真实数据执行；复用正式 UI，不把对比页当 G6 |
| `libs/ui-runtime/src/blueprint/BlueprintAppRuntime.tsx:98-169,239-265`、`apps/web-portal/src/app/dashboard/apps/[packageId]/[[...page]]/page.tsx:1-13` | 已有菜单/list/form/detail 与 records API 消费 | 删除“新建通用 UI 消费者”任务；仅接候选 namespace 与 08 完成后的确认/版本契约 |
| `libs/agent-tools/src/mcp/agent-tool-mcp.bridge.ts:70-85,119-141`、`apps/api/src/chat/chat.module.ts:13-17` | 已有 MCP/direct→同 Registry；当前正式 parser 仍规则实现 | 评测复用 07 的模型接线和真实事件；不把 MCP 桥或 env modelId 当生产模型评测 |
| `libs/platform-core/src/jobs/jobs.service.ts:56-121`、`libs/platform-core/src/jobs/job-queue.ts:237-279` | 已有 PG job 白名单、可信组织、领取/租约/取消 | 注册候选评测 handler 与不可变 evidence ledger，不再新建通用 job 系统 |

### 核心变化

1. 在冻结、未公开的 `candidateDigest` 上执行生产同构 AgentHost/Context/Registry/Command 链；不接调用方通过数组，不要求已 published Release。首次发布使用平台明确的空基线政策。
2. 保留七套件与写越权/未确认零容忍、注入安全套件全通过；补真实逐例事件、必测清单、参数/引用/多轮/取消/恢复/预算 oracle。空集、缺例、混版本、全失败 FAQ 不准入；一般阈值、分母、退化算法须版本化批准，不复制无依据数字。
3. 复用并加固 `app_release_test_evidence`：报告来源、源码/环境/候选映射、必需及实际断言、成功/失败/跳过/不可用均可验证；拒绝未来时间、自报 success、摘要附件或旧缓存自动绿灯。
4. 平台重算 diff 决定 G0–G8 必需集合，各闸绑定同候选与政策。真实权限差异、影子迁移/兼容、测试、模型评测、正式预览形成 G0–G6；missing/unavailable/skipped/pending 不能作为最终通过，notApplicable 只能平台推导并审计。
5. 顺序为 **冻结候选 → 真实测试/评测/隔离预览 → 批准 → 签名未公开工件 → 最终 GateDecision → published → activation**。09 不拥有批准/publish/activate 权限；G8 不等待 published 事件，避免循环。
6. **BREAKING**：旧 `caseResults/eval.passed/previewUrl` 和普通权限用户上传的 test-evidence 仅能作为历史说明，不能成为发布证据。保留历史查询兼容与组织授权，标来源未知/自报不可准入，重跑新候选。
7. 实施验收前生产新发布 fail-closed，A1/A2 生产治理闭环不得因文档或测试替身开放；已安装有效且未吊销的稳定版本可继续确定性服务。通过 09 也不独立授予 A2 资格。

## Impact

### 能力与既有提案关系

新增独立的证据约束使用 `agent-eval`（3 条）与 `release-validation`（4 条）。weichen 正式 `openspec/specs` 尚无这两个能力，因此使用 **ADDED**；不对不存在的正式条款使用 MODIFIED，不复制一般生命周期和通用 UI 功能。

- `add-agent-knowledge-and-eval` 已定义七套件、逐例历史、硬安全门槛和回归；本提案只补可信 runner、候选绑定和完整判分，保留适用安全判据。其 `releaseId + skillVersion`、强制 seed 与 G5 warn 回退设计须在实施时协调为本提案的无循环、诚实可重复性及 fail-closed 契约；95%/90%/2% 作为历史策略依据需重新批准量纲/分母，而非默认生产阈值。
- `add-release-lifecycle-and-activation` 已定义 G0–G8、preview 隔离和业务 changelog；本提案仅补实际证据、阶段判决与候选访问，保留已发布 preview 查询。05 负责冻结/批准/完整签名和发布事务，06 负责有效版本/激活/兼容账本；09 消费回执并作最终门禁，不重造这些 owner。
- `add-agent-host-and-instance-evolution`、`add-blueprint-ui-runtime-consumer`、`refactor-app-workspace-split-and-platform-base` 的 MCP/实例/consumer/PG jobs/test-evidence 拓扑保持；不把 pending change 完成标记当真实生产验收。
- 03 修 CI 入口与真库前置：`package.json:26-27,46-48` 有严格 `check:all` 与独立 `ci` pipeline，也仍有 warn-only `check:ci`；`.github/workflows/ci.yml:307-309` 实际调用后者，而 `scripts/ci/pipeline.sh:5` 调前者。本提案只要求接收诚实、候选绑定的执行证据，不重建统一 CI。

### 不做什么

本次仅编写提案，不 apply/迁移/启动/部署，不改业务代码、权威 docs、其它 change 或正式 specs。技术栈保留 Nest/TypeScript、PG/TypeORM、Next/React、Nx/npm；Redis 是可丢缓存/唤醒，PG 是 job/证据真源。Kernel 保持确定性，模型只在 Agent Host；工具唯一入口 Registry，MCP 仅传输；保留现有 Blueprint/Delta/金额库及许可/验签判据，不增新流程引擎或 ORM，不运行真实用户库/模型。

### 可验收出口

经批准的非空套件与政策在真实隔离 PostgreSQL、实际生产同构模型/provider、正式 browser 工作台执行，同候选生成完整逐例、测试、迁移与 G0–G8 回执。负例须证明自报/空/缺/混版本/失败缓存/禁测/伪不适用/漂移/撤销/越域/无前置均拒绝，且无 published 或生产数据副作用。05/06 联合验证批准与签名内容匹配、最终消费重新鉴权及代次核验；独立负责人审核真实证据后才允许逐候选生产发布。自治仍依 10 后置验收，不以 OpenSpec validation 代替生产放行。

本次只执行源码/路由/DI/规格静态复核与 OpenSpec 严格格式校验；未运行 Jest、真库、Redis、模型、HTTP/SSE、browser、迁移或部署，未证实实际漏洞利用或实施通过，未复用 main 的测试数字。
