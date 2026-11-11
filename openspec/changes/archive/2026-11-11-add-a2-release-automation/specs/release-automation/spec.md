# A2 低风险发布自动化

## ADDED Requirements

### Requirement: Whitelisted Change Classes Only

A2 自动发布 SHALL 只允许预定义的低风险、非结构性变更类，白名单之外一律拒绝。

#### Scenario: Structural change is rejected
- **WHEN** 提议涉及数据模型、流程、权限、工具、技能或迁移
- **THEN** A2 MUST 拒绝自动发布
- **AND** 提议 MUST 回到 A1 人工审批

#### Scenario: Low-risk copy change is eligible
- **WHEN** 提议只修改帮助文案、字段提示、错误消息、changelog 措辞或菜单名称（不改权限）
- **THEN** 在应用级 A2 开关打开且策略允许时 MAY 进入 A2 发布

#### Scenario: Whitelist is by change class
- **WHEN** 判断某个提议是否 A2 可用
- **THEN** 系统 MUST 按变更类判断
- **AND** MUST NOT 因“改动行数少”放宽

### Requirement: Platform Policy Service Publishes

A2 发布 SHALL 由平台 `release-automation` 策略服务执行，不得由 PiAgent 执行。

#### Scenario: Agent has no publish permission
- **WHEN** Builder Agent 尝试发布或激活
- **THEN** 平台 MUST 拒绝
- **AND** Agent MUST NOT 持有 publish/activate 权限

#### Scenario: Actor agent is empty
- **WHEN** 记录 A2 发布/回退/复核
- **THEN** `actorAgent` MUST 为空
- **AND** `actorId` MUST 指向策略服务或系统账号

#### Scenario: Policy change requires human approval
- **WHEN** 修改 A2 白名单、阈值或开关
- **THEN** 变更 MUST 由有权限的人审批
- **AND** Agent MUST NOT 修改策略并自动生效

### Requirement: Canary and Guardrails

A2 发布 SHALL 先进入灰度，并在激活前配置护栏阈值。

#### Scenario: Canary is mandatory
- **WHEN** A2 发布一个 Release
- **THEN** 它 MUST 先进入灰度 cohort
- **AND** MUST NOT 直接对全部租户生效

#### Scenario: Guardrails must be explicit
- **WHEN** 启用 A2
- **THEN** 错误率、任务完成率、5xx、工具失败率等阈值 MUST 显式配置
- **AND** 未配置阈值时 MUST NOT 自动回退

#### Scenario: Observation window
- **WHEN** 灰度激活
- **THEN** 每档 MUST 有至少 24h 观察窗口
- **AND** 观察指标 MUST 被记录

### Requirement: Automatic Rollback Is Conditional

自动回退 SHALL 只在显式阈值、目标兼容且策略允许时执行，默认不自动回退。

#### Scenario: Missing threshold blocks auto rollback
- **WHEN** 策略未配置护栏阈值
- **THEN** 系统 MUST NOT 自动回退
- **AND** 只能由人触发回退

#### Scenario: Incompatible target blocks rollback
- **WHEN** 目标 Release 已被 revoked 或数据 schema 不兼容
- **THEN** 自动回退 MUST 被拒绝
- **AND** 系统 MUST 告警并保留现场

#### Scenario: Rollback is audited
- **WHEN** 执行自动回退
- **THEN** 系统 MUST 写审计、通知与 `release_automation_runs`
- **AND** MUST NOT 修改旧 Release

### Requirement: Post-Publish Review and Eligibility

A2 SHALL 要求发布后人工复核，并只在连续无回退时保留资格。

#### Scenario: No review downgrades to A1
- **WHEN** A2 发布后 24h 内无人复核
- **THEN** 应用 MUST 自动降回 A1
- **AND** A2 发布 MUST 停止

#### Scenario: Five clean runs required
- **WHEN** 应用发生回退或护栏触发
- **THEN** 连续无回退计数 MUST 清零
- **AND** 只有连续 5 次无回退才保留 A2 资格

#### Scenario: One-click disable
- **WHEN** 管理员关闭 A2
- **THEN** 所有 A2 行为 MUST 立即停止
- **AND** 进行中的 A2 发布 MUST 回到人工处理

### Requirement: Structural Automation Is Forbidden

系统 SHALL NOT 自动发布任何结构性变更，包括 A3。

#### Scenario: A3 is prohibited
- **WHEN** 有人尝试开启 A3 或让 A2 发布结构性变更
- **THEN** 系统 MUST 拒绝
- **AND** 审计 MUST 记录该尝试

#### Scenario: Quarterly audit proves zero
- **WHEN** 执行季度审计
- **THEN** 报告 MUST 显示结构性变更自动发布次数为 0
- **AND** 任何非零结果 MUST 触发 A2 立即关闭
