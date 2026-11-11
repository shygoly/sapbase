## ADDED Requirements

### Requirement: Candidate Revision Freezes Applied Delta and Complete Inputs

平台 SHALL 复用既有服务器 Patch/Delta 的已实现子集，将增量原子应用到可信组织/app 的 AppDraft 基线，以 expectedRevision/CAS 拒绝漂移。平台 MUST 在编译、实际 diff 校验与依赖固定后保存不可编辑冻结修订并重算 candidateDigest；载荷 MUST 覆盖基线摘要、全部 Blueprint 文件/manifest/IR/compiled 章、UI/权限、工具/技能/知识固定版本、解析依赖模块摘要/许可、版本通道、changelog、兼容迁移及补偿计划。任何内容修改 MUST 追加修订、重新冻结、撤旧候选发布资格并使旧证据/批准不能授权新内容，历史事实 MUST 保留；不得仅将已有 frozen 状态词当不可变保证。

#### Scenario: Existing server patch becomes a frozen candidate

- **GIVEN** 可信发起者有目标草稿提议权限，合法增量与 expectedRevision/基线一致
- **WHEN** 平台复用已有增量应用及蓝图编译并冻结
- **THEN** 平台 MUST 保存新修订、实际 diff 和服务器重算的 candidateDigest
- **AND** 读取 MUST 返回固定文件、compiledAt、UI/权限和解析依赖，不随 latest 漂移

#### Scenario: Invalid operation or concurrent revision fails atomically

- **WHEN** 操作不在已实现支持范围，或增量/冻结提交前草稿及基线已经变化
- **THEN** 平台 MUST 明确拒绝整批操作或返回修订冲突
- **AND** MUST NOT 部分应用、生成可批准候选或把完整替换 manifest 当合法增量

#### Scenario: Editing an approved candidate invalidates its authority

- **GIVEN** 冻结候选已有证据和批准
- **WHEN** 任意发起者改文件、diff、许可、依赖、版本或迁移/changelog
- **THEN** 平台 MUST 追加新修订/摘要并撤回旧发布资格，而非改写旧快照
- **AND** 审批携带 modifiedDiff MUST 被拒绝，旧批准/证据只保留历史用途

### Requirement: Approval Authority Binds Verified Principals to Candidate and Evidence

平台 SHALL 以认证身份、组织成员和权威权限服务解析真人发起者、审批人及能力，将 agent profile 与真人 initiator 分别记录；MUST NOT 使用 body.role/authorId/approverId、固定 agent 名、email/unknown 或 null 隐藏作者。审批 MUST 绑定组织/app、frozenRevisionId、candidateDigest、evidenceSetDigest 与 policyVersion，作者 MUST 不担任批准人。平台 MUST 根据真实 diff 推导风险/所需能力，高风险至少两位不同非作者合格真人，权限/工具/知识需安全能力、迁移/破坏性结构需技术能力、组合风险全部满足；单人多角色或 platform_admin MUST NOT 豁免。签名前及提交前 MUST 重新校验当前资格、策略和候选/证据一致性，审批/撤销事实追加不可改。

#### Scenario: Qualified distinct humans approve the same candidate

- **GIVEN** 平台判定权限变化所需 owner 与安全能力，两个非作者真人分别满足要求
- **WHEN** 两人批准同一冻结修订、candidateDigest、evidenceSetDigest 和策略版本
- **THEN** 平台 MUST 追加可信主体/能力快照及绑定凭证，并在当前资格仍有效时满足双人审批
- **AND** Builder 的真人发起者及受控 profile MUST 可追溯，不能只记录固定 agent 字符串
- **AND** 10 的有限 A2 仅可在真实 A1 验收后，对人批 policy 明确委托的非语义展示候选，由本审批服务实例化同候选/证据凭证；MUST 不替代本高风险双真人要求，接口或职责分离不满足时继续 A1，不因开关放行

#### Scenario: Self-reported or stale authority does not authorize publication

- **WHEN** 调用方自报 security、作者自批、单人多角色重复批准，或已批准后被撤权/改策略/改证据摘要
- **THEN** 平台 MUST 拒绝或判审批集合不足，不生成发布资格
- **AND** email/unknown/缺 initiator MUST NOT 凑足身份，旧批准 MUST 原样留存而不得改写成新凭证

### Requirement: Publication Admits Only Candidate-Bound Evidence Before Visibility

publish SHALL 只消费服务端冻结修订及 candidateDigest/evidenceSetDigest，拒绝独立内容/身份旁路。所有消费者 MUST 同样核验组织权限、真实必需证据、审批、签名/存储及最终 GateDecision 后才提交 published；runner/G8 MUST 不依赖先 published，回执/决策不得自指。缺必需真实执行或联合验收、测试来源/自报/旧时效证据 MUST 阻断生产新发布及自治，不适用由平台推导审计。发布意图 MUST 持久去重请求摘要/候选、命中仍授权，同键异摘要冲突；publish MUST 不改安装有效指针。

#### Scenario: Candidate is evaluated and signed before publication

- **GIVEN** 未 published 的隔离候选已由可信 runner 完成真实必需测试/评测，真人批准同证据集合，所需生产证据及独立放行已具备
- **WHEN** 授权发布者仅提交 proposalId/frozenRevisionId/candidateDigest/evidenceSetDigest 和 Idempotency-Key
- **THEN** 平台 MUST 按 G0–G6 → G7 → 未公开签名制品/G8 → 最终 GateDecision → 短事务复核 published 顺序保存唯一持久结果
- **AND** G8/最终决策/后置发布事件 MUST NOT 反向纳入自身签名载荷；并发/重启的同摘要请求 MUST 返回同结果，命中仍授权
- **AND** 版本/通道/manifest/changelog/迁移 MUST 取冻结内容，提交成功 MUST 不表示安装 activation

#### Scenario: Any bypass or missing gate leaves no visible release

- **WHEN** 无批准、批准 A 发布 B、跨 org/app/平台无权、自带 manifest/authorId/approverId、同键异摘要，或 required 证据 missing/unavailable/skipped/零实际执行、自报 passed/URL/旧 freshness 缓存/fixture/未签名豁免
- **THEN** 平台 MUST 明确拒绝契约/权限/冲突或返回缺闸 UNAVAILABLE，不写 published 或可消费制品，不改变安装
- **AND** 人工/release-automation/emergency/旧开关 MUST NOT 放松门禁，缺 09 真实必需证据/联合验收时 A1/A2 自治不得放行
- **AND** 失败不能返回 succeeded；存储已完成而目录事务失败只能留不可见完整孤儿

### Requirement: Release Envelope Cryptographically Binds the Entire Approved Payload

平台 SHALL 复用共享 canonicalizeJson/Node Ed25519 签完整 Release envelope，覆盖算法/keyId/版本、可信归属与基线、完整候选/包/items、依赖许可/兼容迁移/changelog、证据批准策略及发布意图/主体时间/事故理由。仅排除自身 digest/signature 与显式可变状态；MUST 区分三个摘要并核验最终包与候选等价。密钥/根/版本不可信或非 Ed25519 MUST fail-closed，标签不算签名；私钥 MUST 仅平台 signer 使用，不返回 Agent/客户端。

#### Scenario: Both envelope and Blueprint integrity are verified

- **GIVEN** 同摘要候选、证据和批准一致，平台有受信 Ed25519 密钥
- **WHEN** staging 中只为固定 compiled 包增加 manifest.signature 并签完整目录 envelope
- **THEN** 平台 MUST 验证目录签名、原 Blueprint 签名、实际 artifactDigest 和候选文件/unsigned manifest/IR/compiled 章等价
- **AND** 被签载荷 MUST 包含 G0–G6 evidenceSet、G7 批准/policy 快照及固定发布 ID/真实主体/时间，G8 回执只引用 candidateDigest/artifactDigest/releaseDigest 而不改变被签候选
- **AND** 目录消费方 MUST 获得已校验只读引用

#### Scenario: Tampering or a signature label fails closed

- **WHEN** 任一 algorithm/keyId/payloadVersion、归属/通道/依赖模块 SHA/许可/兼容迁移/补偿/changelog/items/证据批准引用被改，最终包偏离冻结内容，或使用 ed25519:digest/坏根/非 Ed25519 密钥/未知版本
- **THEN** 平台 MUST 拒绝签名、发布或制品解析，不生成可执行结果
- **AND** 内容漂移 MUST 要求新候选/证据/批准，MUST NOT 以 artifactDigest 与 candidateDigest 正常不同为由豁免相等核验

### Requirement: Sealed Release Ownership and Content Stay Immutable After Retirement

AppRelease SHALL 以不可清空的曾发布封存事实永久保护内容与归属，而非只判断当前 published；平台 MUST 在服务及数据库中保护全部内容/身份/签名/来源字段和封存子项/候选证据批准快照，未来内容列默认受保护。published/superseded/revoked 和后续状态 MUST 保持原内容，非法退回 building/failed MUST 拒绝；合法状态变化只改显式状态审计字段/追加事件。既有 Release DELETE 拒绝与平台/租户 appKey/version 唯一约束 MUST 保持，退役不释放版本。旧标签签名 MUST 原样留存为 legacy-unverified 而非补造历史已批准；紧急/服务回退 MUST NOT 撤保护、改归属或重开旧发布旁路。

#### Scenario: Retiring preserves verifiable history

- **GIVEN** 完整签名目录与包已 published 且封存
- **WHEN** 授权命令使状态成为 superseded 或 revoked
- **THEN** 所有内容/归属/三个摘要/发布主体时间与子项 MUST 保持可查可验证
- **AND** 状态理由/真实主体 MUST 追加审计，同版本仍唯一，旧安装稳定运行不被此操作强制重装

#### Scenario: Service and SQL mutations of sealed content are rejected

- **WHEN** 应用角色修改任一曾发布状态的归属、channel、signature、compatibility、未来内容列/子项，删除 Release/快照，或改回 building/failed
- **THEN** 服务与数据库 MUST 拒绝，原内容/历史/归属保持不变
- **AND** legacy/emergency/回退 MUST NOT 解除保护或把未验证历史行补签成生产批准
