# Change: 冻结实际控制面边界与保留技术栈的架构契约

## Why

本提案重新审查基线为 `ce1e538dcec6539f66bba80d5413a3b6741486c9`，文档分支为 `weichen-ai-native-remediation-20261110` 分支。旧 main 评估仅提供复核候选，不作为本基线事实。weichen 已实际拆分 `apps/api`、`apps/web-portal`、`apps/web-console` 与平台/工具/UI 库；不能继续把它们描述为未落地的架构图。仍需冻结的是跨层授权、最小 DI 端口、候选证据与运行版本的不同真源，以及故障不改变执行规则的接口契约，而不是重新迁目录。

`openspec/project.md:109` 允许运行时 AI 以 Agent Host 存在，`:121` 又笼统限制 LLM 只在设计/编译时；`docs/META_LANGUAGE.md:315` 的不变量是生产 Runtime 不含设计时 Jev，不是禁止受控 Host 调用模型。本项拟澄清“业务 Kernel 的事实、规则、授权与提交不依赖模型”，保留 Jev 隔离与平台判定权。

### 顺序、优先级与前置

- change-id：`refactor-ai-native-control-plane-boundaries`；顺序 **00**；优先级 **架构契约基线**，不是所有旧发现均为 P0。
- `depends_on=[]`。既有平台拆分、AgentHost、身份/数据范围/PG jobs 与发布 changes 是兼容背景，不作需要再实现的前置。
- 本项批准即可支持下游隔离开发。真实模型、真库、浏览器、制品和评测的联合验收后置；缺这些生产必需证据不得用文档批准、替身或格式校验放行生产自治。

### 当前已实现与剩余证据

| weichen 的精确代码证据 | 本项取舍 |
| --- | --- |
| `apps/api/src/app.module.ts:65–71,104–138`；`apps/api/src/agent-tools/agent-tool.registry.ts:1–2`；`apps/api/src/releases/releases.service.ts:1–2` | API 是组合根加尚未迁出的应用模块，兼容壳转到真实库。删除旧物理拆分修复，不再迁整个 API。 |
| `apps/api/src/semantic-runtime/semantic-runtime.service.ts:1–99,189–198`；`apps/api/src/semantic-runtime/semantic-runtime.module.ts:17–35` | 业务规则/事务/数据范围链没有注入模型或 Agent；保护已有确定性内核，不宣称本次跑过业务不变量测试。 |
| `apps/api/src/chat/chat.module.ts:12–17`；`apps/api/src/chat/chat-orchestrator.ts:49–75` | 当前 DI 仍为规则解析器。Host 的读执行走 Registry/桥，确认型写仅产计划；真实模型接线归 07，不删除正确边界。 |
| `libs/agent-tools/src/mcp/agent-tool-mcp.bridge.ts:70–85,98–105,119–140,180–184` | 新增的是可选内存 MCP 桥，direct 与 MCP 均委托同一网关；不是已验证的外部宿主部署。列表用进程级 profile，调用用上下文默认 profile，需由可信主体贯通，而非再造 MCP。 |
| `libs/agent-tools/src/agent-tool.registry.ts:74–88,119–140,250–255,315–362`；`apps/api/src/agent-tools/agent-tools.module.ts:45–82` | 已有反馈/模块窄端口及 DataScopeGuard；Registry 仍注入完整 ReleasesService。只收窄为提议/候选端口并检查 DI，不声称 Builder 已能发布或已利用旁路。 |
| `libs/platform-release/src/releases/releases.controller.ts:141–155,176–205` | 权限守卫存在，但审批职责取 body.role，发布接独立 manifest；可信人类职责与平台发布权限须分别处理。具体批准/签名修复归 05。 |
| `libs/platform-release/src/releases/release-validation.service.ts:46–58,61–82,139–176`；`libs/platform-release/src/releases/release-test-evidence.service.ts:27–46` | G4 已有测试执行/缓存证据，不再称完全未执行；新缓存只按 org/app/时间，不绑定候选，关闭执行可标 passed，G5 自报与 G6 URL 仍不足。这里只定义证据生产者/拒绝端口，runner 归 09。 |
| `apps/api/src/business-apps/business-apps.service.ts:394–435`；`libs/platform-release/src/releases/releases.service.ts:474–481`；`apps/api/src/agent-sessions/agent-sessions.service.ts:50–87,104–108` | 安装修订事务和另一 activeRelease 查询均存在，Host 构建 envelope 却未传给编排。保留安装锁/CAS；有效 ReleaseContext 汇合归 06/07。 |
| `apps/web-portal/src/app/dashboard/apps/[packageId]/[[...page]]/page.tsx:1–14`；`libs/ui-runtime/src/blueprint/BlueprintAppRuntime.tsx:92–98,130–155` | 新 Blueprint UI consumer 已真实接路由，删除“完全无 consumer”前提；仍按 packageId 读定义，版本绑定由 06/08 补齐。 |
| `package.json:6–10,21,32–48,62–65`；`.github/workflows/ci.yml:169–189,240–250,307–313`；`eslint.config.js:50–61` | 三库/platform 构建和 error 级边界规则已存在；旧漏建三库与“规则仍 warn”删除。实际 push/PR CI 仍用 warn-only check:ci，新的 pipeline.sh 尚非该入口，严格接线细节归 03。 |
| `apps/api/src/cache/cache.module.ts:10–32`；`apps/api/package.json:45,66–67` | cache-manager 7 仍搭旧 store，Redis 错误被吞后转 memory；本次未跑 provider 或 Redis，不能复用旧 factory 调用数。Keyv/模式修复与双实例证据归 03。 |
| `libs/platform-release/src/atomic-runtime/atomic-runtime.module.ts:41–68`；`libs/platform-release/src/atomic-runtime/fallback-engine.ts:17–22,61–78`；`.github/workflows/ci.yml:72–126` | 实际默认 Wasmtime，宿主 CI 已构建上传；显式 fallback 有故障分类和留痕，不称静默模块降级。剩余为未知引擎值落 V8、生产单引擎策略与 readiness，细节归 03；数值 ABI 归 04。 |

本次仅进行代码/规格/调用链及锁文件静态审查，随后校验本 change 格式；未安装依赖，未启动服务，未运行真库、真实模型、浏览器、Rust 宿主或部署，不宣称上述实施验收通过。

## What Changes

新增 `ai-native-architecture` 的七条独立跨层契约：确定性业务与模型 Host；可信四角色能力来源；Registry 的最小 DI 与唯一业务接缝；冻结候选、真实证据、有效版本的权威接口；保留主体栈与 PG/可丢缓存 ADR；WASM 单生产引擎的失败策略；既有模块化拓扑、实例蓝图演进和外围源码交付的分离。

本项只实施架构端口、组合根的最小能力绑定、边界断言及 ADR 真源更新；下游负责具体业务、凭据、评测、发布与 UI 功能。**BREAKING（批准后的实施）**：未知 profile/引擎配置不得兜底授权；Registry 不持有批准/发布/激活的完整服务对象；调用方角色、passed、URL、包 ID 不变成平台事实；生产 fallback 开关不自动授予换引擎权限。公开 API 路径可通过兼容适配保持，不保留不安全语义。本次不修改实现或权威文档。

### 下游接口归属

| owner change-id | 本项的输出与下游责任 |
| --- | --- |
| `fix-ai-trust-and-execution-evidence`（01） | 主体/证据的可信来源契约；凭据、租户知识、Registry 实际生命周期与早期生产拒绝由 01 落地。 |
| `harden-browser-plugin-and-data-boundaries`（02） | 浏览器只消费平台端口；插件隔离、会话凭据、数据真实性由 02 落地。 |
| `restore-reproducible-build-and-quality-gates`（03） | 主体栈、目录内禁止依赖、Keyv/显式 memory、单引擎配置契约；真实构建/CI/Redis/宿主证据由 03 落地。 |
| `enforce-deterministic-business-command-invariants`（04） | 人工 REST 与工具适配的共享应用用例端口；规则、金额、并发及 Outbox 不变量由 04 落地。 |
| `harden-approved-release-artifact-integrity`（05） | 可信批准、冻结候选与签名未公开工件端口；不可变制品和 publish 拒绝由 05 落地。 |
| `unify-effective-release-activation-and-recovery`（06） | 可信 ReleaseContext 的唯一运行版本生产者；实际安装指针/激活/恢复/数据回退由 06 落地。 |
| `connect-runtime-ai-context-and-tool-lifecycle`（07） | Host 模型端口、可信 profile/上下文消费者；真实模型、预算、确认与会话接线由 07 落地。 |
| `integrate-versioned-schema-human-ai-workbench`（08） | 已有 Blueprint UI consumer 消费版本化端口；真实页面、编辑计划与刷新由 08 落地。 |
| `run-candidate-bound-evaluations-and-release-gates`（09） | candidateDigest 驱动 runner/证据/最终 GateDecision；实际逐例评测与全部必需证据由 09 落地。 |
| `add-evidence-governed-builder-and-limited-a2`（10） | 可信 Builder 与 ReleasePolicyService 的隔离接口；A1 真实闭环、有限 A2 与外围源码交付由 10 落地。 |

## Impact

### 规格与已有变更兼容

正式 `openspec/specs/` 无 `ai-native-architecture`，故采用 ADDED，不覆写其它正式条款。本项不重造 `refactor-app-workspace-split-and-platform-base` 的拓扑、不重造 `add-agent-host-and-instance-evolution` 的 MCP/隔离/实例演进，也不代替 `add-builder-governance-loop`、`add-piagent-runtime-context-and-session`、`add-release-lifecycle-and-activation` 的功能。只补可执行的可信来源、最小能力端口与候选证据顺序；既有 pending 范围在各 owner 实施中兼容收敛。保留正式 `wasm-atomic-runtime` 的全部准入、零能力、资源、审计与吊销判据；收紧 `add-wasmtime-host` 迁移期显式回退的生产适用性，不误称已发生模块级静默降级。

### 不做什么

不重做 apps/libs 拓扑，不要求所有应用模块迁出 API；不默认微服务/Kubernetes，不升级主体框架、ORM 或包管理器。不新增 Jev 生产执行、WASM command/effect、工作流、Blueprint/Delta/金额库。不重新审查所有新平台能力；复用已有数据范围、PG jobs、持久身份和安装事务。实例独立部署不是新运行引擎，也不是每客户生成一份平台源码。没有已验证的生产源码热改事实；外围源码规则是防扩权契约，不列为已利用的 P0 缺陷。

### 验收出口

1. 架构/安全负责人批准七条契约、实际 owner、接口版本、最小 DI 矩阵与技术栈 ADR；文档清楚区分已接线、仅声明、待验收。
2. 真实执行目录/DI 正负断言和端口契约测试；Host 保留会话持久化能力但不能拿业务仓储或发布权，MCP 与内嵌路径统一 Registry；未知主体/版本/引擎在副作用前拒绝。
3. 端口通过默认拒绝适配器与隔离夹具支持前段开发。生产顺序固定为：`candidateDigest → 真实测试/评测 → 可信审批 → 签名未公开工件 → 最终 GateDecision → published → activation`，绝不要求先 published 才评测。
4. 联合生产验收消费 03/04/05/06/07/08/09 的实际必需证据，关联源码 SHA、锁摘要、候选与有效版本、环境版本和逐例结果；不把本项文档生成或静态校验当真实评测。缺真实评测始终不得放行自治，09 的生产门禁未完成时新生产发布保持关闭；安全稳定安装继续确定性运行，A2 后置于 10 的全部依赖验收与平台授权。
5. 批准实施后更新现有架构/元语/项目/栈/协议真源并完成兼容回退断言；回退不能恢复自报角色、无审批发布、未知版本或引擎切换旁路。本次严格校验仅是提案格式出口。
