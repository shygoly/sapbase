# 实施任务（全部待完成）

本次只重新审查 weichen 并修订提案；静态证据/OpenSpec 校验不表示业务、真实环境或生产通过。批准提案后才实施；不沿用 main 的复现和测试数量。

## 1. 契约与复用边界

- [ ] 1.1 与 01/03/06/09 整合既有 add-release-lifecycle-and-activation 基础规格及本 change 独立加严项；冻结 owner/边界，确认候选先评测、G8 回执先于 published、09 后置联合验收不阻断隔离开发。
- [ ] 1.2 在既有 shared-core/release-kernel/shared-schemas 边界冻结 FrozenCandidate、ReleasePayload/envelope、三个摘要及规范化拒绝向量；覆盖 UI/权限、全部文件、compiled 章、固定依赖/许可/工具知识版本、兼容迁移/changelog，复用原 Blueprint 签名语义。
- [ ] 1.3 定义可信身份/审批 policy 与 FrozenCandidateReader、CandidateEvidenceProvider、ApprovalReceiptReader、SignedUnpublishedArtifactReceiptReader、PublishedArtifactResolver ports；平台 NULL 独立授权，证据不足/测试来源 fail-closed，09 未验收生产新发布拒绝。

## 2. 修订、审批与唯一发布输入

- [ ] 2.1 复用已有 applyDefinitionPatch/产包编译，实现 AppDraft 增量适配、批量原子应用、expectedRevision/CAS、冻结编译及依赖固定；未知操作拒绝，修改 frozen 内容追加修订并撤旧资格，不重造 Delta 或 UI 层。
- [ ] 2.2 接线平台 identity/成员/当前权限，实现可信真人作者与 agent 来源、高风险不同非作者真人及组合能力审批；拒绝 body.role/modifiedDiff，自批/单人多角色不能满足，追加撤销并在签名/提交前重新核资格及策略。
- [ ] 2.3 改造实际 builder publish 及 release-automation 消费者，仅接同 proposal/frozenRevision/candidate/evidence digest；旧 manifest/authorId/approverId 明确拒绝，emergency 不豁免，缺 required gate 无 published/可消费包/安装变化。
- [ ] 2.4 复用 PG jobs/幂等基础增加 publish intent 请求摘要、进行中/结果、候选唯一约束与授权重查；实现并发/重启恢复，签名/存储成功不提前报告发布成功，短事务提交 Release/items/events/proposal 关联而不切安装。

## 3. 签名、存储和历史兼容

- [ ] 3.1 复用 Node Ed25519/canonicalizeJson 实现完整目录 envelope 签名及验证；固定 compiledAt/文件，最终 Blueprint 只增签名，任何候选内容漂移重走证据批准；拒绝标签/坏密钥/非 Ed25519/未知 keyId/版本，私钥仅平台 signer。
- [ ] 3.2 实现同候选 G0–G6 → G7 → 未公开签名制品 G8 receipt → 09 final GateDecision → 短事务复核 published 的分阶段 admission；不等待 published 评测/G8，不把 G8/决策/后置发布事件反向嵌入自身载荷；测试 fixture 与旧 freshness evidence 不授权生产。
- [ ] 3.3 新增 ImmutableArtifactStore 条件创建/getVerified 与固定版本别名；staging 完整写/fsync/排他提交，禁止普通覆盖 rename、caller out/symlink、同版本异摘要或损坏目标覆盖，故障只留不可见完整孤儿。
- [ ] 3.4 对所有 Blueprint 写消费者接封存及平台签名授权：package/compile(stamp)/deliver/deliverPackage、AI materialize/deliver、module-registry export；改为受控 staging/新引用，保留 load 成功才写 loadedAt，禁止旧 JWT-only 交付入口签发生产旁路，Registry 不新增批准/签名/发布工具。
- [ ] 3.5 编写加法迁移，新增冻结/审批/证据/publish intent 关联和永久封存保护；扩展已有 guard 至所有曾发布状态及完整内容/归属/子项/快照，保留已有 Release DELETE 拒绝、平台/租户版本唯一、RLS 和最小应用角色。
- [ ] 3.6 编写只读历史盘点与复制迁移/回退方案：校验旧 .erpkg 后按 digest 固定别名，标签目录 legacy-unverified 原样保留，矛盾隔离，不覆盖补签/释放版本/改归属/切安装；回退仅关闭新写而保留保护。

## 4. 消费者与真实验收

- [ ] 4.1 更新已有 api-client 和 web-console 审批页，显示冻结摘要/真实审批能力/证据来源及缺闸原因，移除自报角色/改并批，新增制品只读解析接口供 06，结果明确 publish 未 activation。
- [ ] 4.2 登记待新增专属 Jest 套件及适配 lib 的 config/mapper，覆盖规范化向量、摘要/签名各字段篡改、旧 Blueprint 原场景、候选漂移和分阶段循环拒绝；核对 @sap/api test/test:e2e 命令，不假定现套件覆盖，不使用 main dist。
- [ ] 4.3 新增真实身份 HTTP 与真实隔离 PG 应用角色测试，覆盖无批准/错候选/跨组织平台/自报角色/作者自批/重复高风险批准/撤权后发布/改 diff，以及 published/superseded/revoked 全行与子项保护；初始化/RLS/零断言失败须失败，记录版本与实际 case/断言。
- [ ] 4.4 新增真实文件多进程与 publish 故障测试及浏览器审批验收命令：竞争同 digest/异 digest、损坏目标、签名/fsync/目录提交中断、重启结果及旧写接口拒绝；断言完整唯一包/固定别名、无公开半包/无假成功，并记录环境和实际断言。
- [ ] 4.5 与 01/03/09/06 完成同候选真实证据联调及独立放行评审：09 缺实测/自报/URL/fixture/旧时效 evidence/未签名豁免均拒绝；在无 published 候选上完成真实 runner 后验证签名回执/最终决策/目录一致，06 单独验收安装，A1/A2 自治仍不得由局部结果开启；实施后才更新既有协议/DOMAIN/DECISIONS/Schema/OpenAPI/命令，未执行记 BLOCKED，不按文档生成关闭生产。
