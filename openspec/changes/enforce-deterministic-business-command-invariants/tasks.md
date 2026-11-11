# 实施任务（仅提案，全部未完成）

基线 weichen `ce1e538dcec6539f66bba80d5413a3b6741486c9`。批准后才实施；本次静态 validate 不代表下列任何业务验收已完成。已有头行事务、编号、金额算法、dataScope/identity/jobs/蓝图 UI/复核平台不重建。

## 1. 冻结契约与兼容计划

- [ ] 1.1 冻结首批命令目录/context/envelope/error/result、canonical digest、强制聚合版本和权限/范围/有效定义消费；明确 01/06/07 port 及隔离候选模式，不信任 args 或 URL authority。
- [ ] 1.2 冻结 semantic/transition.rule/flow 支持矩阵、源/目标动作时机、处理器/许可/模块绑定及完整汽配候选 Delta；新增预占/出库绑定须批准，不把旧 check 当库存 effect。
- [ ] 1.3 业务/财务批准 decimal 文本、缺省 p18/s4、数量单位/标度、枚举、行级/汇总舍入、币种、journal bigint 与 ABI i32 交集；清点不合规历史与安装/引用/类名映射，给出隔离和逐行对账计划。

## 2. 共享命令与数据不变量

- [ ] 2.1 在实际 SemanticRuntime owner 实现 CommandService，用 port 从组合根接 Registry；现有 REST 创建/删除/迁移/审批均薄适配同用例，后续 update 未实现前不注册；兼容消费者迁移 DTO 而不重写页面。
- [ ] 2.2 收口仍挂载的旧语义审批路由，复用现有 review/identity 的可信步骤资格与数据范围；body.role 不授权，补聚合版本/步骤锁与内容摘要失效，保留已有轮次/机器检测/工作项能力。
- [ ] 2.3 实现命令执行账本的摘要唯一预留、fence/接管、业务结果同事务提交、同 key 改参拒绝及命中重新授权；长任务只桥接既有 PG jobs，不另造队列。
- [ ] 2.4 迁移/审批/删除及后续更新强制 expectedVersion，复用已有迁移 CAS 并锁后重算原状态/规则/范围；头行与 setNull 推进所属聚合版本，禁止自动补当前版本重试。
- [ ] 2.5 扩展现有 CompiledTemplate 构造封闭执行计划并确保 fallback 等价，真实执行 transition.rule/check/require-approval 与已支持求值；缺动作/模块/绑定或非法算子全部拒绝，无另起 workflow。
- [ ] 2.6 新增批准的库存权威事务投影/预占绑定，以锁、条件 UPDATE、CHECK/UNIQUE 维护守恒和一次消费；StockItem 对应数据不得成为第二写真源，状态/库存/分录/审计/outbox/结果同 manager 回滚。
- [ ] 2.7 新增组织/安装组合记录键和规范化引用边 FK，同事务维护/锁定；保留 restrict/setNull 再校验，补源聚合版本/权限/范围，大扇出/cascade 明确拒绝；隔离真库回填/对账后验证约束。
- [ ] 2.8 收紧 validator/派生/rollup/accounting 到单金额库，decimal 文本、枚举/p/s、数量标度/单位、币种与物理范围全校验；最终字段单一舍入并引用同一量化金额，历史 float 不强转假精确。
- [ ] 2.9 在真实 platform-release AtomicExecutor 投影前校验安全整数/i32/列域/无损标度，拒绝未知标度/inexact/溢出，保留 ABI、准入及 fail-closed；实际输出/错误码不返回部分结果。

## 3. 可靠事件收口

- [ ] 3.1 保留 Outbox publish(manager,event) 接口，校验真实事务并实施组织/安装/逻辑键+事实摘要的无异常冲突；import 独立行事务保留，批完成记录/事件同完成事务且可恢复。
- [ ] 3.2 改 dispatcher 为组织内短 SKIP LOCKED 租约领取/独立消费/按 fence 完成，扩展唯一 EventBus 注册面为稳定 subscriberId，迁移批准历史映射，必需消费者缺失不得标 delivered。
- [ ] 3.3 将已有 deliveries 扩为 processed inbox 或等价本地幂等账本，与通知效果同事务 ON CONFLICT；保留 sourceEventId/userId 唯一键，提交后可重放 WS；外部采用供应商幂等/发送账本/结果不明对账，不宣称网络恰好一次。

## 4. 拒绝集、真库与联合验收

- [ ] 4.1 扩充现有单元拒绝集并执行实际 `npm run test --workspace @sap/api -- --runInBand`；新增并实现 **待新增** test:transaction-invariants / test:abi-numeric-boundaries，真实 PG 非 owner/无 BYPASSRLS、双实例/重启/崩溃点验证版本/引用/库存/事件/数值及宿主边界，初始化失败、断言零、缺 case 不得 PASS。
- [ ] 4.2 实现 **待新增** test:transaction-browser-evidence，复用现有 portal 蓝图 UI/console 与 03 浏览器底座，完整 auto-parts 冻结候选走头行→小数金额→审批→预占→出库/分录→事件，并对拍人工/Registry 同命令；min 仅冒烟，缺真实 UI/工具则 blocked。
- [ ] 4.3 汇总同 SHA/candidateDigest/迁移/规则/绑定/套件版本及逐例实际断言/观察值/事件、失败/skip/unavailable 和运行依赖，交 06/07/08/09 接入联合验收；按实际更新 DOMAIN/FLOWS/AGENT-TOOLS、既有协议与接口文档（包括已实现 dataScope 的过时未执行声明），批准回退/对账方案；真实必需证据与 09 模型评测缺失不得放行生产新交易或自治，不要求先 published 才评测。
