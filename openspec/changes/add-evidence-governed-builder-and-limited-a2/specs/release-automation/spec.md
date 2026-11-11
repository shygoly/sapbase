## ADDED Requirements

### Requirement: Server-Derived A2 Classification and Application Intersection

A2 SHALL 从服务端应用 Delta 后的完整基线→冻结候选 diff 产生绑定 candidateDigest 的分类证据，使用版本化封闭路径目录及引用影响检查。有效类别 MUST 非空且全部属于平台目录与应用批准 policy 白名单交集；类别建议 MUST 不是权威输入。首类 MUST 仅允许可证明无业务语义影响的普通展示帮助/字段提示；空 diff、错标、未知、合同/法定/交易语义文案、模型提示词以及夹带 permissions/schema/flow/rules/tool/skill/knowledge/migration MUST 拒绝 A2并转适用人工流程，A3 MUST 禁止。

#### Scenario: Verified display-only change satisfies both whitelists
- **GIVEN** 完整 diff 只改目录允许的非语义展示文案，引用检查无行为影响，应用 policy 允许该子类
- **WHEN** 平台分类
- **THEN** 平台 MUST 产生同候选摘要的 classificationDigest 并继续其它准入检查
- **AND** 少量行数、调用方 copy 标签或平台常量 MUST 不替代应用交集与实际 diff

#### Scenario: Empty mislabelled or semantic changes cannot enter A2
- **GIVEN** 空/未知 diff、错误标签、应用排除类别，或文案夹带结构/模型/知识规则/迁移或业务语义变化
- **WHEN** 申请 A2
- **THEN** 平台 MUST 拒绝并记录具体路径/交集原因，发布和激活副作用为零
- **AND** 平台不得将无法证明的变化按低风险处理

### Requirement: Evidence-Gated Policy Delegation and Platform Publication

A2 SHALL 默认为 disabled，配置开关与可执行资格 MUST 分离。启用 MUST 有实际 A1 完整链、适用前置真实门禁、指标源/cohort/兼容恢复证据及独立真人批准的不可变 policy 修订。平台审批服务 MUST 针对同 candidateDigest/classificationDigest/作用域/有效期实例化可信预授权凭证并满足既有职责分离；接口不支持或必需证据缺失 MUST 转 A1且不允许生产自治。发布者 MUST 为可追责 service principal，actorAgent MUST 为空，原提议人/Agent MUST 保留；A2 MUST 只提交冻结候选引用，不接独立 manifest、自报 passed 或 clean。顺序 MUST 为冻结摘要→真实测试评测→审批→签名未公开制品→最终 GateDecision→published→activation。

#### Scenario: A qualified policy delegates one frozen candidate
- **GIVEN** 真实 A1 验收与前置证据齐全，已批准 policy 的有效资格要求满足，同候选预授权可验证且未撤销
- **WHEN** 平台策略服务申请发布和首档灰度
- **THEN** 可信审批/门禁服务 MUST 核验该候选证据，签名发布与实际激活 MUST 复用前置接口
- **AND** 审计 MUST 记录真实平台身份、空 actorAgent、原提议者和 policy/分类/候选摘要

#### Scenario: Configuration or caller attestations cannot authorize publication
- **GIVEN** 页面写 enabled=true，但缺真实评测/A1证据/可信预授权，或提交独立 manifest、混候选报告、过期 policy
- **WHEN** 请求生产自治发布或激活
- **THEN** 平台 MUST 拒绝并显示 blocked/unavailable，不能以事后复核替代发布前授权
- **AND** 评测 MUST 可针对未公开冻结候选运行，不形成先 published 才能评测的循环

### Requirement: Observed A2 Windows Revocation and Complete Policy Audit

A2 SHALL 只依据受控真实指标源的 releaseDigest、安装修订、稳定 cohort 路由版本、来源版本、起止水位、分子/分母和样本决定动作。窗口、最小有效样本、freshness、方向/阈值、档位、逐次复核期限与资格恢复次数 MUST 来自人批准的版本化 policy；未批准/缺失 MUST 阻断。missing/过期/零分母/非有限值/混版本/混 cohort/未完成窗口 MUST 为 unavailable，暂停新自动动作，不写 success/clean。晋级 MUST 满足窗口并限于 policy 自动上限，全量 MUST 独立人批；回退 MUST 有真实违规及当前→目标兼容证据，复用安装恢复。每次副作用提交 MUST 核验持久撤销 epoch 与逐次复核期限；关闭 MUST 停止未提交动作。季度审计 MUST 覆盖组织内全部 policy 修订与真实分类/授权/run/发布/激活，缺证据不能伪报零违规。

#### Scenario: Complete approved window supports a bounded action
- **GIVEN** 同版本稳定 cohort 的真实窗口满足批准 policy 的时长/样本/方向/阈值，policy 未撤销且逐次复核有效
- **WHEN** 平台评估晋级或兼容回退并进行季度审计
- **THEN** 平台 MUST 记录可重算窗口判定，晋级不超过批准自动上限且全量待人批，回退只在真实违规和当前→目标兼容时提交
- **AND** 审计 MUST 遍历全部 policy/run，资格建立/恢复只计有证据的人批等价运行，不要求先有自动运行造成首次启用循环

#### Scenario: Missing observations or unsafe recovery block automation
- **GIVEN** 无指标、样本/窗口不足、混版本/cohort、过期/零分母，或目标缺兼容证据
- **WHEN** 护栏、晋级、复核或回退检查执行
- **THEN** 平台 MUST 记录 unavailable/blocked、停止后续自动动作并转人；不兼容回退 MUST 保留当前 active
- **AND** 客户端 clean/指标、无违规返回空数组或时钟模拟 MUST 不替代真实观察与恢复证据

#### Scenario: Disable races and audit gaps do not produce silent success
- **GIVEN** 管理员撤销 policy 或某次发布复核逾期，或审计涉及多个 policy且存在缺证据/结构性自动发布
- **WHEN** 在途 worker 提交/恢复或生成审计报告
- **THEN** 平台 MUST 用持久 epoch/fencing 拒绝未提交副作用、保留已提交事实转受控人工处理，并报告缺口/违规后停止相关 A2
- **AND** 不得只查首条 policy、刷新 policy.lastReviewedAt、自报 structural=false 或 clean=true 来恢复资格或输出合规 PASS
