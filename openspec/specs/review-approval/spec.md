# review-approval Specification

## Purpose
TBD - created by archiving change add-review-and-approval-platform. Update Purpose after archive.
## Requirements
### Requirement: Review Step Definitions

复核/审批 SHALL 支持串行步骤，每步 MUST 声明类型（`human` 或 `check`）与审批人选择器。
`human` 选择器 MUST 支持角色、用户、岗位、创建者；`check` MUST 声明机器检测 provider。
步骤配置非法（缺 selector、缺 provider、角色不存在）MUST 在保存或编译时拒绝。

#### Scenario: 多级人工复核

- **WHEN** 一条规则声明“年级主任 → 校级管理员”两个 human 步骤
- **THEN** 第一步通过后才推进到第二步
- **AND** 任一步骤被拒绝时整体不得通过

#### Scenario: 缺少审批人选择器

- **WHEN** 一个 human 步骤没有 role/user/position/creator 选择器
- **THEN** 保存或编译 SHALL 失败并指明步骤

### Requirement: Machine Check Steps

`check` 步骤 SHALL 通过异步任务执行机器检测，结果 MUST 为 `pass` / `warn` / `fail`。
`fail` MUST 阻断；`warn` MUST 要求人工确认，MUST NOT 当作通过；
provider 异常、超时或结果非法 MUST 按 `fail` 处理（fail-closed）。

#### Scenario: 内容安全检测失败

- **WHEN** 机器检测返回 `fail`
- **THEN** 复核 SHALL 停在当前步骤并通知作者
- **AND** MUST NOT 进入人工通过或发布

#### Scenario: 检测警告

- **WHEN** 机器检测返回 `warn`
- **THEN** 必须有具备权限的人工明确确认
- **AND** 未确认时整体 MUST NOT 通过

#### Scenario: provider 异常

- **WHEN** 检测 provider 超时或抛错
- **THEN** 结果 SHALL 视为 `fail`
- **AND** MUST NOT 自动放行

### Requirement: Human Decisions and Resubmission

人工步骤 SHALL 支持 approve、reject、request-changes、resubmit、delegate、comment。
reject/request-changes MUST 阻断整体；resubmit MUST 创建新轮次并保留旧轮次只读。
只有当前 pending 步骤的合法审批人可操作。

#### Scenario: 驳回后重新提交

- **WHEN** 作者根据驳回意见修改记录并重新提交
- **THEN** 系统 SHALL 创建新 round
- **AND** 旧 round 的步骤、评论与决策 MUST 保留可查

#### Scenario: 非当前审批人操作

- **WHEN** 非当前步骤的审批人尝试 approve
- **THEN** 操作 SHALL 返回 403
- **AND** 步骤状态 MUST NOT 改变

#### Scenario: 请求修改不等于通过

- **WHEN** 审批人选择 request-changes
- **THEN** 整体状态 SHALL 回到作者
- **AND** MUST NOT 触发发布或状态迁移

### Requirement: Dynamic Assignee Resolution

岗位审批人 SHALL 能按记录的数据范围节点动态解析：从记录绑定字段找到 scope 节点，
再查该节点上指定 `positionKey` 的活跃成员。解析不到审批人时 MUST 阻塞并告警，
MUST NOT 自动跳过该步骤。

#### Scenario: 按班级解析班主任

- **WHEN** 复核规则要求“该学生所在班级的班主任”，记录声明了 `classId → class`
- **THEN** 系统 SHALL 解析该班级节点上的 `head_teacher` 成员
- **AND** 只有该成员可处理该步骤

#### Scenario: 班级没有班主任

- **WHEN** 记录绑定班级没有对应岗位成员
- **THEN** 步骤 SHALL 阻塞并产生告警
- **AND** MUST NOT 自动视为通过

### Requirement: Work Item Inbox

系统 SHALL 提供通用工作项（work item）读模型，聚合审批、复核、教学任务、申诉等待办。
work item MUST 引用源对象（`sourceType + sourceId`），MUST NOT 成为审批/任务状态的第二真源。
查询 MUST 按组织、assignee、状态、优先级、到期时间过滤，并支持批量处理。

#### Scenario: 跨来源待办

- **WHEN** 用户同时有待审 Blueprint 记录、待复核内容和待处理教学任务
- **THEN** 待办中心 SHALL 在一个列表中返回三类工作项
- **AND** 每项 SHALL 能跳转到对应源对象

#### Scenario: 源状态变化

- **WHEN** 一个审批被批准
- **THEN** 对应 work item SHALL 自动完成或消失
- **AND** 不得出现“审批已完成但待办仍在”的状态

### Requirement: Delegation, SLA, and Escalation

复核步骤 SHALL 支持委托、SLA 与到期升级。委托 MUST 限定范围与有效期并记录原/受委托人；
提醒 MUST 幂等；升级 MUST 按配置执行，MUST NOT 自动代替人工决策。

#### Scenario: 委托审批

- **WHEN** 审批人把当前步骤委托给另一用户
- **THEN** 受委托人 SHALL 能代为决定
- **AND** 审计 SHALL 同时记录原审批人与受委托人

#### Scenario: SLA 到期升级

- **WHEN** 步骤超过 SLA 未处理且配置了升级
- **THEN** 系统 SHALL 通知/升级到上一级
- **AND** MUST NOT 自动通过该步骤

### Requirement: Audit and Notification

每次提交、检测、批准、驳回、请求修改、重新提交、委托、升级 MUST 写入追加式审计，
包含操作者、轮次、步骤、决策前后状态、评论/附件引用与时间。
通知 MUST 覆盖待办分配、驳回、通过、SLA 提醒与升级。

#### Scenario: 决策可追溯

- **WHEN** 查询一条复核记录的历史
- **THEN** 结果 SHALL 按时间给出每轮每步的操作者、动作与理由
- **AND** 不存在的记录或他租记录 SHALL 返回 404

#### Scenario: 通过后通知

- **WHEN** 整体复核通过
- **THEN** 作者与相关审批人 SHALL 收到通知
- **AND** 发布/迁移方可继续

### Requirement: Backward Compatibility

本能力 MUST NOT 改变未声明新步骤类型的旧审批定义与旧数据行为。
旧 `role` 步骤 MUST 映射为 `human + role` 选择器；旧 approve 接口 MUST 继续可用；
旧待办查询 MUST 仍能返回未审项。

#### Scenario: 旧模板继续工作

- **WHEN** 旧模板只声明 `role` 步骤且没有 `check/SLA/委托`
- **THEN** 审批行为 SHALL 与升级前一致
- **AND** 旧数据 MUST 可读、可继续审批

#### Scenario: 旧接口兼容

- **WHEN** 客户端调用旧 `POST /approvals/:ruleId/approve`
- **THEN** 请求 SHALL 被接受
- **AND** 新轮次/历史字段 SHALL 有合理默认值

