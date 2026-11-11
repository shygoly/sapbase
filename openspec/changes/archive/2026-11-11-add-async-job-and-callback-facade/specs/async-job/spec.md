## ADDED Requirements

### Requirement: Job Enqueue and Idempotency

平台 SHALL 支持在业务事务内创建异步任务；业务回滚时任务 MUST 一并回滚。
任务 MUST 有类型、payload、组织上下文与可选幂等键；同一组织/类型/幂等键
MUST 只产生一个任务，重复请求 SHALL 返回已存在任务。

#### Scenario: 事务回滚不留任务

- **WHEN** 业务写入创建任务后因校验失败回滚
- **THEN** 对应任务 MUST NOT 存在
- **AND** worker MUST NOT 执行该任务

#### Scenario: 幂等重复提交

- **WHEN** 调用方用同一幂等键重复创建任务
- **THEN** 系统 SHALL 返回同一个任务 ID
- **AND** MUST NOT 重复执行

### Requirement: Job Lifecycle and Progress

任务 SHALL 有明确状态：`queued` / `running` / `succeeded` / `failed` / `cancelled` /
`waiting` / `dead`。任务 MUST 能上报 0—100 的进度与阶段事件；查询 MUST 返回当前状态、
进度、结果或错误。worker 崩溃或租约过期后任务 MUST 能恢复执行。

#### Scenario: 进度可查询

- **WHEN** 任务执行到 50%
- **THEN** 查询 SHALL 返回 `running` 与 `progress=50`
- **AND** 事件流 SHALL 可按序号回放

#### Scenario: worker 崩溃恢复

- **WHEN** worker 领取任务后崩溃且租约过期
- **THEN** 任务 SHALL 重新进入可领取状态
- **AND** MUST NOT 永久卡在 `running`

#### Scenario: 取消运行中任务

- **WHEN** 调用方取消一个 running 任务
- **THEN** 系统 SHALL 标记取消请求
- **AND** handler 应协作停止；最终状态 MUST NOT 是 `succeeded`

### Requirement: Retry, Timeout, and Dead Letter

任务 SHALL 支持超时、最大重试次数与退避策略。失败任务 MUST 按策略重试；
超过上限 MUST 进入 `dead`（DLQ），保留错误与尝试历史，并支持手动重放。
MUST NOT 静默丢弃失败任务。

#### Scenario: 指数退避

- **WHEN** 任务连续失败且配置指数退避
- **THEN** 下一次执行时间 SHALL 按退避策略延后
- **AND** 尝试历史 SHALL 可查

#### Scenario: 进入 DLQ

- **WHEN** 任务超过最大重试次数
- **THEN** 状态 SHALL 变为 `dead`
- **AND** 管理员 SHALL 能查看错误并手动重放

### Requirement: External Task API

平台 SHALL 提供外部任务门面：创建、查询状态/进度/结果、取消、列表。
任务唯一 ID MUST 可由调用方持久化并轮询；创建/查询/取消 MUST 受组织、应用与权限约束。
请求体中的组织/应用声明 MUST NOT 覆盖可信上下文。

#### Scenario: 外部轮询

- **WHEN** 外部系统创建任务并轮询 `GET /jobs/:id`
- **THEN** 响应 SHALL 包含状态、进度、结果/错误
- **AND** 只能看到本组织/本应用的任务

#### Scenario: 伪造组织

- **WHEN** 请求体携带非成员组织的 `organizationId`
- **THEN** 请求 SHALL 被拒绝
- **AND** MUST NOT 创建跨组织任务

### Requirement: External Callback Security

任务 SHALL 支持外部回调，回调 MUST 使用 HMAC 签名、时间戳与重试；
回调目标 MUST 走 allowlist/SSRF 防护，MUST NOT 访问未授权内网/元数据地址。
回调失败 MUST 记录并支持手动重放，MUST NOT 回滚已完成的业务结果。

#### Scenario: 签名校验

- **WHEN** 回调接收方校验签名
- **THEN** 签名 MUST 与 jobId + timestamp + body 匹配
- **AND** 伪造/过期签名 SHALL 被拒绝

#### Scenario: SSRF 防护

- **WHEN** 回调 URL 指向未授权私网/元数据地址
- **THEN** 系统 SHALL 拒绝回调
- **AND** 记录安全事件

#### Scenario: 回调失败

- **WHEN** 回调返回 5xx 或超时
- **THEN** 系统 SHALL 按退避重试
- **AND** 超过上限后标记 `dead` 并保留结果

### Requirement: Agent Runtime Boundary

Agent 的 run/step/wait 状态 MUST 由 Agent Runtime 拥有；job 门面 MAY 触发 Agent run，
但 MUST NOT 复制或回写 run 状态。job 与 run 通过 `agentRunId` 关联，进度/事件可桥接。

#### Scenario: 长 Agent 任务

- **WHEN** 一个 job 启动 Agent run
- **THEN** job 状态与 agent run 状态 SHALL 分别可查
- **AND** 取消/预算 MUST 由各自所属层执行

#### Scenario: 不产生第二套 run 状态

- **WHEN** job 完成但 agent run 仍在 waiting
- **THEN** job MUST NOT 把 run 标记为完成
- **AND** 以 agent run 状态为准

### Requirement: Tenant Isolation and Security

任务 MUST 绑定组织（可再绑定应用），纳入 RLS；payload MUST 通过类型 schema 校验；
MUST NOT 执行任意代码/命令/URL。任务创建、取消、重试、回调 MUST 写审计。

#### Scenario: 跨租户查询

- **WHEN** A 组织用户查询 B 组织任务
- **THEN** 结果 SHALL 为空或拒绝
- **AND** RLS SHALL 作为最后边界

#### Scenario: 非法 payload

- **WHEN** 创建任务时 payload 不符合类型 schema
- **THEN** 请求 SHALL 被拒绝
- **AND** 任务 MUST NOT 入队

### Requirement: Observability and Administration

平台 SHALL 提供任务列表、详情、事件、重试、取消、DLQ 重放与指标
（积压、成功率、P50/P95 耗时、回调失败率）。超过阈值 MUST 能告警。

#### Scenario: 积压告警

- **WHEN** queued 任务数超过阈值
- **THEN** 系统 SHALL 产生告警
- **AND** 管理员 SHALL 能查看积压分布

#### Scenario: DLQ 重放

- **WHEN** 管理员重放一个 dead 任务
- **THEN** 任务 SHALL 重新进入 queued
- **AND** 重放动作 SHALL 写审计

### Requirement: Backward Compatibility

本能力 MUST NOT 改变 outbox 事件投递、cron 系统任务与现有同步导入/导出行为。
新任务走新接口；旧路径 MUST 继续可用。

#### Scenario: 旧同步导入

- **WHEN** 调用方使用旧同步导入接口
- **THEN** 行为 SHALL 与升级前一致
- **AND** MUST NOT 被强制要求创建 job

#### Scenario: outbox 不受影响

- **WHEN** 业务事件通过 outbox 投递
- **THEN** 投递/重试/幂等行为 SHALL 保持不变
- **AND** MUST NOT 混入 job 状态
