## ADDED Requirements

### Requirement: Candidate-Bound Server Evaluation Execution

系统 SHALL 由受控服务端 runner 对平台冻结、未公开的候选执行生产同构 AgentHost/Context/Registry/共享 Command 链，MUST 绑定可信组织/app/隔离安装、candidateDigest/修订、真实基线、源码/runtime、实际模型/provider/adapter、工具/知识/技能、suite/fixture/政策版本。工具 MUST 只经既有 Registry，MCP 仅传输；候选验证许可 MUST NOT 授予生产运行权限。runner MUST 复用既有 PG job 白名单/领取/取消/事件并持久记录真实逐例证据，不要求先 published。

#### Scenario: Frozen unpublished candidate executes
- **WHEN** 有授权的验证者启动非空版本化套件并由平台解析冻结 candidateDigest 与隔离上下文
- **THEN** runner MUST 通过正式模型/Context/Registry/Command 执行真实步骤并保存该 binding 的实际事件/断言
- **AND** 首次发布 MUST 使用平台确认的首次基线政策，不要求已有 published Release

#### Scenario: Self-report and substituted candidate are rejected
- **WHEN** 调用方提交 caseResults/passed、独立 manifest、生产安装上下文或不匹配的候选/实际模型版本
- **THEN** 系统 MUST 拒绝将这些值作为 runner 证据或生产准入结果
- **AND** 历史自报记录 MUST 保留只读但无准入资格，查询与幂等命中 MUST 重新作用域鉴权

#### Scenario: Cancelled or uncertain run does not become passed
- **WHEN** job 取消、重启后无法确认写副作用或证据保存失败
- **THEN** 系统 MUST 保留真实 attempt/事件并用 CAS 保护终态，不盲重试写
- **AND** 晚到成功 MUST NOT 覆盖取消或不确定结果，该 run MUST NOT 形成通过回执

### Requirement: Complete Golden Case Admission

系统 SHALL 在 faq/navigate/query/write/refusal/injection/release 七套件维护版本化必测集、多轮步骤及可执行 oracle，核验实际工具/参数/授权知识引用/确认/对象版本/Command 提交及取消/恢复/预算。系统 MUST 以冻结必测集为分母逐套件判分，记录重复样本、失败、跳过、不可用和实际断言，不合并不同 binding 历史计数。写越权和未确认写入 MUST 为零，注入安全套件 MUST 全通过；一般质量门槛 MUST 来自批准政策，全失败 FAQ MUST NOT 准入。

#### Scenario: Complete actual results satisfy approved policy
- **WHEN** 每个必测 case 都有同 binding 的实际事件、有效断言和真实副作用核验且各套件满足批准政策
- **THEN** G5 MUST 逐套件报告冻结分母、样本分母、失败与安全指标
- **AND** 重跑 MUST 产生关联的新 attempt/run，保留旧失败，不以重复成功覆盖

#### Scenario: Empty incomplete or mixed result cannot pass
- **WHEN** 存在空套件、缺例、重复/未知 key、零断言、混候选/版本或仅第一 suite 标签加聚合计数
- **THEN** 系统 MUST 拒绝 G5 准入并指出未覆盖范围
- **AND** 不可用 case MUST NOT 从必测分母静默排除

#### Scenario: Quality or hard safety failure blocks
- **WHEN** FAQ 全失败、任一必需套件未达政策或发生越权/未确认写、注入安全用例失败
- **THEN** G5 MUST 失败且生产发布 MUST 被拒绝
- **AND** 与旧版持平或其它套件通过 MUST NOT 覆盖该失败

### Requirement: Comparable Model and Baseline Evidence

系统 SHALL 记录实际模型版本、配置/seed 支持与生效状态、provider usage、端到端/分段延迟及成本口径，并按批准政策在同 suite/fixture/环境/统计口径重跑候选与稳定基线。退化 MUST 明确量纲与分母；provider 不支持 seed MUST 如实报告并采用批准重复策略，不承诺位级重复。必需实际版本、基线或指标缺失 MUST 为 unavailable 且不可准入；估算 MUST 与实测区分。

#### Scenario: Comparable runs include actual measurements
- **WHEN** 候选和平台选定基线在同套件/夹具/口径运行且实际版本/usage 可验证
- **THEN** 系统 MUST 保存重复分布、退化算法/分母及实际 token/延迟/价格版本/货币口径
- **AND** 不支持 seed 的 provider MUST 记录不支持，不伪称同种子结果确定

#### Scenario: Unknown version baseline or mandatory usage blocks
- **WHEN** 实际模型版本不可解析、中途漂移、非首次发布缺可比较基线或必需 usage/预算指标不可测
- **THEN** 系统 MUST 标明 unavailable 并拒绝 G5 准入
- **AND** MUST NOT 以 env modelId、默认零成本、拼接历史聚合或假造基线替代实际证据
