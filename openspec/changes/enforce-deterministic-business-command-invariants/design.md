# 确定性交易命令设计（weichen 复核版）

## Context 与边界

基线为 `ce1e538dcec6539f66bba80d5413a3b6741486c9`。实现 owner 必须沿装配辨识：SemanticRuntimeService/Outbox 仍是 apps/api 实体实现；Blueprint、AtomicExecutor、EventBus、dataScope 与 identity/jobs 在平台库；Registry 在 libs/agent-tools，由 apps/api 的 AgentToolsModule 用 ports 装配。不能仅搬目录或沿旧 backend 路径提出整改。

编译器已经检查 flow DAG、状态与引用；运行时已有审批、汇总、记账及 dataScope。`CompiledTemplate` 已用于正常写读路径，但 `libs/platform-release/src/blueprint/compiled-model.ts:32–37` 没有 flow，`record-transition.ts:28–51` 只检查 from/to。本设计补执行闭合，不另造协议/引擎。金额库、头行 writer、单号 UPSERT/savepoint、唯一/非空约束、通知去重等均保留。

所有以下新接口/字段/套件是**待新增或待收紧设计**，不是基线已实现声明。Kernel 不访问模型，不接任意 SQL/脚本；Agent 仅经 Registry 提议/调用平台准许用例。生产上下文、授权和事实不由模型或客户端提供。

## Goals / Non-Goals

目标是统一首批业务用例并可证明版本、引用、库存、数值和事件不变量。非目标包括新工作流、通用审批/任务系统、树克隆/归档、工作台重写、发布激活实现、模型接线或评测 runner。保留 Nest/TypeScript、PG/TypeORM、Nx/npm 与零能力纯计算 Wasm。

## 1. 应用接口与兼容接线

| 接口 | 待冻结契约与边界 |
| --- | --- |
| `CommandService.execute(context, envelope)` | 首批 commandId 为 document.create / record.delete / record.transition / record.approve；record.update 待实现后才登记。envelope 含目标、payload、expectedVersion、idempotencyKey；返回 commandExecutionId、committedVersion、eventIds、脱敏结果或结构化拒绝。 |
| `BusinessCommandPort` | 待加到 `libs/agent-tools/src/agent-tools.ports.ts`；Registry 业务工具在参数/权限/确认/范围校验后调用。应用 adapter 在组合根注入，禁止 libs/agent-tools 反向 import apps/api 服务。 |
| 可信执行上下文 | organizationId、appInstallationId、userId、permissions/permissionVersion、traceId、有效定义摘要及安装修订；全部由平台解析。工具附实际 invocation 与核验确认的关联，不接受 args 自报成功。01/07 拥有 Registry 生命周期/令牌，06 拥有有效 ReleaseContext。 |
| 命令确认接缝 | 规范化最终参数先产生 canonical digest，Registry 确认须绑定它。幂等命中先重新授权再读结果，不把已消费一次性 token 要求误当作必须再次执行；未完成命令按 07 的恢复凭据重新核验，禁止绕过确认。 |
| `OutboxService.publish(manager,event)` | 保留既有 manager 接口，收紧为必须真实事务/可信租户上下文；同键同事实返回既有 ID，不同摘要拒绝；06 复用，不在本项定义 activation。 |
| 交易证据 | candidateDigest/codeSha/schemaDigest/planDigest/migrationVersion/suiteVersion/caseId/actualAssertions/observedEvents；09 接入候选 runner，不要求 published Release 先存在。 |

人工现有 `/blueprints/:id/records/...` 路由改成薄 adapter，共用 writer、审批/记账与查询后处理；不保留直接写 repository 的第二入口。读、历史与 suggested-transitions 保持只读。门户已有 `BlueprintAppRuntime → blueprintsApi.createRecord`；console 已有版本可选的迁移按钮；仅迁移 DTO、数字编码和冲突展示，正式 UI/会话扩展归 08。

旧语义审批 `/approvals/:ruleId/approve`（`semantic-runtime.controller.ts:274–294`）不得继续把 body.role 当权限。ReviewDecisionService 已有角色/assignee/selector 判断并注册，但本次未查到非测试 act/resubmit 消费者，旧语义路径也没有调用它；不能把新 provider 的存在说成旧路由已经修复。待适配到此既有逻辑及可信身份解析或同等受控接口，补同 manager/锁/范围执行；当前步骤合法审批者来自组织成员角色、assignee、权限与范围，请求角色只能作选择提示。已有轮次、机器检测、人工决策逻辑不重做，接线与事务仍待验收。

**版本规则**：修改、删除、迁移、审批强制目标聚合 expectedVersion；头行由头版本保护，相关行更改及 setNull 推进源头版本。审批依据绑定内容/规则摘要；技术版本推进不无条件撤销审批，但内容/汇总改变必须失效并按既有 review 新轮次重审，避免审批自身推动版本导致永远无法完成。锁定后核对原状态、版本、权限、范围和定义，不用 adapter 读最新版本自动补填。

错误建议：缺版本 428，旧版本/状态/同 key 改参 409，非法数值/未支持行为 422，越权 403，他租对象 404，依赖不可用 503。复用现有 RecordWriteError 并补结构化 code/traceId/commandExecutionId；仅授权者看到实际版本/引用方，不能通过错误泄露成本或他租数据。结果不明时查询持久状态，不能刷新版本盲重试。

## 2. 单事务与持久幂等

保留 `document-writer` 头行同 manager、序号 UPSERT 和 bounded savepoint 重试；不承诺单号无间隙。应用命令拥有业务事务：设置事务级可信组织/安装/用户上下文，锁命令执行权，再按稳定顺序锁头聚合、步骤、引用与库存，重算字段/范围/规则/审批，执行业务写、库存、分录、audit、outbox 与持久结果，最后提交。所有服务必须显式共用 manager 或已验证的 ambient transaction，不仅在注释上说“同事务”。禁止事务跨模型/网络通知；纯计算原子受预算限制，失败回滚。

**待新增命令执行账本**不是新 JobQueue。唯一命名空间包含组织/安装/可信用户/commandId/idempotencyKey，保存 canonical requestDigest、definitionDigest、目标版本、running/completed/rejected、执行 owner/fence、期限、结果与事件引用。先用短事务 INSERT ON CONFLICT DO NOTHING 预留执行权；同键改参冲突。业务事务锁同一命令行并检查 fence，结果与业务一起提交。崩溃前业务未提交则可在旧事务锁释放后接管并提升 fence；提交后丢响应则读取同一 completed，旧 owner 不得续提交。确定性拒绝在回滚后按 fence 记录，暂时不可用不记业务完成。

已有 `libs/platform-core/src/jobs/job-queue.ts:69–107,237–280` 提供 PG 入队幂等与 SKIP LOCKED；长运行工作只桥接 commandExecutionId 到现有 jobs，不重建任务表/进度/取消。Job handler 至少一次仍须依靠业务账本，而不是声称 Job 唯一键自动提供同步交易恰好一次。命中结果重新验证当前身份、安装、权限/范围和定义兼容，撤权后禁止返回缓存敏感结果。

## 3. 执行计划与窄库存用例

在已有 CompiledBlueprint 的运行时形态中增加封闭 `FlowExecutionPlan`（待新增内部结构，非新外部 DSL），覆盖已冻结 semantic.transitions、transition.rule、flow entity/on/next/actions 和 validation/approval/accounting 引用。编译产物与 fallback 必须等价，计划摘要绑定 candidateDigest。支持矩阵必须逐项从 schema 与 evaluator 冻结；未知 action/operator、规则类型错误、未许可模块、缺 binding 一律阻断相关交易，不只通过 schema 然后忽略。

flow 的 on 表示状态，源 step 的 next 必须许可目标；源/目标检查的适用时机与固定次序在冻结计划中显式写出，按 step/action ID 去重。transition.rule 必须真实求值；require-approval 读取同一可信审批链及锁后重算汇总，不能再造条件真源。无 flow 的简单实体仍按语义状态机执行；有 flow 的实体只有完整覆盖动作才成功。

`templates/auto-parts/flows.json:7–31` **只有 check/require-approval**；没有库存 effect。库存预占/出库是新增候选绑定，不是声称旧模板已定义而实现漏调。批准的 Delta 对齐 SalesOrderLine 的数量/单位与 StockItem，再由平台封闭命令目录按模板/候选摘要绑定：确认预占、出库消耗本订单预占、关闭不重复扣减；缺绑定拒绝，不能靠状态名启发式推断。available-inventory 与五个 autoparts 原子的契约/列/图语义不同，不默默互换。

库存事务投影（待新增）按组织/安装/库存对象/单位/标度唯一，拥有 onHandMinor/reservedMinor/version 和订单行预占状态。它是命令唯一更新的权威投影，Blueprint StockItem 的对应字段不能独立写成第二真源；初始导入须同步对账。条件 UPDATE 与 CHECK 保证 `0 ≤ reservedMinor ≤ onHandMinor`，确认有足够实库可用量才预占，出库等量减少本订单预占与实库；不把 inTransit 当实库可出货。重复出库/预占受唯一键和状态 CAS 保护；取消/退货未批准则拒绝，不能简单改状态冲销。

## 4. 引用完整性与聚合竞争

保留 collectRefs/restrict/setNull 的既有判据。待增加规范化引用边，源/目标端点使用组织/安装/记录组合 FK，实体/字段由冻结模板校验；新增引用锁目标 key-share/聚合，删除锁目标并查边，FK 为写删竞争最终拒绝边界。历史记录安装归属须由可信映射回填，不能编造；缺证据隔离只读。

setNull 只用于声明可空且支持的字段，锁定所有受影响源聚合，执行字段/规则/范围检查、清空 payload/边并推进版本，同事务提交；required 或规则不满足全部回滚。递归 cascade 已有拒绝边界保持，技术边表清理不是业务级级联。超锁定扇出拒绝并转受控批次，不无限扫描。数据库约束和应用错误映射都要验收，不能只证明一笔事务存在。

## 5. 数值闭合与 ABI

共享 `libs/shared-core/src/lib/money.ts` 是唯一算法；apps/api/src/blueprint/money.ts 转接 @sap/shared-core，platform-release 的 expression-evaluator.ts 直接从 @sap/shared-core 导入，并不存在独立 platform-release/blueprint/money.ts 实现。parseFixed/assertFits/roundTo 已存在，不重写。原型兼容接受 number 的入口/表达式必须收紧：decimal/money 写命令只收十进制文本，拒绝指数、NaN/Infinity、超标度/超 p；裸 decimal 继续采用已批准默认 p18/s4，不能擅自禁掉正式协议允许的缺省。enum 必须属于 values，整数数量必须安全且受字段范围，允许分割的数量使用 decimal 文本及明确单位/标度。

完整汽配 `semantic.json:99–117` 当前 number 数量与 decimal 单价混算对非整数明确拒绝。正确整改是批准候选 Delta，将需要小数的数量改成固定标度，而不是去掉精度来源不明的拒绝。汽配 UoM 原子协议已有数量标度 3（`docs/protocols/autoparts-atoms.md:25–30`），只能用于对应 UoM 绑定；业务库存/订单标度和单位需批准并对账，不能推为所有业务的通用数值政策。

入口校验先执行 p/s；中间精度保留；每个最终行金额在声明写入点只调用一次 roundTo，再 assertFits，汇总使用同一量化行值，审批/分录引用同一总额。当前 eval-context 只格式化，需补精度判定与持久派生一致性。币种沿声明传播，未有批准换算禁止跨币种相加/入账；分录需显式携带所引用金额的币种/标度，不默默套全局 scale=4。journal 目前 PostgreSQL signed bigint 小单位，写前必须校验 `[-9223372036854775808,9223372036854775807]`；38 位声明与可入账范围取交集，超范围整个交易拒绝。如需更宽物理类型另经批准迁移，不在运行时静默换型。

ABI v1 不变。真实 `libs/platform-release/src/atomic-runtime/atomic-executor.service.ts:305–316` 投影前须检查安全整数与 `[-2147483648,2147483647]`，检查已声明更窄列域与标度无损转换后才写 Int32Array。业务定点→列投影在宿主用 bigint，无标度/不整除拒绝，标识/货币/租户不进模块。输出反向转换及中间溢出错误码按既有协议拒绝，无部分结果或内置降级。不能把实际默认 Wasmtime 误写为 V8；引擎选择/readiness 由 00/03 负责，本项保存实际引擎/ABI/模块摘要作边界验收。

## 6. Outbox 短领取与消费者效果

当前 dispatcher 通过 withTenantContext 包住一个组织的整个 drain；它是真事务传播接线，却将多事件/handler/WS 放在长事务里。改为三个边界：组织内短领取事务 `FOR UPDATE SKIP LOCKED`，写 worker/lease/fence 后提交；租户本地消费事务处理各 subscriber 的 inbox+数据库效果；短完成事务按 fence 确认 event/delivery。网络/WS 只在本地提交后发，允许重放，客户端按持久 notification ID 去重。租约过期可重领，旧 fence 不确认新 attempt。保留 attempts/lastError/退避/手动重投，缺必需订阅者明确 blocked，不按空 subscribers 默认 delivered。

事件唯一命名空间由现有全局 idempotencyKey 收紧为组织/安装/逻辑键，并核对事实摘要（topic、aggregate、payload、版本/定义关联）；重复相同事实用 INSERT ON CONFLICT DO NOTHING 后读回，不捕获裸 23505 然后继续事务；不同内容冲突，不覆盖。importMaster 当前每行独立事务是有意的部分成功，本项不强制全批原子：各成功行若产生事件须同其事务；最终批结果及 completed 事件同一个完成事务，恢复不得漏汇总或再次导入成功行，不能说事件与所有行同事务。

稳定 subscriberId 为显式注册常量，扩展现有 EventBusService.subscribe/listSubscribers 为唯一注册面，保留进程内兼容 API，不另立订阅配置。迁移类名→稳定 ID 须批准历史映射，不能清空旧 deliveries 引发重复效果。本地去重可以扩展已有 outbox_deliveries 为 processed inbox，而非必须新增同义表；记录“效果已提交”而非“先占行即完成”。通知已有 UNIQUE(sourceEventId,userId)，保留并改无异常冲突，与 inbox 同 manager 原子提交；失败不留 processed。

外部消费者使用 event+subscriber 稳定供应商幂等键与发送账本；响应不明须查询/对账，供应商不支持时标 unresolved/blocked 或明确人工处理，不能通用宣称只发生一次。系统承诺至少一次尝试，本地数据库逻辑效果在已验收幂等边界内一次；不承诺 WS 包或任何外部网络恰好一次。

## 7. 迁移、回退与风险

顺序为扩展接口/约束→清点旧数据/类名映射→回填/隔离/对账→适配切换→收紧。只新增迁移，不改历史迁移；保留 RLS 非 owner/无 BYPASSRLS 要求。版本/金额/安装映射不可信的存量仅展示只读/需处理，禁止把旧 float 字符化后宣称恢复精度。新旧兼容写最终共用一个命令，不长期双写库存/规则。

安全回退关闭新交易工具与未验收命令，保留已验收确定性能力和只读，不恢复无版本、模型旁路、任意级联或回绕投影。已提交分录/预占/命令/inbox 账本不删；补偿用独立批准逆向命令。06 负责有效安装/数据迁移回退，本项不覆盖其事务。

锁争用和扇出以稳定锁序/批限制/小计算预算约束；迁移误差逐行对账隔离；计划与规则漂移以 candidateDigest/planDigest 和拒绝集约束；ABI 范围不足拒绝而不扩协议；subscriber 重命名批准映射；结果泄露命中重新授权。没有真库/宿主/浏览器证据不能消除这些风险。

## 8. 验收命令与放行

已核对实际 package.json：根 `npm run check:all`、`npm run wasm:test`、`npm run ci` 存在；`npm run test --workspace @sap/api -- --runInBand`、`npm run test:e2e --workspace @sap/api -- --runInBand` 和 web-portal/web-console build 存在。root ci 脚本会 npm ci/lint 写环境，不属于本次允许执行；本次不运行。`.github/workflows/ci.yml:169–189` 已建 kernels/platform libs、wasm-host 和两个前端，不能复用 main 的漏建诊断。`scripts/ci/pipeline.sh` 与 test-evidence 已存在但不证明本主题真实交易套件/候选绑定通过；03 审查质量入口，本项只接自身验收。

**待新增** `@sap/api` 的 test:transaction-invariants（PG/RLS 双实例、命令/库存/引用/事件崩溃）；test:abi-numeric-boundaries（实际冻结宿主/模块）；门户/console 的 test:transaction-browser-evidence（复用 03 测试底座和实际 UI，不造模拟产品页面）。本主题已有 document-runtime/decision-runtime/outbox/currency-permissions e2e 可扩充，但其中 unavailable early return 不能算有效执行；前置失败/必测 case 缺失/断言零/skip/unavailable 必须形成阻断证据而非 PASS。

冻结 candidateDigest→真实确定性测试与 09 模型评测→审批→签名未公开工件→最终 GateDecision→published→activation；不构造先 published 才测试的循环。04/05 可并行，06 汇合；07/08/09 联合出口后置，不阻断前段隔离研发。报告记录实际 PG/角色/RLS、Node/TypeORM、浏览器、引擎/ABI/模块与套件版本，以及逐例观察值、事件关联、断言/失败/skip/unavailable 数。无模型确定性套件不能替代 AI 评测，必需证据缺失不得放行生产新交易或自治。本次仅 proposal 与静态 OpenSpec validate，无生产关闭结论。
