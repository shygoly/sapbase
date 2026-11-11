# 冻结候选执行与证据判决设计

## Context

基线为 weichen `ce1e538dcec6539f66bba80d5413a3b6741486c9`。`apps/api/src/releases/releases.module.ts:57-65` 将 `AgentEvalService`、`ReleaseTestEvidenceService` 注入发布库 `ReleaseValidationService`；相应 API service 是兼容壳，不修改兼容壳以制造第二份实现。评测服务当前仍在 `apps/api/src/agent-eval`，应在原 owner 上加真实 runner，发布库只声明消费端口。

`libs/platform-release/src/releases/release-validation.service.ts:85-119` 的 G0/G1 实际执行严格 checker/编译，G4 默认 Jest；`scripts/ci/record-test-evidence.mjs:15-40` 已采集 JSON 摘要。新增缓存、MCP 桥、Blueprint UI 与 PG jobs 均保留，本主题仅收紧候选绑定与可信判决。当前 G4 缓存、新旧评测数组和 G6 URL 均不能证明候选执行。

## Goals / Non-Goals

目标是提供可比较、可验证、同候选、逐例真实证据；完整发布判决 fail-closed，同时允许前段隔离验证在未批准、未 published 候选上运行。非目标是重写 Registry、会话框架、通用 UI、CI 拓扑、安装事务、Blueprint/Delta/金额算法或 A2 政策。Kernel 无模型依赖；模型非确定性由 AgentHost 如实记录。

以下 DTO、handler、命令、ledger 扩展与端口名称全部为**待新增/协调冻结**的建议，不表示仓库已有同名实现。本次不迁移、不运行它们。

## Decisions

### 1. 分阶段、无循环的制品链

`05 FrozenCandidate → 09 G0–G6（真实测试/评测/候选预览）→ 冻结 EvidenceSetDigest → 05 ApprovalReceipt（G7）→ 05 SignedUnpublishedArtifactReceipt（G8）→ 09 GateDecision → 05 发布事务提交 published → 06 activation → 10 A1/A2资格验收`。

候选内容摘要不包含后生成的审批、签名、发布时间或最终 GateDecision。`EvidenceSetDigest` 只覆盖 G0–G6 回执及政策/计划；审批引用该集合和 candidateDigest；最终签名载荷引用候选、证据集、审批和完整依赖/许可/迁移内容。G8 验证未公开工件的签名及内容映射；GateDecision 再引用 G8 回执，不要求工件签名反向包含 GateDecision 自身，也不等待 published 事件。05 必须将最终决定的候选、政策代次、审批/撤销状态核验与发布写入置于受控短事务；09 不拥有发布权。

前段验证返回 `validationStage=preApproval`，仅说明 G0–G6 的要求已经满足，不等价于 `productionAdmissible`。G7/G8 此时可以 pending，但最终判决中任何必需 pending/missing/unavailable/skipped 均阻断。不得沿用当前 `every(status !== 'failed')` 为最终准入算法。

首次发布由平台确认 `baselineKind=initial`，使用批准的首次准入政策；非首次发布取真实稳定基线并重跑可比较套件。`proposal.baseReleaseId` 只能是基线，不能像 `releases.service.ts:181` 那样作为候选 run 查询兜底。

### 2. 端口 owner 与接线

| owner / 现有入口 | 待新增或收紧的接口 | 缺失时的行为 |
| --- | --- | --- |
| 05；`libs/platform-release/src/releases` | `FrozenCandidateReader` 读取可信 org/app、冻结 revision、candidateDigest、内容引用、依赖集、baseReleaseDigest/首次基线；`ApprovalReceiptReader`、`SignedUnpublishedArtifactReceiptReader` 提供 G7/G8 回执 | 可编辑、越域、内容漂移、撤销拒绝；不接独立 request manifest |
| 03；既有 `scripts/ci/pipeline.sh` / Jest 报告 | 工程 runner 产出同源码/环境 BuildVerificationEvidence；唯一读取口为 `ReleaseTestEvidencePort.findForSubject(subject, requiredSuites)`，旧 findFresh 仅诊断；09 的 CandidateVerificationExecutor 消费该口并编排候选必需执行 | checker/DB/schema/RLS/宿主/browser 前置不满足，记录 failed/unavailable；不拿普通退出 0 代替执行断言 |
| 04；Registry 工具适配器 | 读取共享 CommandService 的结果/持久幂等账本/对象事件，以真实隔离数据库状态验证副作用 | 接口缺失相应用例 unavailable；不直接写 repository 代替正式命令 |
| 01/07；`apps/api/src/agent-sessions`、`libs/agent-tools` | 正式会话入口接受服务器候选上下文；模型/Context/selector→既有 MCP/direct→同 Registry→Command；读取实际 turn/tool/confirmation/usage 事件 | 当前规则 parser、plan.trace 自报或 env modelId 不能替代实际模型/工具事件 |
| 09 授权解析 → 08 正式 UI 消费者 | 09 提供 `CandidatePreviewResolver` 与隔离授权/上下文；08 复用 BlueprintAppRuntime/工作台渲染、数据和会话适配，按完整 namespace/digest 缓存 | 缺真实路由/backend 或触发演示 fallback，G6 不通过 |
| 06；安装/版本/迁移 owner | 只读 `MigrationCompatibilityEvidenceReader` 读取真实 baseline ledger、迁移输入及兼容矩阵；为影子库构造隔离安装 | 不操作生产指针；缺迁移 ledger/兼容证据时 G3 unavailable；联合验收后置 |
| 既有 `libs/platform-core/src/jobs` | 注册 `candidate-evaluation` job type/schema/handler，通过现有 `JobsService` / `JobQueue` / worker 领取、事件与取消 | 不建第二队列，不将 callback 或外部上传当评测真源 |

普通业务 ReleaseContext 仍来自 06 有效安装解析；候选上下文另有平台不可由 body 覆盖的 `mode=candidate`、隔离 namespace 与 audience。候选执行许可只授权冻结内容在隔离环境验证，不签发生产运行许可。编译可直接复用既有 `compileBlueprint` 的完整性/引用/冲突判据；若执行装载需要签名/授权，使用平台专门的候选验证签名与隔离租户授权，不开启全局 unsigned 豁免，不放松 `openspec/specs/blueprint-delivery/spec.md:6-56` 的生产验签/许可要求。

### 3. 请求、绑定与持久运行

新的启动请求仅接收 `candidateRef/suiteVersion/thresholdPolicyVersion/idempotencyKey` 及平台批准的测试选项；org/user/installation/profile 由服务端身份解析，基线由平台政策选取。返回 `202 + jobId`；查询、取消、事件回放和幂等命中均重新鉴权。旧 `POST agent-eval/run` 的 `caseResults`、validate 的 `eval/previewUrl` 不再参与准入；历史上传可留在独立只读说明渠道，明确 `legacySelfReported/unverified`。

`EvalRunBinding` 至少包括可信 org/app/isolatedInstallation、冻结 revision/candidateDigest、baselineKind/baseReleaseDigest、sourceCommit/lockfileDigest/runtimeBuildDigest、modelProvider/modelId/resolvedModelVersion/providerAdapterVersion/modelConfigDigest、seedRequested/seedEffective/seedSupport、toolCatalogDigest、授权已发布 knowledge/skillVersionSetDigest、suiteVersion/suiteDigest/fixtureDigest、thresholdPolicyVersion/baselineRunRef。没有明文凭据；候选知识必须来自受授权冻结发布集合，评测夹具不能自动发布到生产知识。

复用现有 jobs 的 PG 真源、SKIP LOCKED/lease/attempt/event/cancel，并追加评测不可变 binding、case 结果和 gate receipts。job 的基础状态不新增不兼容枚举；评测结果/回执单独区分 failed/unavailable/cancelled。handler 必须可重入，在短事务按 job owner、attempt、expected 状态追加每例事件和结果；长模型调用不占 DB 事务或安装锁。终态 CAS，取消后晚到成功不可覆盖；证据提交失败不能留下 passed。重启读取实际确认/幂等/命令副作用，不盲重试写；未知副作用保持 unavailable 待核验。handler 请求摘要须与 key 绑定；不能证明输入一致时冲突而非返回另一候选结果。

### 4. 真实逐例 oracle 与完整分母

保留 `faq/navigate/query/write/refusal/injection/release` 七套件；当前 `golden-set.ts:1-9` 是种子，不是足够的可执行生产验收集。每个 suite 冻结必测 caseKey、case/suite/fixture 版本、步骤与实际断言；业务负责人批准脱敏或合成夹具和预期。

- FAQ 核验业务关键事实及实际检索的 `[kn:id@version]` 来源、内容与授权，不仅检查引用样式。
- navigate/query 核验正式工具选择、规范化参数、真实对象/version 与菜单权限；歧义要追问/拒绝。
- write/refusal/injection 核验真实 Registry/确认/Command 和数据库提交、事件；无权限、越域、未确认必须无写提交；恶意业务文本不得扩大 profile/工具能力。
- release 核验同 turn pin 版本、新 turn 切换、旧页面 expectedVersion 冲突；复用 04 汽配窄切片和 08 船舶低风险资料，不重复算法。
- 在对应套件放入改参重新确认、取消/预算/deadline、断线回放和重启/幂等；保存真实状态、SSE、usage 及副作用核验。

每例结果记录 caseKey/attempt、turnId/toolEventIds、actualArgsDigest/confirmationRef/commandResultRef、expected/actual 摘要、executedAssertions/status/reason/时间。冻结必测 case 数是通过率分母；重复样本另报样本分母和失败，不用重试覆盖旧失败，不排除 unavailable。空/缺/重复 key/未知 case/零断言/混 binding 均不准入，禁止当前 `runs[0].suite` 加跨 run 总计的算法。

阈值政策版本化审批，规定每套件质量、实际样本量、分母、基线选择、退化量纲与统计算法。未授权写/未确认写=0、注入安全套件全通过保留；全失败 FAQ 不能因为其它安全指标通过而放行。历史 95%/90%/2% 不自动成为新生产数字；以批准政策冻结其业务依据和百分点/相对退化含义。首发不能假造历史基线；非首发可比较基线缺失则 unavailable。

provider 不支持 seed 时记录实际支持/生效状态，按批准重复策略报告分布，不承诺位级重复；无法解析模型实际版本或中途漂移，必需可比较证据 unavailable。token usage 来自实际 provider 回执，缺失不写 0；成本记录价格表版本/货币/计费口径，估算与实测分开。延迟用单调时钟测端到端与模型/工具分段，失败/重试/deadline 纳入口径。必需预算或成本指标无法测量时拒绝准入。

### 5. 加固现有 G4 测试证据缓存

保留 `app_release_test_evidence` 与 JSON 采集器，新增来源、报告对象摘要、执行器身份/版本、源码与依赖、环境/fixture、候选映射、测试计划、required/executedAssertions、成功/失败/跳过/不可用计数和 invalidationGeneration。CI 时间新鲜度只是附加政策，不是证据资格；不沿用当前默认 24 小时缓存作为通用 A2 或候选安全窗口。

`recordTestEvidence` 当前允许 body 提交 digest/summary/time/ranBy（`releases.controller.ts:92-106`）。实施后区分受认证受控执行器与普通权限用户：服务器核验绑定执行任务及原始报告/摘要，不采信任意 summary.success、ranBy 或未来 ranAt。成功报告也须满足测试计划覆盖及实际断言、前置 readiness；原有 digest 只有标识，不是签名背书。缓存命中需完整候选/输入/版本/政策/环境一致，或平台明确证明可复用且仍绑定该候选的共享源码测试映射。失败、零断言、自报来源、未知源码、跨候选或失效回执不命中。`RELEASE_G4_RUN_TESTS=false` 只能生成 skipped/unavailable，不能 passed。

### 6. 必需闸门与完整回执

平台重算 baseline→candidate diff，生成 `impactDigest + gatePolicyVersion + requiredGates/suites/tests`。作者的 type/areas/risk 仅说明；未知影响阻断，多类取并集。保留 `docs/protocols/release.md:269-279` 的最低矩阵：所有变更 G0/G4/G7/G8；表单/页面需编译及预览；数据模型 G1/G2/G3/G6；流程/规则 G1/G6 且真实迁移/Agent 影响分别加 G3/G5；权限/菜单与工具/技能/知识 G1/G2/G5/G6；迁移 G1/G2/G3/G6。纯文案仍真实冒烟，G6 是否不适用由平台证明无关键依赖影响。

| gate | 实际证据 |
| --- | --- |
| G0 | 候选派生验证工作区的严格 check-all；现有 G0 已严格，不把 `.github` warn-only 或模板 skip 当通过 |
| G1 | 完整冻结输入的既有 Blueprint/Schema 编译与引用/依赖/冲突检查，IR/module/input 摘要及编译器版本 |
| G2 | 真实基线/候选角色、资源、字段、动作、工具/数据范围可达性 diff；与审批职责联动，不看 risk 布尔 |
| G3 | 真实隔离影子库按 baseline ledger dry-run，兼容读/回退或补偿断言，迁移及前后 schema/数据摘要；不看 strategy 文本 |
| G4 | 受控且候选绑定的单测/集成/真库/E2E/必要冒烟回执；保留现有 Jest，不将源码正路径或缓存时效当候选覆盖 |
| G5 | 当前候选完整逐例真实 run + 冻结政策判分，所有必测套件，不接自报/历史拼接 |
| G6 | 同候选隔离部署 readiness、正式 UI/会话实际 browser 断言、网络/状态/媒体产物摘要 |
| G7 | 05 可信批准回执，候选/证据集、作者≠批准人、高风险不同真实人及角色职责、撤销状态 |
| G8 | 05 未公开工件完整 Ed25519 验签和 write-once 回执，反解内容→candidate 映射、依赖/许可/迁移/证据/批准引用 |

回执包含 gateId/candidateDigest/baselineDigest/inputDigest/policyVersion/impactDigest、executor 身份/版本、source/runtime/fixture/artifact 摘要、必需/实际断言、时间/status/reason/auditRef/失效代次。状态为 pending/running/passed/failed/missing/unavailable/skipped/notApplicable；只有经过认证核验的 passed 或政策允许且平台推导审计的 notApplicable 可进入最终准入。G7/G8 的身份/密码学核验数单独记录，不伪称 Jest 断言数。证据只追加，改变政策重新判分产生新决定，不篡改原回执。

### 7. 隔离候选预览

既有 HMAC token 与发布对比页保留历史兼容，不把它们描述为不存在。新增候选签发/验证协议绑定可信 user/org/app、candidateDigest/revision、isolatedInstallation/namespace、profile/audience/nonce/expiry/撤销代次，每次请求核对当前身份与权限。TTL 由批准的预览 policy 配置，无新无依据窗口；既有 published-preview 上限的兼容要求在实施时单独核对，不用于 A2 指标窗口。

候选 UI 明示隔离/基线标记，实际读取候选 Schema、真实隔离库与正式会话，不触碰生产安装指针；完整 namespace/digest 缓存不混正常 release。隔离写凭据、非绕过 RLS 角色、脱敏夹具、可测出网/消息/effect 隔离是 readiness 条件，无法隔离必要 effect 则 unavailable。签发的候选验证授权不能用于生产 API/普通工具扩大授权。

browser 脚本复用 08 正式工作台与 `BlueprintAppRuntime`：字段/权限/列表数据同候选；船舶指代→实际模型计划→改参→重新确认→共享命令→列表刷新；拒绝无权/未确认写，旧版本冲突，SSE 取消/恢复。404/403、permissions 请求失败变 null、GET demo fallback、只展示 changelog 或 token claims 都不能算 G6 通过。具体 UI/身份修复由 02/08 owner，本主题只消费其验收接口。

## Compatibility / Migration / Rollback

实施批准后增量迁移现有 eval/test-evidence ledger，按 DOMAIN/schema manifest 与 RLS 增索引/绑定，历史 releaseId 关联仍可查询，不要求 candidate 外键指向已 published 行。旧 run/普通上传 evidence 标为 legacySelfReported/unverified，只读且无准入资格；重新运行候选而非补填可信字段。认证执行器端点、候选 job 与实际 CLI 先冻结契约，再协调调用方迁移，不能双写一条旧旁路。

前段隔离开发可使用明确 contract doubles，但替身回执存测试 namespace、绝不形成 production GateDecision。真实模型/PG/browser/迁移证据缺失时生产新发布保持关闭，已安装未吊销版本继续确定性服务，A1/A2 后置审批。

回退是停止候选 handler、撤销预览授权、失效回执、阻断新发布，保留历史与已安装有效指针。数据库回退或 runner 故障不能恢复自报、warn-only、禁测 passed 或独立 manifest 发布旁路。09 不执行安装/激活/数据回退事务。

## Commands and Evidence Limits

已核对根 `npm run check:all/check:ci/ci/ci:record-evidence/e2e`，API `npm run test --workspace @sap/api -- --runInBand` 和 `test:e2e`，前端 `build/typecheck --workspace @sap/web-portal/@sap/web-console`。`npm run e2e` 是 `scripts/e2e-release-agent.mjs` 的 HTTP/DB 脚本，含测试身份和数据库清理，不是 browser 或生产模型 runner；本次未运行。`@sap/web-console` 当前无 browser test script。

待新增：`eval:candidate`、`test:eval-contracts`、`test:release-gates-real`、`test:preview-candidate`，实施时 owner 冻结 CLI 参数/schema 后登记 package。本次只执行 OpenSpec 格式校验，不声称构建/Jest/真库/model/browser PASS，不复用 main 数字。

## Risks / Trade-offs

主要风险是模型别名/usage 不透明、基线夹具漂移、长测成本、隔离效果泄漏、重启重复写和证据失效竞态。以实际版本/usage 与批准重复策略、同夹具基线重跑、版本化预算、隔离 readiness、既有 PG job + Command 幂等和发布事务代次核验缓解。质量阈值、实际 runtime/provider/browser/DB 版本与生产保护开关解除均须真实验收和独立审批；未知不是默认 passed。
