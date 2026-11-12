# Tasks: 架构契约、最小 DI 与后置联合验收

全部为批准后待办；本次仅重新静态审查、编写提案并执行本 change 的 strict validate。没有实施、真库/模型/浏览器/宿主测试或部署。01–10 的细节由所属 change 执行，不重复搬目录/造 MCP/身份/jobs。

## 1. 契约与 ADR（无新增前置）

- [ ] 1.1 架构/安全负责人批准七条要求、真实 apps/libs owner 和分层 DI 矩阵；确认物理拆分、三库显式 build 与 error 级规则是已存在资产，删除旧重做任务。（批准包已起草：`docs/architecture/ai-native-control-plane-approval.md`；待 owner 签字）
- [ ] 1.2 与 01/06/07/10 冻结可信主体视图及每次调用 profile 来源，复用既有身份和 BusinessAppExecutionContext；明确 runtimeProfile 是部署模式、actor 文本不是稳定主体 ID，body.role 不成为可信职责。
- [ ] 1.3 与 04/07 冻结 Kernel/Host/IntentParser/Registry/共享应用用例边界；保留 Host 会话仓储，禁止业务仓储及模型影响业务提交，不新增金额或命令算法。
- [ ] 1.4 与 05/06/09 冻结 candidateDigest、真实证据、审批、签名未公开工件、最终 GateDecision 与有效 ReleaseContext 的生产者/消费者/主版本/拒绝契约；签认无先 published 才评测的依赖循环。
- [ ] 1.5 批准主体技术栈、PG 持久真源、Keyv/显式 memory、单生产引擎与模块化单体 ADR；记录锁定快照与部署未知项，原子/实例/外围源码范围不扩张。

## 2. 最小能力接线与兼容

- [ ] 2.1 盘点真实组合根/兼容重导出后 consumer，只迁必要接缝；为明确的旧人类 runtime 入口设计服务端可信适配，未知主体/版本先拒绝，不把所有 API 目录设为例外。
- [ ] 2.2 在已有 agent-tools.ports 扩展最小提议/候选端口，并在 AgentToolsModule 注入只含允许方法的门面；移除 Registry 对完整 ReleasesService 的对象能力，不只做 Pick 类型伪收窄。
- [ ] 2.3 将 Host、工具列表、MCP 上下文与 Registry 执行绑定同一可信主体/profile；保留 direct/MCP 的唯一 Registry 判定，外部 Host 不取得内部 REST/仓储旁路，具体生产模型循环与会话迁移交 07。
- [ ] 2.4 与 05/06/09 实现端口默认拒绝绑定及隔离候选夹具；未实现必需证据拒绝生产 publish/自治，允许前段隔离联调，当前安全安装继续确定性运行。
- [ ] 2.5 与 03 对齐引擎枚举、单引擎部署配置与能力 readiness 契约；未知配置不落 V8，显式生产 fallback 不自动换引擎；真实对拍/宿主工件/缓存修复由 03 实施，不重做默认 Wasmtime 翻转。

## 3. 可执行边界与正负验证

- [ ] 3.1 新增 `npm run check:ai-boundaries`（待新增），检查真实 Kernel/Host/provider 的目录 import、重导出 owner 和组合根禁止 DI；复用已有 Nx/check-boundaries，不复制 03 的 CI 管线。
- [ ] 3.2 新增 `npm run test:architecture-contracts`（待新增），验证人工/工具同用例、模型故障不改变 Kernel、会话持久化仍可用、Registry/MCP 统一判定与最小提议门面。
- [ ] 3.3 执行负例：body/profile/部署模式自授职责、跨 profile、注入完整发布对象/业务仓储、未知工具/契约/引擎、缺模型/候选证据、缓存证据混摘要、被跳过测试与错误先 published 顺序；逐例断言副作用前拒绝，不只测文案。

## 4. 联合证据、真源与回退出口

- [ ] 4.1 在另行授权的隔离环境消费 03/04/05/06/07/08/09 真实证据做架构接缝联合验收，关联源码 SHA、锁摘要、candidateDigest/有效版本、环境版本与实际 case 结果；现有 `npm run test:e2e --workspace @sap/api` 可选择新增套件，真实 provider/PG/浏览器/宿主缺失明确未验收，不把本项夹具或 validate 当自治评测通过。
- [ ] 4.2 批准实施后更新既有 `openspec/project.md`、`docs/META_LANGUAGE.md`、`docs/ARCHITECTURE.md`、`docs/TECH_STACK_v2.md`、`docs/TECH_STACK_GAP.md`、`DECISIONS.md` 与 piagent/release/agent-evolution 协议真源，澄清业务 Kernel 无模型依赖，区分已接线与待验收，不另建平行架构真源。
- [ ] 4.3 与 03/06/10 验证安全兼容回退和外围源码边界：分别核验进程回滚、元数据回退、数据补偿，不恢复 body.role/无审批 publish/包 URL/自动引擎兜底；负责人签认本项接口退出，09 未真实验收继续拒绝新生产发布，10 全依赖与 policy 未批准前 A2 关闭，不把本项归档视为下游生产放行。
