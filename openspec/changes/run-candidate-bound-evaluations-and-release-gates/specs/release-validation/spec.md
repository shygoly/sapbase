## ADDED Requirements

### Requirement: Platform-Derived Required Gate Evidence

平台 SHALL 从真实 baseline→candidate diff 和版本化政策推导 G0–G8 必需 gates/suites/tests 及 impactDigest，多类变更 MUST 取并集，未知影响 MUST 阻断。G0 MUST 使用候选输入的严格契约检查，G1 MUST 真实编译，G2 MUST 计算实际权限/工具/资源可达性差异，G3 MUST 执行真实隔离 shadow 迁移和兼容/回退或补偿断言。所有必需回执 MUST 绑定同 candidateDigest、输入/基线/政策/执行器/产物摘要、实际断言、状态、原因与审计；notApplicable MUST 由平台证明，不接受提交方布尔省闸。

#### Scenario: Multi-area diff requires union and actual execution
- **WHEN** 候选真实 diff 涉及页面、权限、数据/迁移和 Agent 依赖
- **THEN** 平台 MUST 取发布矩阵必需集合并执行对应真实 checker/编译/权限差异/影子迁移/测试/评测/预览
- **AND** G7/G8 MUST 后续消费同候选平台审批及签名回执，不能由作者声明代替

#### Scenario: Missing evidence or false not-applicable blocks
- **WHEN** 作者错标类别、自报无权限/迁移变化，或必需回执为 failed/missing/unavailable/skipped/pending/running
- **THEN** 最终准入 MUST 拒绝并保留审计原因
- **AND** notApplicable MUST NOT 由 risk/type/areas 自述或缺 URL/blueprintId 自动产生

### Requirement: Authenticated Candidate Test Evidence Reuse

系统 SHALL 复用既有 test-evidence 存储与受控执行器的实际 Jest/集成/E2E 报告，MUST 核验来源身份、原始报告摘要、成功/失败/跳过/不可用、必需与实际断言、readiness、源码/runtime/fixture/政策及 candidate 映射。缓存时效 MUST 仅为附加政策，完整 binding 匹配或平台证明的候选覆盖才允许复用；普通验证权限、任意摘要/summary/ranBy/ranAt MUST NOT 成为可信背书。

#### Scenario: Verified matching successful report is reused
- **WHEN** 认证受控执行器报告满足真实测试计划、实际断言/readiness 且输入/版本/候选映射和失效代次匹配
- **THEN** G4 SHALL 复用该回执并记录匹配依据与实际覆盖
- **AND** MUST 保留报告与执行器出处，而非仅记录时间新鲜或退出 0

#### Scenario: Failed fresh forged or disabled evidence cannot pass
- **WHEN** 缓存虽新鲜但失败/零断言/未知来源/源码漂移/跨候选/未来时间，或 RELEASE_G4_RUN_TESTS=false
- **THEN** G4 MUST 拒绝通过或记 skipped/unavailable 并阻断最终准入
- **AND** 上传者的成功摘要、已有 Jest 安装或测试计划字段 MUST NOT 替代实际执行

### Requirement: Isolated Unpublished Candidate Preview Evidence

系统 SHALL 对获授权的当前用户签发可撤销、受批准 policy 限时的候选访问授权，MUST 绑定组织/app、candidateDigest/修订、隔离安装/namespace、profile/audience/nonce/失效代次。候选 MUST 在真实隔离数据/效果出口以正式 Schema/UI/会话消费者加载，禁止生产写/指针切换及缓存混域。G6 MUST 依赖同候选 readiness 与实际 browser 关键路径断言/网络/状态/产物摘要，而不是 URL、token claims、截图附件或 changelog 对比。

#### Scenario: Authorized candidate uses actual business consumers
- **WHEN** 当前用户访问受限未公开候选且真实隔离后端、UI、模型与 browser readiness 满足
- **THEN** 系统 MUST 显示候选/隔离标记并加载本候选字段/权限/真实数据和正式会话
- **AND** G6 MUST 核验正常查询、编辑重确认/命令/刷新、旧版本冲突及取消/恢复等必需 browser 断言，不要求先 published

#### Scenario: Cross-boundary unavailable or decorative preview is rejected
- **WHEN** 授权过期/撤销/用户组织受众不符、候选漂移、生产目标或缓存混域、缺 browser/readiness 或出现 demo fallback/仅 URL 或 changelog
- **THEN** 系统 MUST 拒绝访问或 G6 准入并审计原因
- **AND** MUST NOT 产生生产数据写入、activation 或 passed 回执

### Requirement: Staged Final Candidate Gate Decision

系统 SHALL 依次完成冻结候选、G0–G6 真实证据、冻结证据集、G7 可信批准、G8 签名未公开工件、最终 GateDecision、published 与 activation。候选摘要 MUST 不因后生成的审批/签名/时间而改变；G8 MUST 核验完整工件内容→候选映射且不等待 published 事件。前段验证 MUST 与最终生产准入区分；09 MUST 仅提供判决，05 发布事务 MUST 重新鉴权并核验候选/证据/政策/批准/签名/撤销代次，06 保持激活 owner。

#### Scenario: Complete staged receipts authorize publication
- **WHEN** 同候选必需 G0–G6 已满足，证据集冻结，05 提供有效 G7/G8 回执且最终消费核验成功
- **THEN** 系统 SHALL 产生绑定候选、证据集、批准/签名与政策代次的 GateDecision，05 才允许提交 published
- **AND** G0–G6 不以 published 或 G7/G8 已通过为开始条件，09 不获得发布/激活权限

#### Scenario: Incomplete stale or substituted receipts block production
- **WHEN** 必需真实测试/模型/preview 证据缺失，批准 A 对工件 B、回执撤销/漂移/政策失效或只取得 preApproval/文档绿灯
- **THEN** 系统 MUST 拒绝生产新发布，不写 published 或生产有效指针
- **AND** A1/A2 生产治理 MUST 继续关闭，已安装有效未吊销版本 MAY 继续确定性运行；失败回退 MUST NOT 恢复自报/warn-only/禁测通过旁路
