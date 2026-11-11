# Design: 新基线 AI 信任边界与执行事实

## Context

基线为 weichen `ce1e538dcec6539f66bba80d5413a3b6741486c9`。`apps/api` 并非全为兼容层：AIModels、Knowledge、Sessions、Eval 和 ChatOrchestrator 在该目录仍有真实实现；Registry 真源已移至 `libs/agent-tools`，Releases/ReleaseValidation/ReleaseAutomation 已移至 `libs/platform-release`，RLS/审计/数据范围在 `libs/platform-core`。以 AppModule、模块工厂、re-export 和实际控制器导入判定归属，不能把 API 壳或未注入 helper 当真正实现。

已读正式 `ai-module-management`、`data-scope` 与 pending 知识/会话/Host/A2 条款。本 change 是其安全验收补充：不重新定义知识工作流、MCP、Host、数据范围原语、PG jobs/identity、发布事务或运行 UI。规范均为具体独立 ADDED 条款，没有 MODIFIED 正式条款丢场景的风险。

## Goals / Non-Goals

目标是堵住模型直接和嵌套读回，保证知识/技能同域操作，将工具事实与计划彻底分开，并给后续候选治理一个不可由自报解锁的早期拒绝接口。业务 Kernel 保持确定性，工具权限继续只经 Registry/共享平台判定，模型和外部文本不授予能力。

不做 provider 生产接线、完整上下文/确认令牌全绑定、预算/取消、多轮流式状态机、完整评测 runner、A2 指标/窗口、签名/安装激活方案、插件与浏览器会话隔离；这些有各自 change owner。不换 Nest/React/Next、PG/TypeORM、Nx/npm，不增加向量库、消息平台或另一个审计链。

## 1. 模型公开对象与内部凭据

### 接口与真实消费者

以下名称是**待新增**设计接口，不是当前可调用 API：

| 接口 | 约束与消费者 |
|---|---|
| `ModelPublicDto` | id/name/provider/model/status/description/isDefault/时间、校验后的非秘密 baseUrl、白名单 config、hasApiKey；无 apiKey/密文/credentialRef。供模型所有控制器与嵌套模块模型对象、`libs/api-client` 和 web-console 使用。 |
| `ModelSecretWriteDto` | 只接凭据写入；省略保留，空白拒绝，待新增 clearApiKey 显式清除且与新 key 互斥；可信管理权限决定能否写入。状态仍由服务端生成，不信任请求自报 active/已测试。 |
| `ModelCredentialResolver.resolveForInvocation(modelId, trustedCaller)` | 仅获授权服务端适配器使用，普通读取、工具和上下文不获得此能力；返回短生命周期凭据，不存在 HTTP 读回接口。 |

`AIModelsService.findDefault()` 当前被公开控制器与真实模型消费者共用，必须拆清公开查询与内部解析，而不是删除字段后让内部调用构造 `Bearer undefined`。`apps/api/src/ai-modules/ai-modules.service.ts:100,353,424` 和 `ai-module-context/infrastructure/external/ai-model.service.ts:12–21,24–61` 均需迁移；后者由 AIModuleContextModule 注册并被 AIModulesModule 导入。`apps/api/src/chat/llm-intent-planner.ts` 虽读取 key，但当前 ChatModule `:13–16` 只注入 RuleBasedIntentParser；此 helper 只登记未来 resolver 兼容，不能据它宣称当前 Runtime 已调用模型。

默认查询不加载敏感列，所有返回再显式 map，包括 `AIModulesService.findAll/findOne` 的 aiModel 关系和 generation/update 回执，不能只靠全局 response wrapper 或 select:false（同次写入对象仍可能保留秘密）实现安全。config 只允许 provider 白名单非敏感设置；URL 用户信息/认证查询字段拒绝。测试错误返回安全码/requestId，不返回原始 axios 请求配置或 Authorization。

`libs/api-client/src/api/ai-models.api.ts` 拆读取/写入类型，app-shared 继续 re-export，web-console 密码初始空，仅显示 hasApiKey；无变更不发 key，显式删除另作操作，成功/失败/关闭清理敏感输入，不能回填旧 model.apiKey。

### 存储、迁移与回退

`libs/platform-core/src/identity/sso/sso-adapter.ts:57–61` 已有 env secretRef 解析，说明服务端引用基础存在，但它不提供模型级授权/仅写动态替换，且直接按字符串查 env；不重建 identity，也不能把任意客户端 ref 当模型解析能力。模型使用受控部署 secret store，或在明确审批的过渡受限加密存储中保存 secret revision，配置表只存引用。生产存储/加密根、权限分离及轮换责任必须在实施审批中确认；不可用则停模型，不读旧裸明文兜底。

切换为先建新 revision→核对模型预期修订/CAS→切引用→撤旧；跨外部 secret store/PG 的操作保存持久补偿状态，不承诺分布式原子提交。CAS 失败处理孤立新 revision，不能先删旧 key 导致丢失。先部署无秘密 DTO 与表单，再迁移/去除旧明文。已有访问与备份残留由安全负责人按实际证据处理，不能将静态泄露路径宣布为实际泄露。

## 2. 知识/技能命名空间与现有RLS收紧

### 可信命名空间

待新增 `KnowledgeNamespace` 表示平台解析的 `(organizationId, scope, scopeId, knowledgeKey)`：global 的组织/scopeId 为 NULL；organization 的 scopeId 为本组织；department/user 非空且核验所属组织与成员/范围权限。技能 namespace 为组织或平台归属加 skillKey，其当前 `registerSkill` 不加组织造成跨组织版本分配/唯一冲突，使用同一命名空间机制修补，不扩展成 skills 安装治理。

控制器不从 body 采信组织、平台角色或任意 scopeId；普通组织管理权限与独立待新增 `platform.knowledge.manage` 分离。global 已发布读取可向获准租户开放，global 草稿/历史/管理仅平台身份。服务每次取版本、source/previous、替换 UPDATE 和 INSERT 均带完整 namespace，不以 UUID 或外围 RLS 代替应用授权。当前无独立 versions/history 路由，rollback 是实际历史消费者；未来如新增历史路由复用此端口即可，不在本 change 强行扩展 CRUD。

复用平台成员、权限和 DataScopeService 解析能力，不重造范围树。knowledge scope 与通用 Data Scope 不是两个互相替代的机制：先租户与知识 namespace，再功能权限与对应可信范围；范围只收窄。对用户 scope 加组织约束，不能只检查 scopeId=userId。完整检索/实际使用引用贯通由07承担；本文查询输出 entryId/version/namespace/contentDigest/source，retrieved 与 supplied/used 分开，不为未送入模型的列表制造 used 标记。

### 事务与NULL唯一

新增持久 namespaceKey（平台规范编码，不接调用方值）锁行，以唯一键创建后行锁串行化首次 draft 版本分配及发布/回滚；可复用表结构实现等效持久锁，不使用进程 Map。版本分配和状态变化在同一事务、使用可信事务上下文：锁域→来源/独立审批/敏感检查核验→分配版本→仅 supersede 本域→追加结果→提交。rollback 默认形成待审核的新草稿，审核后按正常发布事务生效；管理员回滚不绕过既有审核，最终追加 published 新版本与同域 sourceEntryId/sourceVersion，不修改历史正文。

知识表按四种 scope 建部分唯一索引：global key/version 与单 published key；organization org/key/version 与单 published org/key；department/user org/scopeId/key/version 与单 published org/scopeId/key。global 键不包含 NULL 列，避免默认 NULL 不等语义；技能分租户 org/skillKey/version 与平台 skillKey/version 部分唯一。另加 scope/组织形状及版本正数 CHECK、已发布/历史正文归属不可改保护。无需假定 PG15+，若用 NULLS NOT DISTINCT 须按实际版本显式兼容审批。

旧合法 organization NULL scopeId 可受控归一，不明归属、同域重复 published/version 先隔离人工修复；不能自动把未知行变 global，不能删除历史掩盖冲突。

### RLS不是缺失，而是不精确与部署未证

`release-agent-rls.ddl.ts:47–64` 已有 nullable-org RLS，组织写条件存在，不能把旧跨租户离线例视为部署攻击事实。剩余是 NULL 组织 SELECT 包含所有状态、没有知识 namespace 形状/平台管理区分；专项迁移也不在常规 data-source 列表，部署状态未经真库确认。

只替换知识/技能策略：租户组织读写与 global published 只读分离；平台 global 管理走独立最小权限数据库角色、HTTP 平台权限核验和明确策略，租户连接不可通过自设 platform_admin GUC 授权。租户缺组织上下文在入口/事务中拒绝，不能因为 global 只读策略存在就接受匿名全局查询。USING 与 WITH CHECK 都按可信组织拒绝越界，部门/user 范围由应用层执行，符合现有 META “RLS 做组织、范围在应用层”的职责。

新增 migration，不编辑旧迁移；核对知识创建及新增安全迁移实际入口、schema-baseline 的一致消费。专项就绪验证知识/技能/namespace 表及每条必需策略，而非通用 RlsPolicyService 当前“任意策略存在/只检查 blueprint_records owner”的粗检查。生产角色非 owner/非 superuser/无 BYPASSRLS；全平台就绪改造由03承接。

## 3. Registry生命周期是真源，会话仅投影

### 接线与事件

接线保留 `ChatOrchestrator → direct/MCP bridge → libs/agent-tools AgentToolRegistry → platform-core audit writer + RegistryExecutionEvidencePort → PG`。MCP `_meta.contextId` 已按平台引用传身份，仍必须委托同一 Registry；不另建网关。现有 args/schema、all-of 权限、DataScopeGuard、确认条件 UPDATE 及拒绝不回退工具均保留。缓存命中重授权和确认用户/turn/expiry 完整绑定由07实施，本文只要求真实命中也有可核实事件，不把命中当新执行。

待新增事件 received、validation/profile/app_context/permission/data_scope/confirmation_rejected、execution_started、execution_succeeded、execution_failed，开始后无终态为 outcome_unknown。事件包含 attemptId/seq、timestamp、tool/contractVersion、可信 userId/组织/安装/profile/来源入口、conversation/turn/action（无会话明确 NULL）、argsDigest/digestKind、permissionDecision/missingPermissions、scopeDecision、confirmationId、resultCode/resultDigest/授权结果引用/latency。effective release 或 candidate 仅从平台上下文附加，未可用标 unavailable，不能请求方补写为真。

actor 保留可读审计标签，但 HTTP 当前 email 不能作为 DataScopeGuard.userId 或事实用户 ID；新增 trusted userId 与平台解析角色/组，适配现有 identity，不将模型传的 permissions/roleKeys 纳入判断。完整上下文由00/07消费方统一传递，本文不重建身份系统。

实际参数摘要复用 `libs/agent-tools/src/confirmation-token.service.ts:31–33` 的 canonicalizeJson/SHA-256，计算后再脱敏；不合法但可解析参数留候选摘要与 validation_rejected，无法解析字节由入口安全审计 raw_invalid/requestDigest，argsDigest=NULL且原因明确。认证前失败只记匿名 requestId；认证后工具尝试必须有真实稳定主体，权限未评估不写 true。

### 持久性与兼容投影

复用 `libs/platform-core` 现有审计服务及审计合规 change 的追加/哈希链机制；新增领域 execution events/attempt 状态，只表达工具事实，不再发明第二个审计链。事件唯一 `(attemptId,seq)`，普通 Agent/客户端无 UPDATE/DELETE 权限，结果按原组织和对象读权限访问。`agent_tool_calls` 为事件投影，新增 evidenceOrigin/attemptId/状态/结果引用；会话移除 `hash({})/permissionOk=true/success` 推断。

执行前持久 received/拒绝/started；证据存储失败返回 EVIDENCE_UNAVAILABLE，不 invoke。执行后持久结果失败不能宣称工具失败等于副作用回滚，也不能伪成功，返回 attemptId/outcome_unknown；后续经04的确定性命令/业务持久事实核对追加 reconciliation 事件，未核对维持未知。事件与外部副作用不承诺 exactly-once。

计划存 proposed/pending_confirmation/actionId，事实 trace 只引用 execution_succeeded；会话 completed 不是工具成功，写计划未确认 invoke/成功都是0。旧无 Registry 来源 success 标 legacy_unverified，剔除统计与发布证据，不能补假摘要/权限漂白。07负责实时 SSE/取消/恢复，08消费展示，本 change 固定它们使用事实事件的接口。

## 4. 早期生产拒绝与后续真实门禁

待新增平台 `ProductionEvidencePolicy.assertEligible({operation,environment,candidateDigest,evidenceRefs})` 在 `libs/platform-release` 定义端口，由组合根注入平台实现，不反向依赖 apps/api 的 eval service。初期生产 eligibility=false，publish/activate 新候选与A1/A2许可及策略后台入口均检查；缺实现也拒绝。A2 再额外保持关闭，扫描 enabled policy 不记评测成功，不能因 old policy=true 或 RELEASE_ENABLED 默认开启旁路。

现有 G4 TestEvidenceService/CI JSON 摘要是已实现资产；不删除或重造，但组织/app/时间新鲜度不能证明与候选一致，caseResults 自报、URL非空、G4 execution disabled 也不能获得生产资格。01只去除这些来源的放行效力；09负责 runner 验证及 G0–G8 实际必需证据，05负责审批/签名完整制品，06负责安装原子有效版本，10负责有限A2资格。接口依赖而非01硬依赖09，避免循环。

完整顺序为**冻结 candidateDigest→未发布隔离候选真实测试/评测→可信审批→签名但未公开工件→最终 GateDecision→published→activation**。不能为了查 EvalRun 要求先 published，也不能让人工审批或文档“已完成change”绕过真实证据。notApplicable 由后续平台按真实diff判断，缺失/跳过/不可用不伪passed。既有已安装稳定版本继续确定性业务；隔离开发必须独立非生产数据/凭据、标清 nonProduction，不产生生产副作用。

## Risks / Migration / Acceptance

风险为引用切换失配、历史归属不明、并发版本和审计故障。分别用先建后切与补偿、隔离人工修复、持久锁加唯一约束、短事件写入与未知结果核对缓解。降低可用性是 fail-closed 的明确取舍：安全回退只能停模型/知识写检索/AI执行，不能撤约束、恢复密钥读回、推测 success 或自治放行。程序回退必须理解新约束，既有 PG jobs/identity/范围/安装事务不改造为新旁路。

已核对现有命令：根 `npm run ci` 指向 `scripts/ci/pipeline.sh`，执行 check:all、API Jest JSON 与 evidence recorder；check:ci 虽 warn-only，不等于该统一CI入口同样 warn-only。`npm run test --workspace @sap/api -- --runInBand`、`npm run test:e2e --workspace @sap/api -- --runInBand`、`npm run migration:run --workspace @sap/api` 存在，但不在本次执行。web-console 无测试 script；`test:ai-trust`、PG/HTTP/browser 专项 harness/命令均待新增，不假称可运行。现有 recorder 的生成/可选注册不等于候选安全验收。

实施验收必须覆盖全部18场景且记录同 SHA、实际 PG/浏览器/provider/model 版本、迁移与角色、实际用例/断言/失败/跳过数；真库/真实HTTP/浏览器不得用内存仓库/静态序列化代替。未跑真实模型不声称注入安全或自治质量；真实 runner 缺失不放行生产自治。当前只运行 OpenSpec 严格格式校验；真源更新、安全/业务批准与授权部署验收留在未完成 tasks，不以本文作为生产关闭凭证。

### 技能状态的兼容说明

上文 global published 只读专指知识，不能套到 `agent_skill_versions`：其现有状态为 draft/canary/active/retired（`apps/api/src/agent-knowledge/entities/agent-skill-version.entity.ts:18–19`）。技能租户读取只按既有可信 Release 绑定及可用状态规则收窄，draft/历史不得经 NULL 组织 SELECT 暴露；当前无可信读取消费者时拒绝 global 技能租户读取，不创建新读取 API、不新增 published 技能状态，也不扩大技能治理范围。任务3.2/3.4和专项真库拒绝集须分别对拍知识与技能状态。
