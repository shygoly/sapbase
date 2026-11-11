## ADDED Requirements

### Requirement: Verified Release to Installation Revision Binding

平台 SHALL 将经过可信授权及最终发布门禁的不可变 Release 描述绑定到本组织本应用安装的追加修订。描述 MUST 分别包含目录摘要、Blueprint包字节摘要及IR摘要，并引用同一冻结candidateDigest的审批/签名/必需证据。平台 MUST 复用既有Blueprint装载验签、授权及依赖绑定判据；版本号、URL包ID或调用方摘要 SHALL NOT 作为验证凭据。现有安装 `releaseDigest` 的IR摘要语义 MUST 保持兼容，不重新解释为目录或包摘要。

#### Scenario: Bind an authorized release

- **WHEN** 可信主体为安装选择已通过必需真实证据和最终GateDecision的Release，平台重载其授权包且目录/包/IR关联均一致
- **THEN** 新安装修订 SHALL 记录该Release及独立摘要、可信包引用与前一修订
- **AND** 历史修订、Release内容及既有签名/许可判据 MUST 保持不变

#### Scenario: Reject an invalid target before switching

- **WHEN** 目标跨应用、不可见、吊销、生产目标为preview、摘要不符，或缺有效批准/签名/Runtime/必需真实证据
- **THEN** 平台 MUST 在切换有效绑定前拒绝，缺执行能力 SHALL 标记unavailable而非passed
- **AND** 当前安装有效修订 MUST 保持不变，候选验证 SHALL NOT 要求先published或自行建立生产绑定

### Requirement: Atomic Effective Release Switch

平台 SHALL 由唯一协调器复用安装聚合的短事务、安装行锁及预期修订比较，原子提交实际默认或cohort绑定、追加安装修订、activation事实、状态投影、ReleaseEvent、Outbox及持久业务提交回执。最终提交 MUST 重新检查调用方expectedRevisionId、涉及路由的expectedRoutingRevision、任务租约代际、实际数据ledger与目标状态/证据，并在同一EntityManager上设置可信组织/安装/用户RLS上下文。原始activation事实 MUST NOT 被修改以表达回退；非法双默认active MUST 被拒绝。HTTP环境事务 SHALL NOT 替代worker/内部命令的明确提交契约。

#### Scenario: Commit a valid switch once

- **WHEN** 合法切换通过目标、兼容、权限及预期基线最终检查
- **THEN** 同一事务 SHALL 写入唯一有效绑定和对应追加修订/activation/事件/Outbox/回执
- **AND** 提交后消费者 SHALL 按稳定eventId处理缓存与通知，投递状态 SHALL 与版本生效状态分开

#### Scenario: Reject a stale revision or failed transaction

- **WHEN** 安装修订、路由修订、任务fencing或数据代际已变化，或者修订/activation/Outbox/回执任一写失败
- **THEN** 协调器 MUST 拒绝或整体回滚，不产生部分生效记录
- **AND** 旧有效绑定 MUST 保持不变，不得先撤销旧active再验证目标

#### Scenario: Delivery failure does not repeat activation

- **WHEN** 指针事务已提交但Redis失效、Next重验证或通知投递失败
- **THEN** 操作 SHALL 返回已提交业务结果及可重试投递状态
- **AND** 恢复 SHALL 只重投事件，不重复切换或伪造回退，外部已发副作用 MUST NOT 被宣称可随DB撤回

### Requirement: Durable Authorized Release Operations

Release版本操作 SHALL 使用既有PG jobs白名单类型、入队/领取/租约/attempt及事件设施，保存可信principal、安装、operation、调用方key、规范化requestDigest、进行中状态和不可变提交回执。操作 SHALL NOT 以Redis/Map完成后缓存作为幂等真源或新建平行队列。submit、resume及结果读取 MUST 在幂等命中前重新授权；内部key MUST 绑定组织、安装、主体和操作，同key异摘要 MUST 被拒绝。租约接管及提交 MUST 使用attempt/fencing CAS，已提交业务结果 MUST 不被通用worker超时/取消覆盖。

#### Scenario: Submit or retry the same authorized operation

- **WHEN** 同一可信主体重复提交同key及同requestDigest，并且权限和安装可见性仍有效
- **THEN** 接口 SHALL 返回同一个真实PG jobId及其持久状态/回执
- **AND** 新长操作 SHALL 返回真实202入队结果，不把caller key包装成succeeded jobId

#### Scenario: Reject changed request under the same key

- **WHEN** 同key的目标、摘要、安装、预期修订、cohort政策、配置、reason或迁移计划改变
- **THEN** 平台 MUST 返回幂等冲突，不重复执行或静默返回旧请求结果
- **AND** 不同主体 MUST 不共享可读取的操作结果

#### Scenario: Reject an idempotent retry after permission revocation

- **WHEN** job或完成回执已存在，但主体成员/功能权限或安装访问权被撤销
- **THEN** 重试、恢复或查询 MUST 被拒绝，不泄漏缓存结果
- **AND** 保存的createdBy或旧权限快照 MUST NOT 作为当前授权证明

#### Scenario: Resume safely across restart and cancellation races

- **WHEN** 提交前进程中断、租约接管，或提交成功后响应丢失/取消与完成竞争
- **THEN** 恢复 SHALL 读取PG状态、实际指针和提交回执，由当前attempt/fencing决定续跑
- **AND** 已提交结果 SHALL 返回原修订/activation/event，旧worker或取消请求 MUST NOT 覆盖成功或再次切换；提交前已取消的操作 MUST 不切换

### Requirement: Installation Bound Migration and Safe Rollback Evidence

平台 SHALL 保存安装范围的实际迁移ledger及方向性兼容证据，绑定源/目标目录/包/IR摘要、schema代际、ledgerHead/水位、脚本与执行器摘要、阶段/checkpoint、jobId及验证结果。升级/灰度共存/回退 MUST 验证当前实际数据到目标解释器的适用路径，保持现有声明默认值、读不改写、新写约束和单一金额/确定性命令判据。expand-migrate-contract SHALL 保留旧版本/cohort/pin/任务所需兼容；数据补偿 MUST 是独立批准且实际完成的持久操作。代码镜像回滚、定义回退和数据补偿 MUST 分离，rollbackSafe标签或接受损失签字 SHALL NOT 替代证据。

#### Scenario: Switch after current data compatibility is verified

- **WHEN** 当前安装数据代际和迁移ledger匹配源/目标证据，安全迁移或必要补偿已完成且目标重载摘要/授权/Runtime有效
- **THEN** 平台 SHALL 允许通过原子切换追加升级或回退修订/activation
- **AND** 证据 SHALL 引用实际执行结果，contract SHALL 在旧cohort/pin/任务不再依赖且批准验证满足后执行

#### Scenario: Reject an unsafe or unproven rollback

- **WHEN** 迁移部分完成、数据水位未知、证据过期/摘要不符、旧规则不能解释当前数据，或只有目标rollbackSafe布尔
- **THEN** 回退 MUST 被拒绝并保留当前有效绑定，必要时保留可审计写栅栏
- **AND** 平台 MUST NOT 用整库快照覆盖单租户，不得宣称已发通知或外部副作用可撤销

#### Scenario: Resume a migration from verified checkpoints

- **WHEN** 受控迁移批次后进程重启且ledger保存已完成checkpoint
- **THEN** 新attempt SHALL 重新核验实际数据、授权、脚本摘要及水位后从可证明的checkpoint继续
- **AND** 未能确认实际状态 MUST 标记unavailable且拒绝盲重放或盲补偿，不因候选shadow通过而假称真实迁移完成
