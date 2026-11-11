# Design: 最小能力控制面与确定性业务边界

## Context

基线 `ce1e538dcec6539f66bba80d5413a3b6741486c9` 已有三 app 与平台/工具/UI 库，不再执行旧目录迁移。`apps/api/src/app.module.ts:104–138` 装配平台兼容模块及尚留在 API 的语义、Agent、AI 模块；`apps/api/src/agent-tools/agent-tools.module.ts:45–82` 和 `apps/api/src/releases/releases.module.ts:57–116` 用工厂把应用层端口绑定给库。真实实现分别位于 `libs/agent-tools`、`libs/platform-release`、`libs/platform-core`；兼容 export 文件不是第二份实现。

业务 Kernel 是逻辑边界，不等于目录名或整个 API。`SemanticRuntimeService` 的确定性规则/事务与数据范围值得保留；`libs/agent-kernel` 是上下文、预算、工具类型的无外部 IO 库，包含时钟预算并不承诺模型输出位级确定。`release-kernel` 是纯发布判据，不是发布权。Host 可以调用模型适配器，但业务事实、规则、授权、提交由平台确定性服务决定，生产不含设计时 Jev。

## Goals / Non-Goals

目标是冻结可检查的 DI/依赖矩阵、可信角色来源、候选证据与运行上下文的端口、栈和引擎 ADR。利用现有模块和兼容壳渐进接线，不重建工作区、MCP、身份、数据范围、PG jobs、安装事务或 Blueprint/Delta。

本项不写完整模型循环/业务命令/签名器/评测 runner；这些由 proposal 中各 owner 实现。不设置自动化、启动外部宿主或部署。不证明整个同进程 Node 被攻陷后仍安全；隔离凭据与源码构建是独立执行边界。

## Decisions

### 1. 现有物理拓扑之上的逻辑依赖矩阵

| 当前层 / 消费者 | 允许能力 | 禁止能力 / 验证边界 |
| --- | --- | --- |
| `libs/shared-schemas`、`shared-core`、`release-kernel` | 类型、冻结 Schema、金额/规范化、纯发布判据 | 模型 SDK、业务仓储、Nest 服务与网络/文件/DOM IO；不复制金额库。 |
| `libs/agent-kernel` | 纯上下文/预算/工具协议及抽象端口 | platform/domain 实现、Repository、provider IO、签名和部署；计时预算不能变成业务规则。 |
| 确定性业务用例（现 `apps/api/src/semantic-runtime` 等） | 规则、权限、数据范围、应用事务/仓储端口 | 模型/Host/Jev 依赖和模型授权结论；现混合模块按接缝约束，不把全部文件当纯 domain。 |
| Host（`apps/api/src/chat`、`agent-sessions`） | 模型适配端口、ContextEnvelope、Registry/受控 MCP、会话/轮次持久化 | 业务 Repository/内部命令实现、批准/签名/publish/activate、任意 SQL/shell。会话 Repository 是合法宿主状态，不能因旧笼统禁 Repository 要求删掉。 |
| 工具适配（`libs/agent-tools`） | Registry 判定后调用最小应用查询/命令与提议/候选端口；审计/确认/范围端口 | 完整发布服务、发布密钥、动态扩工具和复制业务规则；未注册能力运行时拒绝。 |
| 发布/激活控制面 | `release-kernel`、可信身份、候选/证据、审批、签名、安装事务 | 用 caller passed/role/URL 或 Agent trace 补齐事实；不是 Agent 可调用的发布工具。 |
| `apps/api` 组合根 | 绑定明确 adapter；为具体 consumer 提供能力受限对象 | 把完整 Repository/发布服务对象当“端口适配”传入 Host/Registry；不设置全 API 的 blanket 例外。 |
| `web-portal` / `web-console` / UI 库 | 平台 HTTP/SSE、冻结 UI 与版本上下文；复用已有 BlueprintAppRuntime | provider/PG/签名/部署密钥、客户端权威授权、热改生产定义。 |

目前 Nx 是项目间边界：`eslint.config.js:50–61` 已 error，`scripts/meta/check-boundaries.mjs:48–80` 无图即失败，但不能自动识别同一个 app 内的 Host/业务 DI，也不能识别“注入完整 ReleasesService 而只调用少数方法”的权限面积。因此本项需要目录/import 与组合根断言；CI 接线和完整构建约束由 03 收敛，不重造图检查器。

人工 REST 不必走 MCP 或伪装为 Agent 工具，但与工具适配必须调用 04 的同一公开应用用例。模型只能经 Registry；外部 Host 的 MCP-only 范围沿用 `add-agent-host-and-instance-evolution`，不能扩成浏览器人工 REST 必须 MCP。当前 direct 与内存 MCP 桥都调用 Registry，未证明外部 Host 已部署。禁止依赖断言要检查重导出后实际 owner，不能只扫描 `apps/api` 兼容壳。

### 2. 可信四角色不是模型参数

复用 `libs/shared-schemas/src/v1/business-app.ts:69–77` 的 BusinessAppExecutionContext 和 `libs/platform-core/src/identity` 的用户/服务主体，不创建第二套身份或会话。拟新增受核验主体视图（名称待 owner 收敛）补充主体种类、稳定主体 ID、平台选定 agentProfile、可信职责、契约版本；`runtimeProfile` 当前表示 shared/dedicated/standalone 部署模式，**不得**挪用为 piagent profile。actor 文本只作审计展示，不替代 userId。

| 角色 | 主体来源与能力 |
| --- | --- |
| Runtime Operator（`piagent-runtime`） | 平台认证的用户/被授权服务 + 核验安装；只请求获准查询和经确认业务命令，不修改定义或发布策略。 |
| Builder（`piagent-builder`） | 平台绑定的专用 profile/服务身份；只读获授权基线与脱敏反馈、写草稿/Delta、请求隔离候选校验与预览；无生产业务写、审批、签名、publish、activate、源码/部署凭据。 |
| HumanApprover | 已认证人类与平台职责解析；作者/审批分离由 05 实现，body.role 只是申请提示，不能成为 security/tech_lead 事实。 |
| ReleasePolicyService | 平台授权的逻辑服务端口，可由既有 ReleaseAutomationService 实现，不新建必需微服务；只在真实必需证据/审批/签名均齐备后请求发布/激活，不成为工具，不伪造人类批准。 |

当前 `AgentToolRegistry` 默认未传 profile 为 runtime，MCP tools/list 用 `AGENT_HOST_PROFILE` 进程配置，而桥调用上下文未自动带同一 profile。`AgentSessionsService` 和 HTTP invoke 也未传 profile。本项不认定“请求体可把自己设为 Builder”已经可利用；目标是在所有真实入口明确解析和携带可信 profile、使列表收窄与调用授权使用同一主体。一个进程可以承载两个 profile，不得以进程环境变量替代每次调用授权。缺主体时先拒绝，旧明确的人类 runtime 入口可由服务器兼容绑定，不能对未知请求兜底。

### 3. Registry 的最小发布接缝

`AgentModuleRegistryPort` / `AgentFeedbackPort` 已存在，必须复用。Registry 现注入完整 ReleasesService（`libs/agent-tools/src/agent-tool.registry.ts:83`），实际仅用 createProposal、validateProposal、issuePreviewToken（`:321–362`），这不是已暴露 publish 工具，但 DI 对象能力过宽。

拟新增提议/候选窄端口，优先放在 `libs/agent-tools/src/agent-tools.ports.ts`：只暴露创建提议、请求候选验证、申请候选预览的受权方法。兼容适配器可暂映射现方法，但必须是只含允许方法的对象/门面，不能用 TypeScript Pick 类型掩盖运行对象仍有 approve/publish/activate。新的候选预览语义由 05/09 冻结；不能继续用任意 releaseId/roles 当候选授权。需要的应用命令端口由 04 供应，工具/人工 REST 不各自实现规则。

Host 通过受限 Registry/MCP façade 取得工具，不注入该窄提议服务，更不注入 ReleasesService。Registry 保持唯一契约验证/权限/确认/数据范围的执行边界，01 供应真实事件引用，07/09 消费；本项不另造生命周期或更换 audit 名称。

### 4. 权威端口与无环的候选门禁

以下端口是**拟冻结/增补契约**，不是当前已完整实现的能力：

| 端口 | 唯一权威生产者 → 消费者 | 内容与拒绝语义 | owner |
| --- | --- | --- | --- |
| 可信主体/安装上下文 | 平台身份/安装解析 → REST、Host、Registry、控制面 | 02复用身份提供必需sid校验；06提供安装；07解析每次调用/turn主体；10签发Builder grant；01只记录稳定主体事件。缺失/跨范围DENIED，runtimeProfile与agentProfile分开。 | 按字段唯一：02、06、07、10 |
| 有效 ReleaseContext | 安装/激活解析 → 命令、UI、Host | 安装修订、有效 Release/Blueprint 摘要与 turn/cohort pin；URL/packageId/目录 latest 只是选择提示，不是生产运行版本。 | 06 |
| 模型适配 | 服务端 provider → Host 的 IntentParser | 07提供adapter/真实usage，消费01受控凭据解析；最小Envelope/获权工具/预算/取消，TIMEOUT/UNAVAILABLE不产生提交事实。 | 07（凭据01） |
| 工具结果/事件 | Registry → Host、审计、评测 | 01拥有Registry生命周期；04拥有Command业务结果，07仅turn关联/去重投影；计划待确认不得产生success。 | 01（业务结果04） |
| 冻结候选 | 草稿/Delta 服务 → runner、预览、审批、签名 | 不可变修订、基线、candidateDigest、隔离读取范围；任何改变新摘要并失效旧证据/批准，不先要求 published。 | 05 |
| 真实证据 | CI、Registry、实际 runner → 平台门禁 | 03拥有工程报告/subject端口；09拥有候选runner/集合判分，消费01/04/06/07/08实际结果；missing/unavailable/skipped不等于passed。 | 工程03；候选09 |
| 最终 GateDecision | 09平台门禁 → 05publish、06activation、10资格 | 必需真实证据+05审批及签名未公开工件，经同摘要复核判决；05/06在提交前重新核验，10只消费，不另建决定真源。 | 09 |

固定顺序为 `冻结 candidateDigest → 真实测试/评测及隔离预览 → 可信审批 → 签名未公开工件 → 最终 GateDecision → published → activation`。G7/G8 在审批/签名阶段完善，验证阶段的 pending 不能冒充最终放行。候选读取权限不等于发布或生效权限，评测无须写 active 指针。防止“先发布才能评测、先评测才能发布”循环。

目前 G4 新增测试执行与缓存证据，但 findFresh 仅按组织/应用/时间，且 `RELEASE_G4_RUN_TESTS=false` 返回 passed；G5 接自报汇总，G6 接 URL，publish 不读取该 validation。保留新证据资产，改契约为候选绑定和可信执行器，不退回“测试完全没跑”的旧判断。具体执行器和 gate applicability 由 09 推导，00 不硬编码全变更一律相同阈值，也不把无证据 A1 默认起草理解为生产闭环已获许可。

默认拒绝适配器与非生产候选夹具可供 05/06/07 独立开发；生产新发布在真实门禁完成前拒绝。已安装安全版本继续确定性运行。A1 的隔离草稿开发可以先行，生产闭环必须真实验收；A2 进一步后置到 10 全部依赖与批准 policy。观察窗口/样本/阈值属于 10 的已批准 policy 或有理由的提案，本项不添加 24h 等无依据自治限制。新证据表的 24h 查找也不是候选真实性保证。

### 5. 保留技术栈 ADR

| 决策 | 本基线事实与目标 |
| --- | --- |
| Next/React/Nest/TS | 保留双 Next 应用、Nest API；锁文件 Next 15.5.12（`package-lock.json:24733`）、React/ReactDOM 18.3.1（`:26443,26469`）、Nest core 10.4.22（`:7662`）。根 overrides 已收敛 React 18，不能继承旧 root React 19 判断。锁版本不证明本机安装或生产部署版本。升级以独立安全/功能依据与回归批准推进。 |
| PG/TypeORM | TypeORM 锁 0.3.28（`package-lock.json:29132`），CI PG16（`.github/workflows/ci.yml:197–216`），生产版本未知。保留实体/迁移/RLS/安装事务；不换 Prisma，不用内存证据认证 PG 不变量。 |
| npm/Nx | 工作区为 apps/* + libs/* + shared-schemas + wasm-modules。`package.json:44` 和 CI 已补三库顺序；删除旧漏建任务。目标仍根唯一 npm 锁；缓存 inputs/outputs、严格实际 CI、遗留配置收敛归 03，不重做已完成 split。 |
| 缓存 | 当前 cache-manager 7.2.8 / Nest cache-manager 3.1.3（`package-lock.json:16751,143`）配旧 cache-manager-redis-store 3.0.1（`:16761`），registerAsync 返回 store 而不是新版 stores，且吞错误改 memory。目标保留 Redis、兼容 Keyv stores，或显式 memory；报告模式，不静默称共享。真实双实例/TTL/失效由 03 验证。 |
| 持久真源 | PG 保留对象、安装、审批、幂等/任务、执行证据。`libs/platform-core/src/jobs/job-queue.ts:274` 已 SKIP LOCKED；身份、数据范围和 jobs 是现有平台原语，不在本项另造。Redis 缓冲/唤醒可以丢，不能单独决定关键成功或授权。 |
| Rust/WASM | 保留宿主工具链 1.95.0（`crates/wasm-host/rust-toolchain.toml:3`）与 Wasmtime 48.0.3（`crates/wasm-host/Cargo.toml:14`，Cargo.lock 同版），限冻结 calculation/query。无实测不主张更快，不把业务域/事务搬到 WASM。 |
| 部署 | 已有 portal/console/API 模块化单体；gateway/worker 逻辑可并入 API，Wasmtime 与高权限构建器按隔离需要分进程。shared/dedicated/standalone 共用契约；独立实例不要求 SaaS，也不要求微服务/K8s或客户平台代码 fork。 |

### 6. 单生产引擎与回退

实际 buildEngine 默认已 Wasmtime，不再设计“从默认 V8 翻转”。显式 FallbackEngine 只处理引擎级故障并留痕，对 module trap/fuel/timeout 不回退；这些正确行为保留。新增生产 ADR 只允许部署单元预先选择一个获准引擎，V8 保留隔离对拍或有明确批准的存量配置，不能在失败调用中自动切换。未知 ATOMIC_ENGINE 值目前会走 V8 分支，目标必须枚举校验并拒绝。

03 负责二进制摘要、模块摘要、版本/协议握手、能力 readiness 与同 SHA 工件证据；宿主缺失时可保持不依赖原子的 API 可用，但相应能力不得 ready。CI 已上传宿主工件，不等于已验证部署 readiness。切换引擎必须新部署配置、同模块对拍与批准；对拍差异拒绝切换，不覆盖故障。模型失败可显式回规则/人工，原子安全门失败不能换结果，二者不可混用。

### 7. 实例演进、外围源码与兼容计划

实例内演进复用既有 Blueprint/Delta；不允许工具契约、平台源码、policy 或迁移混进蓝图热更。源码 Agent 是另一种独立开发身份，只在外围仓库提 PR，隔离 build/test，经独立批准、签名进程工件和批准部署；Runtime Operator/Builder 无 git/shell/签名/生产部署凭据。源码 SHA、锁摘要、测试/镜像与恢复记录相关联；deploy ≠ publish ≠ activate。未发现真实 hot-edit 路由不等于已验收隔离部署，不能据此说已利用热改。

迁移步骤：先批准契约与最小对象门面 → 保持 API 路径和兼容 export 接线 → 补可信主体/目录与 DI 拒绝断言 → 各 owner 渐进实现字段与拒绝门 → 实际联合证据 → 独立批准启用。旧缺 profile 的明确人类 runtime 入口由服务器适配；未知身份拒绝。历史外部 passed/审批角色/证据不能合成为可信值，标 legacy-unverified。新增迁移由各 owner 创建，不改已应用迁移。

安全回退先停模型/Builder/自动发布，保留稳定安装、持久事件与拒绝门；不恢复 body.role、独立 manifest 发布、URL 包旁路或自动引擎切换。源码镜像回滚、元数据版本回退、数据补偿由不同 owner 处理；不能仅因为有旧镜像/Release 即认定安全。03/06 验证读 schema 与数据兼容，缺证据保持当前安全版本。

## Verification and Risks

现有命令已核对：`npm run check:boundaries`、`npm run check:all`、`npm run build:libs`、`npm run build`、`npm run test --workspace @sap/api`、`npm run test:e2e --workspace @sap/api`、`npm run build --workspace @sap/web-portal` / `@sap/web-console`、`npm run wasm:test`。本次均不运行实现测试或安装/构建服务；`npm run lint` 的 API 子脚本带 --fix，也不作为只读审查命令。拟新增 `npm run check:ai-boundaries`、`npm run test:architecture-contracts`，其实现/实际运行结果不得预先宣称已存在或通过。

单元夹具证明端口拒绝与最小 DI，不证明真实模型、真库、浏览器或外部 Host 部署。架构前段验收允许隔离夹具；生产联合验收必须有同源码/候选真实执行证据，环境不可用标未验收，缺真实评测永不放行自治。当前静态审查与 OpenSpec strict 只认证提案结构。

主要风险是同进程对象能力泄漏、兼容入口仍用旧默认值、文档目标与现状再次混淆、单引擎拒绝降低可用性。缓解为真实受限门面、每次调用可信主体、目录+DI负例、实际 readiness 与明确人工路径；不能用更长提示词、隐藏 warning 或运行时换引擎弥补。角色映射、存量引擎部署资格与首个兼容窗口由架构/安全负责人批准，本项不自造容量或自治阈值。
