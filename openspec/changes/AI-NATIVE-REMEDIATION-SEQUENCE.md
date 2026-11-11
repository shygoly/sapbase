# weichen AI Native 整改执行索引（仅提案，未 apply）

> 本文件是执行索引，不是 change，不改变历史提案、正式规格或生产状态。
> 实际审查基线：`ce1e538dcec6539f66bba80d5413a3b6741486c9`；分支：`docs/weichen-ai-native-remediation-20261110`。
> main 的旧规划只作对照，没有 cherry-pick。main 的漏洞复现、构建、测试数量和版本判断都不是 weichen 实测。
> 本批 11 个 change、59 份提案文档、81 requirements、204 scenarios、199 tasks 全部未勾选。只做静态整合、严格格式校验和台账生成；未实施、apply、archive、迁移、部署或操作生产开关。Git 提交与 PR 仅交付规划文档，不代表实施批准。

## 1. 默认顺序与准确直接依赖

下表序号用于协调接口，不表示必须等前项全部生产验收才能写下一项。直接依赖是接口/联合执行前置；生产放行另受第 3 节里程碑约束。编号始终映射到下表准确 ID。

| # | Change / 入口 | 优先级与独立剩余范围 | 直接依赖 |
|---|---|---|---|
| 00 | [refactor-ai-native-control-plane-boundaries](./refactor-ai-native-control-plane-boundaries/proposal.md) · [设计](./refactor-ai-native-control-plane-boundaries/design.md) · [任务](./refactor-ai-native-control-plane-boundaries/tasks.md) | 架构基线：确定性边界、四角色、最小 DI、单引擎与真源 ADR | 无 |
| 01 | [fix-ai-trust-and-execution-evidence](./fix-ai-trust-and-execution-evidence/proposal.md) · [设计](./fix-ai-trust-and-execution-evidence/design.md) · [任务](./fix-ai-trust-and-execution-evidence/tasks.md) | P0：直接/嵌套凭据 DTO、知识/技能命名空间、Registry 真事件、早期生产拒绝 | 00 |
| 02 | [harden-browser-plugin-and-data-boundaries](./harden-browser-plugin-and-data-boundaries/proposal.md) · [设计](./harden-browser-plugin-and-data-boundaries/design.md) · [任务](./harden-browser-plugin-and-data-boundaries/tasks.md) | P0：独立 origin 插件、会话必需 DI/CAS、BFF/CSRF、生产数据诚实来源 | 00 |
| 03 | [restore-reproducible-build-and-quality-gates](./restore-reproducible-build-and-quality-gates/proposal.md) · [设计](./restore-reproducible-build-and-quality-gates/design.md) · [任务](./restore-reproducible-build-and-quality-gates/tasks.md) | P0 工程阻断：真实 required CI、冷构建闭包、真库前置、Keyv/TTL、原工件/readiness | 00 |
| 04 | [enforce-deterministic-business-command-invariants](./enforce-deterministic-business-command-invariants/proposal.md) · [设计](./enforce-deterministic-business-command-invariants/design.md) · [任务](./enforce-deterministic-business-command-invariants/tasks.md) | P0 交易 / P1 共享用例：版本/锁/规则、数值 ABI、引用、Outbox、真实汽配交易 | 01、03 |
| 05 | [harden-approved-release-artifact-integrity](./harden-approved-release-artifact-integrity/proposal.md) · [设计](./harden-approved-release-artifact-integrity/design.md) · [任务](./harden-approved-release-artifact-integrity/tasks.md) | P0：冻结候选、可信审批、完整目录签名、不可变制品、唯一 publish | 01、03；衔接既有 [add-release-lifecycle-and-activation](./add-release-lifecycle-and-activation/proposal.md) |
| 06 | [unify-effective-release-activation-and-recovery](./unify-effective-release-activation-and-recovery/proposal.md) · [设计](./unify-effective-release-activation-and-recovery/design.md) · [任务](./unify-effective-release-activation-and-recovery/tasks.md) | P0：唯一有效版本、安装原子切换、稳定路由、持久恢复、当前数据兼容 | 04、05 |
| 07 | [connect-runtime-ai-context-and-tool-lifecycle](./connect-runtime-ai-context-and-tool-lifecycle/proposal.md) · [设计](./connect-runtime-ai-context-and-tool-lifecycle/design.md) · [任务](./connect-runtime-ai-context-and-tool-lifecycle/tasks.md) | P1 / P0 执行承接：真实 provider、权威 Envelope、确认绑定、预算、实时 SSE/CAS/恢复 | 01、02、03、04、06 |
| 08 | [integrate-versioned-schema-human-ai-workbench](./integrate-versioned-schema-human-ai-workbench/proposal.md) · [设计](./integrate-versioned-schema-human-ai-workbench/design.md) · [任务](./integrate-versioned-schema-human-ai-workbench/tasks.md) | P1：有效版本/记录保真、一个当前页会话、真编辑重确认、草稿适配/共享命令样板 | 02、04、05、06、07；衔接以下三个既有 UI owner |
| 09 | [run-candidate-bound-evaluations-and-release-gates](./run-candidate-bound-evaluations-and-release-gates/proposal.md) · [设计](./run-candidate-bound-evaluations-and-release-gates/design.md) · [任务](./run-candidate-bound-evaluations-and-release-gates/tasks.md) | P0 发布阻断 / P1 评测：真实逐例、同候选绑定、隔离预览、G0–G8 最终判决 | 03、04、05、06、07、08 |
| 10 | [add-evidence-governed-builder-and-limited-a2](./add-evidence-governed-builder-and-limited-a2/proposal.md) · [设计](./add-evidence-governed-builder-and-limited-a2/design.md) · [任务](./add-evidence-governed-builder-and-limited-a2/tasks.md) | P1 后置：Builder grant、真实 A1 lineage/效果、有限 A2、外围源码交付准入 | 05、06、07、08、09 |

08 的既有 UI 前置分别是 [add-blueprint-ui-runtime-consumer](./add-blueprint-ui-runtime-consumer/proposal.md)、[enhance-ui-runtime-scenario-capabilities](./enhance-ui-runtime-scenario-capabilities/proposal.md)、[enhance-piagent-help-and-action-shell](./enhance-piagent-help-and-action-shell/proposal.md)。其中真实 Blueprint consumer 已存在，只做保真/有效版本回归；selection/dirty/三态/壳由原 owner 提供，尚缺部分不在本批重建。保留历史任务状态，不把旧勾选当本次验收。

批内 DAG：`00 → {01,02,03} → {04,05} → 06 → 07 → 08 → 09 → 10`；完整边以表格为准。05 不把 09 列为开发前置，09 不要求先 published；06 的隔离迁移证据生产不先等 G3，生产切换才消费已完成 G3/最终判决。07 不依赖 10 的 A2 完成才能开发 Runtime；10 的 Builder grant 仅在双方后置联验时接入。

## 2. 唯一 producer / consumer 与命名冻结

以下接口均为拟增/拟收紧，不声称已经实装。跨主题重复出现的要求是生产者和消费侧断言，不是两套服务、表、队列或授权算法。

| 唯一 producer / 实施 owner | 契约与消费者 |
|---|---|
| 00 架构边界 | 冻结职责及 Registry 最小提议/候选对象门面和 DI 负例；03 实现通用解析路径/图检查并接 CI，00 不再另造 checker |
| 01 安全事实 | ModelPublicDto/ModelSecretWriteDto/ModelCredentialResolver、KnowledgeNamespace、RegistryExecutionEvidencePort、ProductionEvidencePolicy；07 消费凭据/已发布检索/真实事件，05/06/10 入口接同一早期拒绝策略，不各自发明资格 |
| 02 身份与浏览器适配 | 复用 AuthSessionsService，唯一提供必需 validator token/useExisting、sid 主体/组织校验、switch/refresh CAS；BFF/Cookie/CSRF、PluginUiDescriptor/窄桥、BusinessDataEnvelope；07/08 消费可信请求与来源 |
| 03 工程证据 | 复用 ReleaseTestEvidenceService/账本与记录器，产出 BuildVerificationEvidence；唯一读取口 `ReleaseTestEvidencePort.findForSubject(subject, requiredSuites)`，旧 findFresh 仅诊断。09 消费，CandidateVerificationExecutor 的候选编排属于09；无第二 findMatchingVerified 服务 |
| 04 业务事实 | CommandService/BusinessCommandPort、持久 claim/result、expectedVersion、FlowExecutionPlan、金额/ABI和同 manager Outbox/稳定消费者幂等；人工 REST 与 Registry adapter 共用，不让07/08另建事务/业务账本或算法 |
| 05 草稿、批准和制品 | AppDraft 原子 apply/CAS/freeze 是唯一核心；08 仅 orderedPatches 请求/预览适配。提供 FrozenCandidateReader、ApprovalReceiptReader、SignedUnpublishedArtifactReceiptReader、ImmutableArtifactStore、PublishedArtifactResolver；09 读 G7/G8，06 读已发布工件；05 唯一 publish |
| 06 有效安装与迁移 | EffectiveReleaseService/ReleaseContext、ReleaseSwitchService、ReleaseInstallationPort、安装迁移 ledger/方向性兼容与 MigrationCompatibilityEvidenceReader；隔离 purpose 输出真实输入/结果给09 G3，无 published/G3 前置；生产切换再核 G3/最终门禁及当前水位。06 提供后端版本化定义/记录契约，08 唯一接前端 |
| 07 通用 Agent 调用 | 可信 turn 主体/profileGrant 核验、ContextEnvelope、provider、runTurn(ContextBinding,input)、pendingAction 修订/确认/预算、PG turn/SSE恢复；01 定义/修正真实事件及旧假 success，07 只做同 turn 关联/去重投影，不重造审计 |
| 08 正式 UI 消费 | 复用 BlueprintAppRuntime/SchemaList/Form、RecordEnvelope、统一当前页 conversation、共享协议拒绝、编辑与 dirty 同步；schema-page 是06有效版本服务上的 UI适配，schema-draft-patches 委托05核心，不保存第二定义真源；审批Console适配由05拥有、自治治理页面由10拥有，仅复用08共享UI/协议，不在08新增治理系统 |
| 09 候选与判决 | 真实 suite/case runner、CandidateVerificationExecutor、CandidatePreviewResolver/隔离授权、CandidateEvidenceProvider/GateDecision；08消费候选上下文并渲染正式 UI，09不获得发布/激活权 |
| 10 Builder与自治资格 | 平台 Builder grant 签发/撤销、候选目标收窄、反馈 lineage、A1阶段与真实效果窗口、分类/批准policy/epoch/全policy审计；07核验每次grant，05实例化同候选批准回执，06执行版本切换。源码仅外围准入，不新增生成器/部署器 |

摘要统一为 `candidateDigest`（冻结内容）、`releaseCatalogDigest`（完整目录签名payload）、`blueprintPackageDigest`（最终包字节）、`blueprintIrDigest`（IR）。05 的旧术语 releaseDigest/artifactDigest 只可分别作为目录/包边界的明确别名；06 安装历史 `releaseDigest=IR` 不改语义。跨接口必须使用上述独立名称，不将任意一个 digest 代替其余字段。

统一已发布解析口：`PublishedArtifactResolver.resolve(principal, {releaseId, expectedReleaseCatalogDigest, appKey, installationId, purpose})`，purpose 限 install/upgrade/rollback/resume。目录授权/签名/封存/吊销由05核验；安装/实际数据兼容由06核验，结果不等于激活。候选走 FrozenCandidateReader/CandidatePreviewResolver，不能走此生产口。

统一动作编辑口：`PATCH /api/agent/conversations/:id/turns/:turnId/actions/:actionId`，body `{expectedRevision,argsPatch}`；07产生新修订/摘要并撤旧token，08消费，禁止平行确认consume接口。

## 3. 并行区、前段与后置里程碑

**M0 契约批准。** 确认00边界、各接口的真实 owner/锁序/失败码、必需 suite/profile 与历史兼容。只批准设计不代表实施；当前199任务均未完成。

**M1 早期安全与工程基础。** 01/02/03可并行；01先实现拒绝非真实生产证据，02先清凭据与生产mock/同域插件入口，03先统一实际required入口及真实前置。04与05随后按已冻结端口并行。00的架构/DI、04命令、05制品可在隔离namespace/契约double下开发，不能生成生产资格。

**M2 前段消费者。** 06先实现只读解析/迁移证据与隔离恢复，07模型adapter/纯协议/只读上下文、08 UI保真/草稿消费可按冻结接口并行。真实依赖未具备的动作明确unavailable，不把所有后置任务完成作为前段写代码门槛，也不把局部成功当生产放行。

**M3 人工与AI共享实际样板。** 04验证完整auto-parts窄切片（库存守恒、状态规则、数值/分录/事件同事务、引用和崩溃竞争）；min模板只冒烟。08的首样板限船舶查询和经批准name修改，先批准真实数据owner/映射、权限/data-scope/RLS/version和工具；可选已存在semantic runtime的Ship映射或真实航运owner适配，二者不得复制事实。当前没有验证真实航运HTTP后端，不能用前端URL/mock/迁移表代替。record.update尚未实现/批准前不注册工具或宣称样板写可运行。

**M4 同候选后置联合验收。** 00/01/02/03/04/05/06/07/08共同交付真实DI、冷构建、隔离PG非绕过RLS角色/多实例/故障、Redis、Rust目标、实际provider/version/usage、HTTP/SSE和正式browser证据；09对版本化必测集完整分母逐例评判。required missing/unavailable/skipped/空套件/零断言不能PASS；不适用由平台推导审计。没有这些证据就没有完整生产认证。

固定运行顺序：`05冻结candidateDigest → 09真实G0–G6 → 冻结evidenceSetDigest → 05可信G7批准 → 05签名未公开工件/G8回执 → 09最终GateDecision → 05短事务重验后published → 06独立activate`。G8/最终决定不反向嵌入自身签名，不等published事件；06候选兼容验证先输出证据，生产切换再对实际水位重验，避免循环。

**M5 A1之后才有限A2。** 真实评测/发布/实际安装/效果窗口形成可追踪A1端到端后，才由独立负责人批准10的有限A2 policy。只允许可证明无业务语义影响的普通展示帮助/字段提示；双白名单交集、真实diff、真实分母/窗口/方向指标、稳定cohort、兼容恢复、撤销epoch/逐次复核和全policy审计均必需。低风险委托由05针对同候选实例化，不能豁免高风险双真人；不支持就继续A1。全量独立人批，A3禁止。既有24h、N、5/25/100设计值不是本实例已批准资格，更不是此次实测。

生产保护/关闭开关、现有发布/安装状态均未操作。未来生产新发布、切换及自治必须在各入口消费共同拒绝策略和真实门禁；当前文档不证明保护已经部署。合法稳定未吊销安装保留确定性运行，失败回退不恢复秘密回读、假成功、旧manifest旁路、静默mock或自动换引擎。

## 4. 剩余P0/P1覆盖与新缺口

| 优先级 / 剩余问题 | 唯一整改及联验 |
|---|---|
| P0 凭据直接/嵌套序列化、明文/回填；知识跨组织谓词、NULL唯一/global/RLS和技能同名版本 | 01；02/07消费与真实HTTP/PG/browser |
| P0 plan.trace生成success、执行前拒绝证据不完整、userId被email替代；早期新候选/自治无强拒绝 | 01权威事件/安全策略；07真实turn绑定；05/06/10消费者 |
| P0 第三方JS/CSS主权限域、localStorage bearer、sid可选DI/实际switch无sid、生产shipping fallback | 02；01 DTO、07 SSE、08 UI来源联验 |
| P0 required CI warn-only/统一pipeline未接、RLS early return、缓存旧store/TTL及宿主readiness；P1图/元数据/输入闭包 | 03；09核验同源码/候选工程证据 |
| P0 expectedVersion可省、旧审批body.role、规则flow/引用竞争、金额/ABI物理边界、Outbox领取/幂等/完成事务 | 04；01真事件、06版本、07确认、08人工/AI、09真实交易证据 |
| P0 publish独立manifest/自报role/改并批、目录标签签名、退役封存/包覆盖、Builder作者空及依赖range重解析 | 05；01主体、03报告、09最终门禁、06读取 |
| P0 activation未接安装指针、URL包选择定义、latest路由、恢复暂停不复验、持久job完成回执与数据回退 | 06；04 Outbox/Command、05工件、07pin、08旧页、09兼容 |
| P0/P1 确认绑定不足/幂等先授权问题、取消/SSE/恢复；P1真实模型与Envelope/检索未贯通 | 07；02可信sid、01Registry事实、04事务、06有效版本 |
| P1 真实UI丢RecordEnvelope/page.fields、权限错误宽松化、edit占位、dirty/事件同步、草稿批量适配 | 08；02/04/05/06/07提供唯一核心 |
| P0 自报caseResults/空FAQ/混suite、G4新鲜失败缓存/禁测passed、G6 URL、G0–G8非最终publish门槛 | 09判决；03受控报告、05提交消费 |
| P1/A2后置 反馈归属、Builder非Builder导出能力、不可信反馈未接、无指标success/晋级全量/self clean/首policy审计 | 10；07grant核验、05审批、06切换、09真实资格 |

## 5. 已解决项退出：no-change，不强行新建整改

weichen已有：三app/平台libs真实装配、三内核构建步骤、Nx边界error与浏览器范围、内嵌MCP/Registry唯一执行接缝、后端Node子进程沙箱、共享data-scope接入、PG jobs/持久会话账本、安装事务/锁/CAS/追加历史/目标IR复验、确认基础canonical/TTL/条件UPDATE、真正Blueprint Ed25519/许可及AI load后loadedAt、Release删除拒绝/版本唯一、动态Blueprint UI consumer、服务器五scope Patch/编译、默认Wasmtime和宿主CI资产。

因此本批已删除重建上述资产的任务，不仅替换旧路径。每条仍保留独立的消费/授权/证据/恢复缺口，故保留11条；某个旧子问题resolved不代表整主题resolved。旧缓存副本/客户端Kimi未证生产消费者、生产源码热改/外部Host部署/提示注入利用及RLS实际效果均不能升格为已利用事实。其它pending提案原状态未变，语义滞后在批准实施/归档时由原owner协调，不自动apply整套旧方案。

## 6. 技术栈保留与必要调整

保留模块化单体、双Next前端/API组合根、Next/React/Nest/TypeScript、PG/TypeORM、Nx/npm；不为整改引微服务/Kubernetes、新ORM或每客户代码fork。独立复核的锁定快照为Next15.5.12、React/ReactDOM18.3.1、Nest10.4.22、TypeORM0.3.28、Nx24.0.2，不是部署版本；旧root React19结论退出。npm唯一根锁为目标，bun.lock消费者批准后清理，Cargo.lock保留；本次不改锁。

Redis只作可丢加速，采用兼容Keyv stores或明确memory、毫秒TTL/模式可观测与真实双实例验收；PG保留业务/安装/批准/任务/关键幂等/证据真源。Rust/WASM限纯计算及冻结ABI；保留已有Wasmtime默认，收紧未知引擎枚举/真实readiness，生产单引擎不故障自动fallback，V8仅隔离对拍或明确批准存量。源码Agent只走外围PR→隔离build/test→独立批准→签名原进程工件→批准部署，deploy≠publish≠activate；本批不构建生成器或部署器。

## 7. 文档验收与台账

使用仓库外OpenSpec CLI逐条 `validate <id> --strict --no-interactive`，不安装业务依赖；改changes后已按AGENTS检查台账脚本仅生成文档/读取git log，再运行 `npm run meta:openspec-ledger` 与 `npm run check:openspec-ledger`。另检验批内DAG、相对链接、Requirement唯一键、MODIFIED完整原场景保留、全新tasks未勾选和允许范围，`git diff --check`不代表构建或产品验收。详细审查、探针与原始校验日志保留在仓库外，不进入本批文档提交。

允许仓库变更仅本批新change、此索引、向[历史入口](./REFERENCE-ADOPTION-SEQUENCE.md)追加链接及生成[台账](../../docs/OPENSPEC_CHANGES.md)。正式openspec/specs、当前业务代码、锁及其它权威docs保持原样。Git 提交、推送和 PR 不自动执行 apply、archive、迁移或部署。
