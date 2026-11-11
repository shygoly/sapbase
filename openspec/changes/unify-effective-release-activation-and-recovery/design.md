# 实际生效版本与可恢复回退设计

## Context

基线 `ce1e538dcec6539f66bba80d5413a3b6741486c9`。真实所有者：Release/Blueprint在 `libs/platform-release`，安装聚合仍在 `apps/api/src/business-apps`，PG任务/RLS/身份/data-scope在 `libs/platform-core`，工具入口在 `libs/agent-tools`，UI版本消费者在 `libs/ui-runtime` 与 `apps/web-portal`。`apps/api/src/releases` 只是兼容导出和DI装配；库不得反向import应用。

目前 HTTP `TenantTransactionInterceptor → withTenantContext → runInTransaction` 已提供环境事务，AppModule注册 transactional DataSource。这改变了旧“任何HTTP失败都会留下已撤active”的判断：本次没有验证其真实传播，不能宣称该故障已重现。但 Release 服务仍缺自身安装锁/CAS/指针接线，worker恢复不能依赖HTTP拦截器，且 Redis/通知不能随DB回滚。因此采用现有原语的显式协调，而非重建事务/队列。

## Goals / Non-Goals

目标是单一平台解析和写入有效版本，稳定路由，受控可恢复切换，依据当前实际数据拒绝不安全回退。非目标是审批签名实现（05）、通用job重建、数据范围审查、模型接入/会话状态机（07）、新UI框架（08）、候选runner（09）及A2政策（10）。业务规则保持确定性，Registry、既有蓝图/Delta/金额库和安装历史不替换。

## Decisions

### 1. 摘要和模型只作加法扩展

当前安装及修订 `releaseDigest = loaded.plan.irDigest`（安装service:334–344），保留这个历史语义。新增名称区分 `releaseCatalogDigest`（05完整payload）、`blueprintPackageDigest`（包字节）及 `blueprintIrDigest`（编译IR）；不得互相代替或凭版本号认证。05提供的不可变描述还含candidateDigest、可信packageRef、appKey、授权scope、Runtime/依赖、迁移计划摘要及最终GateDecision引用。

待扩展 `app_installation_revisions`：releaseId、上述独立摘要、jobId、migrationLedgerHead、configDigest；既有packageId/previousRevisionId/IR快照继续兼容。待扩展安装/绑定：默认currentRevisionId与routingRevision；显式routeKey指向本安装追加修订/activation。默认唯一，cohort每routeKey唯一，组合外键保护org/安装/修订归属。安装快照只代表默认，不伪称所有灰度用户均使用它。

activation原始事实只追加，保存from/to修订、目标digest、principal、reason、jobId、cohort政策版本。当前active由唯一绑定与可变状态投影解释，不改旧事实。现有单默认active约束在受批准迁移中等价迁到绑定/投影，不能单纯删唯一约束以容纳双活。既有scheduled/cancelled语义保留；计划到期必须重新授权与核对预期基线，本次不扩为定时调度平台。

### 2. 端口与DI不倒置

下列为**待新增/扩展接口**，不是现有代码已实现的API：

- 05 `PublishedArtifactResolver` 的安装purpose适配：按可信principal/org/安装检查目标可见性、appKey、批准摘要、签名、依赖、Runtime、发布/吊销状态及最终GateDecision，返回冻结描述；06不另存制品真源。历史superseded目标只有在05明确定义可回退且兼容时可用，revoked/failed/preview不能生产激活。
- `EffectiveReleaseService.resolve(trustedAppContext, pin?)`：读取唯一default/cohort绑定，返回只读 `ReleaseContext`；不得回退到latest、URL包或缓存随机命中。
- `ReleaseSwitchService.submit(command)` / `resume(jobId)`：版本变更唯一协调器，位于platform-release，通过待新增 `ReleaseInstallationPort` 调用安装聚合的 `read/lockAndAppendRevision(manager, expected, target)`；应用层工厂注入BusinessApps适配器，库不import apps/api。从当前 `commitReleaseChange` 提取并复用安装锁/CAS/追加修订代码，不再保留平行直写方法。
- `MigrationCompatibilityService.verify(source, target, dataHead, purpose)`：06 在隔离 candidate purpose 中运行方向性兼容验证并经 `MigrationCompatibilityEvidenceReader` 输出实际 ledger/脚本/结果给09；该前段不要求先有09 G3、published 或生产 activation。生产 switch purpose 才消费09已完成G3/最终GateDecision并重新核本安装实际数据水位；引用字符串或rollbackSafe布尔不代替执行证据，候选验证不得建立生产绑定。
- `ReleaseOperationHandler`：注册到现有 `JobTypeRegistry` 的版本化白名单类型（如拟新增 `release.switch@1`），使用现有 `JobQueue.enqueue(input, manager)`、领取/租约/job-events。`ReleaseOutboxPort.publish(manager,event)` 是**已有**端口（release-ports:33–35），04只增强可靠投递/消费者，本次传同一个EntityManager。

### 3. 复用PG任务，补操作幂等和提交回执

不建旧设计的 `app_release_operation_jobs` 平行队列。PG `jobs` 已有org/type/key唯一索引、进行中状态、attempt、workerId、leaseUntil、result、events；新增Release操作扩展/关联回执（非调度真源），保存可信principal、安装、operation、requestDigest、targetDigest、expectedRevisionId、expectedRoutingRevision、迁移checkpoint、提交结果和稳定eventId。

现有队列同key会返回旧payload（job-queue:99–107），所以薄适配层必须先授权，再将 `(installationId, principalId, operation, callerKey)` 规范化成内部key，并比较持久requestDigest；同key异参409，不同用户不可共享结果。digest覆盖目标目录/包/IR、配置、cohort政策、reason、基线及迁移计划。每次submit/resume/结果查询重新核验身份、成员、功能权限、安装状态和目标可见性；job createdBy或模型输出不是权限凭据。租约过期只能接管，不能意味着业务已回滚。

切换提交必须检查任务attempt/lease/fencing CAS，防止同一workerId的旧attempt复活。现有队列complete只按workerId/state更新且不收manager，不能直接当作“已与指针原子完成”的接口。为本handler提供受控的同manager提交回执/终态扩展；通用worker若提交后遇响应丢失、超时或cancel，应先查不可变回执再分类结果，不能把已生效任务改failed/cancelled或再次切换。此扩展限定Release业务提交语义，不重造通用jobs状态词。

### 4. 短事务与执行顺序

1. 可信准入及创建/读取持久job；先解析目标实际工件、验签、授权、Runtime readiness及当前到目标兼容路径，不改旧active。入队使用已有manager参数，不在长HTTP事务里等待迁移/模型/外部服务；202表示真实任务已入队，不把caller key当jobId。
2. 如需长迁移，在锁外按批准的expand/migrate批次执行，每批短事务、可信RLS、确定性checkpoint；必须保持旧active可读写兼容，必要写栅栏持久化并可解释。不可让未验证的迁移在灰度用户上试写生产。
3. 最终短事务设置 `app.organization_id/app.app_installation_id/app.user_id`，锁安装行，并校验调用者预期修订、routingRevision、任务租约代际、当前ledgerHead和目标状态/证据；期间变化拒绝或重新验证，不沿用旧检查。
4. 同EntityManager写追加安装修订、activation事实、唯一默认/cohort绑定及状态投影、ReleaseEvent、Outbox、不可变提交回执/任务业务成功结果。稳定eventId从jobId/操作派生。任何一写失败全部回滚；错误只能在事务结束后的独立短事务记录。
5. 提交后由04消费者执行缓存失效、Next重验证、通知，至少一次投递+持久inbox。Redis或通知失败表现为“版本已生效/投递待重试”，不得重做切换。HTTP环境事务是现有保护，但不得以此省略worker/内部命令同样的验证和提交契约。

| 断点 | 恢复规则 |
|---|---|
| 目标/兼容/预期基线失败 | job记录拒绝，旧绑定不变，无生效event |
| 迁移批次后中断 | 读取实际ledger与水位续跑，未知状态unavailable并保留安全写栅栏，不盲重放脚本 |
| 指针提交前异常/退出 | PG回滚，接管按任务CAS继续验证 |
| commit成功但响应丢失 | 回执与绑定已存在，返回同结果，只恢复Outbox投递 |
| lease接管后旧worker继续 | fencing/attempt CAS拒绝旧写，不覆盖终态 |
| 取消与提交竞争 | 提交前取消不切换；提交后取消不得伪称撤销生效，明确已提交结果 |

### 5. ReleaseContext、消费者和pin

`ReleaseContext` 是现有BusinessAppExecutionContext只读加法扩展，建议冻结字段：org/安装/appKey/principal/permissions/runtimeProfile/traceId，releaseId、releaseCatalogDigest、blueprintPackageDigest、blueprintIrDigest、installationRevisionId、defaultRevisionId、routingRevision、activationId、cohortId/cohortPolicyVersion、dataSchemaGeneration及受制品绑定的tool/skill/knowledge版本引用。legacy稳定安装的releaseId可为空并明确legacy来源，不伪造目录审批；它仍有已验证的包/IR与修订引用。

`AppContextGuard` 已检查路径id与X-App-Id一致（guard:32–39），保留回归测试，不再提“建立此检查”的修复任务。拓展语义/Blueprint定义及记录API为安装受控入口，并核对兼容URL包ID等于本次有效packageRef；设计时/候选装载使用单独权限/purpose，不能沿业务接口直接传另一个已授权包。发布runtime controller当前忽略appKey（controller:299–304），要核对路径appKey/安装/header一致。

现有UI consumer只改数据源和版本响应契约，不重写list/form/detail。后端定义、记录、工具计划、Agent及审计用相同解析结果；浏览器只消费投影，不提交权限/版本来替代平台判断。缓存键包含org/安装/路由修订/不可变定义摘要；已有编译缓存改为digest定位或由context选出的精确immutable packageRef访问，保持tenant许可验证与过期检查，不用basename判生产版本。

百分比cohort用已批准、版本化seed/salt，对 `(org, installation, stablePrincipalId)` 做稳定HMAC分桶；桶规模和政策参数在契约批准时冻结，不自行规定晋级窗口。角色/部门/名单从可信版本化成员信息解析，规则互斥、优先级可判、同用户唯一目标；无命中取default，歧义/缺default拒绝。生产cohort共用数据须有双方读写/工具兼容证据；不兼容候选只进隔离namespace/脱敏数据/独立凭据的preview。preview绑定candidateDigest及可信审批人，不能改生产ReleaseContext。

请求/turn首次解析一次pin，后续不能漂移到新latest；07持久保存完整pin，08处理人类旧页面冲突。每次写重新授权并比较用户当前有效修订/路由/数据代际，变化返回 `RELEASE_CONTEXT_STALE`，必须重新解析和确认。只读pin也受吊销/许可/数据兼容窗口约束；不满足则暂停/拒绝。Registry仍为工具唯一入口。

### 6. 真实迁移与安全回退

拟新增安装迁移ledger（org/安装、源/目标目录/包/IR摘要、schemaGeneration、ledgerHead、migration/scriptDigest、phase/checkpoint/state、jobId、executorVersion、actualBefore/After、证据引用），每批幂等，租户/app隔离。兼容矩阵具方向性和时效：当前实际数据、目标解释器、Runtime/工具契约、读写共存、脚本摘要及影子验证水位都匹配才有效，数据代际/contract变化使旧证据失效。

先expand，再migrate验证双读/双写与引用一致，最后contract只有无旧cohort/pin/任务依赖且补偿和批准证据满足才能执行。现有 `Template Upgrade Preserves Existing Data` 的声明默认值、读不改写和新写约束全部保留；本次新增的是跨版本真实路径与恢复证据，不覆盖正式条款。

回退先重载目标并核对历史IR/包与授权/未吊销、Runtime，再核验当前数据到旧规则的可解释性。需要补偿时用独立批准、持久、可查账的任务；实际完成且验证通过后才切定义。无证据、部分迁移、未知水位、精度/类型不安全收缩均拒退并保留当前active；`rollbackSafe=true`、旧目标标签或接受损失签字均不能兜底。禁止整库快照覆盖单租户，不承诺撤销通知或外部副作用。镜像回滚由03/10部署流程执行，必须兼容当前Release，本change不部署。

## Compatibility / Migration Plan

批准后先expand加字段/绑定/操作回执/ledger/RLS与组合约束，保留历史摘要和事实。只读对账真实签名、许可、包/IR和目录摘要：唯一可信映射可追加关联，歧义不自动认证；已验证legacy稳定安装继续确定性运行，无法验证安全条件时只读/拒绝并隔离处置。双读仅用于对账，禁止双写两套版本真源。API适配器统一后阻断直接切包；同步安装到202任务的破坏性变化必须发布客户端迁移计划。

关闭新能力只停止新切换，不恢复旧内存幂等/URL旁路。`POST /apps/:id/activate`仍为恢复暂停安装，但须复验原有效绑定、许可、吊销与Runtime，不接受新package/release。版本变更缺可信Release映射或必需证据明确拒绝。权威DOMAIN/META/release文档的更新在tasks登记，本文不修改它们。

## Validation / Risks

现有根 `npm run ci` 指向 `scripts/ci/pipeline.sh`，`npm run e2e` 指向 `scripts/e2e-release-agent.mjs`；后者:118–128,218–224只检查activation返回/whats-new与同目录rollback动作，未断言安装、真实UI、双版本数据或断点恢复。API现有 `test:e2e`；本change拟新增专用 `test:release-activation-e2e` 和 `test:release-context-browser`，实施时核对实际选择套件/前置失败非零退出。不得把当前check:ci的warn-only、旧main数字、fixture或OpenSpec格式通过当作生产放行。

隔离真实PG验证事务传播（HTTP和worker）、RLS角色、租约CAS、提交/取消竞争、恢复/事件幂等、方向兼容矩阵；浏览器验证实际UI请求摘要与旧页写冲突；Agent解析fixture只能证明接口，真实模型缺失不得标模型评测通过。生产只消费05/09同candidateDigest真实证据和最终GateDecision，候选验证不要求published。A2默认关闭直到10独立批准与联合验收。

风险包括旧API断裂、历史映射歧义、兼容窗口阻止contract、安装锁热点、迁移维护栅栏和撤权/吊销竞态。采用追加对账、短事务、明确拒绝、最终重验及可审计人工查账；兼容窗口/保留期/锁超时由已批准policy决定，不虚构普适时限。本次未执行真实库、模型、浏览器、迁移或部署。
