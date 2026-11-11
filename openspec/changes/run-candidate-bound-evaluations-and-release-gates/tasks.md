# 冻结候选评测与完整门禁待执行任务

本次仅提案与静态格式校验。以下 18 项均在批准后执行，未有真实库/模型/browser 证据不能关闭生产风险；不重建已有 CI、UI、MCP 或 PG jobs。

## 1. 契约与政策

- [ ] 1.1 与 05 冻结 FrozenCandidateReader、首次/稳定基线、EvidenceSetDigest、ApprovalReceipt、SignedUnpublishedArtifactReceipt 和 GateDecision 的无循环契约及失效代次，明确审批/签名时间不改变候选摘要。
- [ ] 1.2 与 03/04/01/07/08 冻结候选执行器、真实会话/Registry/Command 事件及正式 UI 端口；与 06 冻结影子迁移/兼容账本读取与隔离安装，区分前段隔离开发与后置联合验收。
- [ ] 1.3 由业务/安全负责人批准七套件必测 case/fixture/oracle、质量与退化量纲/分母、首次准入及同口径基线重跑、seed 重复策略/实际 usage/价格/延迟预算政策；保留写安全零容忍与注入全通过，不盲继承历史数字。

## 2. 复用现有账本与job

- [ ] 2.1 增量扩展现有 agent_eval_cases/runs、app_release_test_evidence 与 gate receipts 的不可变 binding/逐例/attempt/来源/失效代次、索引及组织/RLS 约束，对拍 DOMAIN/schema manifest；候选不要求 published release 外键。
- [ ] 2.2 将旧 caseResults、自报 eval/URL/普通 test-evidence 上传标为历史说明且不可准入，收紧新 API 与查询作用域；认证受控执行器核验原始报告和绑定，不接受自报 ranBy/未来时间/成功摘要。
- [ ] 2.3 在既有 PG JobTypeRegistry/JobsService/JobQueue/worker 注册 candidate-evaluation handler，加入请求摘要幂等、命中鉴权、逐例追加/CAS、取消与租约重启安全恢复；未知 Command 副作用不得盲重试或被晚到成功覆盖。

## 3. 真实runner、测试证据与预览

- [ ] 3.1 构造真实隔离安装/库、非绕过 RLS 角色、脱敏夹具及效果/出网隔离 readiness，候选验证许可不等于生产许可，不开启全局 unsigned 豁免，不持生产写凭据。
- [ ] 3.2 实施冻结候选正式会话→生产同构模型/Context/selector→既有 MCP/direct→Registry→共享 Command 的 runner，记录 provider/model/adapter 实际版本及模型/工具/知识/技能/源码/套件摘要，检测执行中漂移。
- [ ] 3.3 实施七套件多轮可执行 oracle 与真实事件/参数/引用/确认/提交核验，复用 04 汽配窄切片和 08 船舶资料；覆盖编辑重确认、恶意文本、权限、版本、取消、断线/重启、预算与幂等。
- [ ] 3.4 实施完整必测分母、重复样本/失败保留、每套件质量与安全判分、同口径基线退化及实际 provider usage/延迟/成本；空/缺/重复/混绑定/零断言/全失败 FAQ/缺必需指标拒绝准入。
- [ ] 3.5 加固现有 ReleaseTestEvidencePort 与采集器，验证受控来源、真实报告、成功及 required/executedAssertions、前置 readiness、候选/源码/环境映射和有效代次；缓存失败/跨候选/未知来源不命中，禁用 G4 不能 passed。
- [ ] 3.6 实施真实 diff 必需闸门并集与审计化 notApplicable；接既有严格 checker/编译及 03 实际测试、真实 G2 权限/可达性和 06 G3 影子迁移/兼容断言，作者 risk/type 不决定省闸。
- [ ] 3.7 复用正式 Blueprint/UI/会话消费者接隔离 candidate namespace、可撤销用户/组织/app/摘要/受众授权与缓存键；按批准预览 policy 控制 TTL，实施 browser readiness/真实断言取证，URL/claims/changelog/mock 不能通过 G6。
- [ ] 3.8 实施 G0–G6 证据集冻结、G7/G8 回执核验及最终 GateDecision；与 05 的发布事务和 06 安装消费者对接重新鉴权、同候选/政策/撤销代次校验，09 不提供批准/publish/activate 权限。

## 4. 拒绝集、真实环境与独立验收

- [ ] 4.1 冻结并登记待新增 eval:candidate、test:eval-contracts、test:release-gates-real、test:preview-candidate 命令；增加自报/来源伪造、空缺混例、失败/未来缓存、禁测/零断言、伪不适用、摘要漂移、撤销和越域预览拒绝集，确认无发布副作用。
- [ ] 4.2 在真实隔离 PG（Redis 若启用）验证证据/RLS、job 并发幂等/取消终态/重启、证据写入故障及迁移 shadow/兼容；记录真实源码/runtime/DB/角色/fixture 与实际断言数，前置失败不能 early return 假绿。
- [ ] 4.3 用批准的实际生产同构模型/provider 和正式 browser 完成全部黄金集、同口径基线与候选 UI/确认/刷新/冲突/SSE 故障验收；保留失败和实际 usage/版本，联合 05/06 验证未发布候选→真实证据→审批→签名未公开工件→最终拒绝/放行，隔离替身不得解生产保护。
- [ ] 4.4 实施后协调既有 docs/protocols/release.md、piagent.md、agent-evolution.md 与 DOMAIN/DECISIONS/AGENT-TOOLS 的契约和证据状态更新；独立业务/安全/平台审核真实结果及停 runner/撤预览/阻断新发布回退演练，仅按授权逐候选放行；A1/A2 资格由 10 后置验收，文档/格式绿灯不等于生产关闭。
