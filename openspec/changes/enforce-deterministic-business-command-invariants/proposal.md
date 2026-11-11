# Change: 共享确定性业务命令与交易不变量收口

## Why

本变更为修复序列 **04**，基线固定为 weichen `ce1e538dcec6539f66bba80d5413a3b6741486c9`，优先级 **P0 交易能力放行阻断 / P1 共享命令接线**。前置接口来自 `fix-ai-trust-and-execution-evidence`（01）与 `restore-reproducible-build-and-quality-gates`（03）；架构边界继承 00。前置是联合验收条件，不阻止按冻结接口隔离开发。本提案不是 main 评估的路径迁移，也不把 pending change、文档或静态校验当作生产完成证据。

weichen 已实现头行同事务、单号 UPSERT、审批/汇总/记账求值、提供版本时的迁移 CAS、数据范围、PG jobs、持久通知和通用蓝图表单消费者。尚存的缺口是交易命令的封闭共享入口、强制版本和持久结果、流程检查/交易绑定、引用竞争、数值入口与物理范围、以及可靠事件的真实事务边界。保留已有资产，仅收紧剩余可验收行为。

### 当前已实现及剩余证据

| weichen 精确依据 | 已实现与剩余边界 |
| --- | --- |
| `apps/api/src/app.module.ts:123–129`；`apps/api/src/semantic-runtime/semantic-runtime.module.ts:18–34` | SemanticRuntimeService 与 Outbox 仍在 apps/api 中有真实 provider/controller，不是仅兼容副本。Blueprint/Atomic/DataScope/EventBus 则沿兼容导出进入平台库。 |
| `apps/api/src/semantic-runtime/semantic-runtime.service.ts:239–265`；`apps/api/src/semantic-runtime/document-writer.ts:98–120,250–268,278–340` | 头行共享 manager，单号 UPSERT 与 savepoint 有真实实现；不重新制造这些整改任务。 |
| `libs/platform-release/src/blueprint/compiled-model.ts:32–37,164–175`；`apps/api/src/semantic-runtime/semantic-runtime.service.ts:2119–2141` | 正常路径优先读编译模板，不再是“所有请求只解析原文件”；编译模板仍只有 entities/validation/approval/accounting，未承载 flows；迁移也未消费 `transition.rule` 的执行条件。 |
| `apps/api/src/semantic-runtime/semantic-runtime.service.ts:865–866,875–933`；`libs/api-client/src/api/blueprints.api.ts:78–81,179–189` | 提供 expectedVersion 时已有条件 UPDATE，这是保留资产，不是新修复；剩余是版本可省略、规则在无锁读后判定，删除/审批未带聚合版本。不得将旧“缺强制前提”泛化为没有 CAS。 |
| `apps/api/src/semantic-runtime/document-writer.ts:123–159`；`apps/api/src/semantic-runtime/record-delete.ts:41–71,111–155` | 已有同租户引用检查、restrict、可空 setNull 再校验；未锁目标或规范化 FK，setNull 保存不推进源版本，仍有写删竞争。 |
| `apps/api/src/semantic-runtime/record-validator.ts:124–149,240–275`；`libs/platform-release/src/blueprint/expression-evaluator.ts:469–488,522–526` | decimal 接受 number；enum 仅判 string，p/s 未在入口普遍执行；非整数 number 与 decimal 混算明确拒绝而非误算。完整汽配仍用 number 数量，需对齐而非去掉拒绝。 |
| `libs/shared-core/src/lib/money.ts:44–55,148–187`；`apps/api/src/semantic-runtime/eval-context.ts:136–140`；`apps/api/src/semantic-runtime/semantic-runtime.service.ts:1487–1503` | 单金额库 bigint、assertFits 与 roundTo 已存在；最终派生字段未用 p 检查，分录写入 signed bigint 前无物理范围检查，不能用 38 位业务声明代替数据库范围。 |
| `libs/platform-release/src/atomic-runtime/atomic-executor.service.ts:282–317`；`libs/platform-release/src/atomic-runtime/atomic-runtime.module.ts:82–93` | 真实 DI 的宿主投影只判整数后写 Int32Array；缺 i32 范围及无损标度边界，并非只在旧 apps 文件中存在。 |
| `apps/api/src/outbox/outbox-dispatcher.service.ts:42–54,68–112`；`libs/platform-core/src/common/transaction/with-tenant-context.ts:23–35` | 按组织设置事务级租户上下文已接入，但一个组织的整个 drain 在事务中，未短领取；使用类名 subscriber，捕获 23505 后继续 SQL，外部 WS 不能回滚。PG jobs 的 SKIP LOCKED 不会自动修好此 dispatcher。 |
| `apps/api/src/notifications/notification.entity.ts:14–18`；`apps/api/src/websocket/services/notification.service.ts:83–125` | sourceEventId/userId 持久唯一键已经存在，不再要求新建基础通知去重；需改无异常冲突并在本地效果提交后发可重放推送。 |
| `apps/api/src/semantic-runtime/semantic-runtime.controller.ts:274–294`；`apps/api/src/semantic-runtime/semantic-runtime.service.ts:1174–1243`；`apps/api/src/review/review-decision.service.ts:39–61,167–177` | 仍挂载的旧语义审批路径把 body.role 用作当前步骤判定，没有传入可信权限/数据范围，且未锁定步骤。新 ReviewDecisionService 已有角色/assignee/selector 判定并注册，但未查到非测试 act/resubmit 消费者，旧路径也未调用它；只收口接线与事务，不重造其功能，不声称新服务已保护旧路由。 |
| `libs/ui-runtime/src/blueprint/BlueprintAppRuntime.tsx:249–255`；`apps/web-portal/src/app/dashboard/apps/[packageId]/[[...page]]/page.tsx:1–13`；`libs/agent-tools/src/agent-tool.registry.ts:74–88,289–315` | 真实蓝图 SchemaForm 已调用创建 REST；Registry 尚无记录/单据命令 port 和执行分派。因此只补共享业务接缝，不再把 UI 一概描述为包装器，也不重做工作台。 |

本次只有静态代码/规格/调用链复核和 OpenSpec 严格格式校验；未启动服务、迁移、连接数据库/模型、运行浏览器、Rust 宿主或业务测试，未复现并发故障或越权利用，不引用 main 的实测计数。

## What Changes

1. **ADDED** 确定性应用 `CommandService`（待新增）：人工 REST 与 Registry 业务工具适配同一封闭用例。首批覆盖现有 document.create、record.delete、record.transition、record.approve；record.update 仅在共享实现和契约批准后开放，不假装基线已有通用更新 API。保留实体/字段/单据权限、dataScope 和安装隔离。旧语义审批委托既有复核/身份解析能力，body.role 不授予权限。
2. **BREAKING** 删除、迁移、审批及后续更新强制 expectedVersion；复用已有迁移 CAS，加锁后重算前提，相关行修改推进头聚合版本。持久命令摘要/结果与业务写同提交，重试命中重新授权，同 key 改参拒绝。已有 PG jobs 负责长任务，不新建通用任务系统。
3. 收紧状态迁移：编译模板补冻结 flow 执行计划，实际执行支持的 transition.rule/check/require-approval；未支持动作/缺绑定明确拒绝。完整汽配的 flows 只有检查和审批，**不声明库存效果**，预占/出库必须新增经批准的候选绑定和事务处理器，不能根据状态名猜测，也不把 available-inventory 与 autoparts-atp 默默互换。
4. 保留现有引用检查和删除策略，补规范化引用边、组合 FK/锁及版本推进；库存由单一受保护的事务投影维护，预占与出库有条件更新和约束，无超卖/重复消费。递归 cascade 仍拒绝。
5. **BREAKING** decimal/money 写入统一十进制文本；数量按批准单位/标度与金额混算；入口、派生/汇总、分录执行 p/s、枚举、货币和物理范围，复用单金额库。宿主投影前校验 i32/列值域/无损标度，溢出拒绝不回绕。
6. 收紧已有 Outbox 的发布冲突与命名空间、短事务领取租约/fence、稳定 subscriberId、本地消费同事务去重及提交后推送。至少一次投递不等于端到端恰好一次；必需消费者缺失或结果不明不得被标记已完成。
7. 完整 auto-parts 的冻结隔离候选执行头行、小数数量/总额、审批、预占、出库/分录、事件的窄切片。auto-parts-min 只作冒烟；真实 HTTP、PG 双实例/重启、宿主边界和浏览器轨迹交 09 做同候选验收，不能要求先 published 才评测。

## Impact

受影响正式能力：`semantic-runtime`、`document-runtime`、`notification-outbox`、`wasm-atomic-runtime`；共 8 条核心 requirements。MODIFIED 仅用于现有状态迁移、删除引用完整性和两条 Outbox 条款，完整保留原条款与所有原场景，再追加拒绝边界；其它具体独立要求 ADDED，不重写整个正式规格。

实际 owner：`apps/api/src/semantic-runtime/` 与 `apps/api/src/outbox/`；`libs/platform-release/src/blueprint/`、`libs/platform-release/src/atomic-runtime/`；`libs/agent-tools/src/agent-tools.ports.ts` 与 Registry；`libs/shared-core/src/lib/money.ts`；`libs/platform-core/src/common/events/`、既有 jobs/data-scope/identity 通过接口复用；客户端兼容改动在 `libs/api-client/` 及其真实 web-console/portal 消费者。应用具体命令通过 port 注入 Registry，不形成平台库反向导入 apps/api。迁移和契约真源更新仅列为待批准实施任务。

### 既有提案与后续接口

- `optimize-blueprint-compile-runtime` 的编译产物/缓存与查询索引已有落点，本项只补缺失 flow 计划与交易判据，不重新建缓存。`add-generic-data-scope-authorization`、`add-identity-federation-and-session-governance`、`add-async-job-and-callback-facade` 的原语保留，不扩大为全平台复核。
- `add-review-and-approval-platform` 已覆盖带轮次复核、机器检查、人工决策与工作项；本项只收紧旧语义审批适配、聚合版本及同事务执行，不另造复核引擎。`add-record-lifecycle-and-tree-operations` 的克隆/归档/树/快照不在本项。
- `add-blueprint-ui-runtime-consumer` 和 `add-notification-center-and-announcements` 不重造；本项只迁移它们的命令 DTO 和本地事件消费接缝。
- 06 消费 `OutboxService.publish(manager,event)` 和幂等接口，并提供有效 `ReleaseContext`；本项**不定义激活事务/版本指针**。没有可信有效上下文的新增交易只能在平台隔离候选验证，不信任 URL packageId 开放生产。
- 07/08 消费共享命令、对象版本和事件，不在本项重做确认会话或 Schema 工作台；确认 token 生命周期归 01/07，最终参数摘要必须一致。
- 09 负责真实评测与最终放行；隔离候选在 candidateDigest 冻结后测试评测，随后审批、签名未公开工件、最终 GateDecision、published、activation。文档/静态校验不能关闭生产风险，未取得必需交易与模型评测证据不得放行自治。

### 不做什么

不 apply/archive，不修改业务代码、其它 changes、权威 docs 或台账；不迁移/部署。实施方案不换技术栈、不恢复旧 workflow、不把 command/effect 变成 Wasm 原子、不新建金额算法/Blueprint/Delta 协议，不重做 PG jobs、identity、dataScope、既有蓝图 UI/审批中心，不规定 A2 时间窗口、发布签名或激活状态机。

### 验收出口

真实证据必须绑定代码 SHA、candidateDigest、schema/规则/绑定/迁移/套件版本：人工与 Registry 同一命令，越权/伪角色/未确认/缺版本/旧版本/未支持 flow/同 key 改参均无副作用；PG 双实例及重启只提交一个逻辑交易，写删竞争无悬空引用，库存守恒，状态/库存/分录/audit/outbox/命令结果同回滚；数值正负边界和单一舍入满足批准预期；事件领取/消费者崩溃重放可恢复且不误记成功。记录实际 case/断言、失败/skip/unavailable 数及运行依赖版本；任一必需前置不可用或断言零即阻断。确定性无模型测试不得冒充真实模型评测，现有 suite 存在也不代表本次运行通过。
