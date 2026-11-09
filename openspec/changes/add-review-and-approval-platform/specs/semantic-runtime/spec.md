## ADDED Requirements

### Requirement: Review and Approval Execution

声明了审批/复核规则的实体，其提交 SHALL 创建带轮次的复核步骤链。
机器检测与人工步骤 MUST 按声明顺序执行；整体通过前 MUST NOT 发布或执行受控状态迁移。
驳回/请求修改 MUST 阻断；重新提交 MUST 创建新轮次并保留旧轮次。

#### Scenario: 发布前必须整体通过

- **WHEN** 一条内容记录存在未完成的复核步骤
- **THEN** 发布/受控迁移 SHALL 被拒绝
- **AND** 错误 SHALL 指明当前待处理步骤

#### Scenario: 机器检测通过后进入人工

- **WHEN** 规则第一步是 `check` 且返回 `pass`
- **THEN** 系统 SHALL 推进到下一步人工复核
- **AND** 机器检测证据 SHALL 可查

#### Scenario: 驳回后重新提交

- **WHEN** 人工步骤 reject 或 request-changes，作者修改后重新提交
- **THEN** 系统 SHALL 创建新 round
- **AND** 旧 round 的决策与评论 MUST 保留

#### Scenario: 越权审批

- **WHEN** 非当前步骤合法审批人尝试批准
- **THEN** 操作 SHALL 被拒绝
- **AND** 记录状态 MUST NOT 改变
