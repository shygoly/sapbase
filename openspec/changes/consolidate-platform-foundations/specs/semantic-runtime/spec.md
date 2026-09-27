# semantic-runtime Specification (delta)

## ADDED Requirements

### Requirement: Transition History Readback

语义运行时 SHALL 能按实例读回其状态迁移序列，且 MUST 以既有的迁移审计为**唯一**来源
（MUST NOT 为历史另建一张表）。读取 MUST 受授权门与租户隔离约束。

#### Scenario: 迁移后可读回序列

**Given** 一条记录经 `draft → confirmed → shipped` 三次迁移
**When** 读取该记录的历史
**Then** 结果 SHALL 按时序给出 `(from, to)` 序列与操作者
**And** 不存在的记录或他租记录 SHALL 返回 404

#### Scenario: 无迁移历史不是错误

**Given** 一条从未迁移过的记录
**When** 读取该记录的历史
**Then** 结果 SHALL 为 `200` + 空数组

### Requirement: Suggested Transitions Are Read-Only

系统 SHALL 提供"建议迁移"读取：依据**当前模板**声明的状态与迁移，从记录**当前状态**给出合法目标，
并在需要审批时给出待审依据。该读取 MUST NOT 改变记录状态、MUST NOT 提升版本、MUST NOT 写审计
（建议与执行分离）。

#### Scenario: 建议不改状态

**Given** 一条处于 `draft` 的记录
**When** 读取建议迁移
**Then** 返回 SHALL 列出合法的目标状态
**And** 调用后记录的 `version` 与迁移审计行数 SHALL 不变

#### Scenario: 需要审批时给出依据

**Given** 该实体声明了审批规则且条件成立、审批链尚未全部批准
**When** 读取建议迁移
**Then** 每个目标 SHALL 标注是否需要审批
**And** SHALL 给出待审的规则与角色

### Requirement: Single Record Read Shares the Read Path

单条记录读取 MUST 与列表读取共用同一套后处理（状态解析、声明式默认值的读时补全、字段级权限省略），
MUST NOT 另写一套组装逻辑；MUST 按租户过滤，其他租户的记录一律视为不存在。

#### Scenario: 默认值与字段权限在单条读上同样生效

**Given** 当前模板对某字段声明了 `default`，且另一字段声明了读取权限而调用方不具备
**When** 读取该记录
**Then** 缺字段 SHALL 以默认值呈现
**And** 受限字段 SHALL 被省略且列入 `omittedFields`

### Requirement: Transactional Business Event Publication

语义运行时在迁移、审批链建立、审批决定、导入完成时 MUST 把业务事件写入 outbox，
且写入 MUST 与产生它的业务写入**在同一事务内**；业务写入回滚时 MUST NOT 留下事件。
事件 MUST NOT 经由进程内事件总线跨进程投递。

#### Scenario: 业务回滚不留事件

**Given** 一次迁移，其状态已变更且事件已写入，但随后的记账判定失败
**When** 该迁移失败并回滚
**Then** MUST NOT 存在对应的事件记录
**And** 记录状态 MUST 保持迁移前的值

#### Scenario: 事件与业务写入同生共死

**Given** 一次成功的迁移
**When** 事务提交
**Then** SHALL 存在一条与本次迁移对应的 outbox 事件
**And** 该事件 SHALL 带有可去重的幂等键

### Requirement: Audit Provenance During Convergence

收敛的双跑期内，蓝图路径与旧工作流路径写入的审计 MUST 处于同一张审计表，
并用来源标记区分（蓝图路径标 `blueprint`）；迁移历史的读取 MUST 只认蓝图路径的审计行，
MUST NOT 把旧路径的审计行当作蓝图历史。

#### Scenario: 来源可区分

**Given** 一次经蓝图接口完成的迁移
**When** 读取审计
**Then** 该条审计 SHALL 带来源标记 `blueprint`
**And** 历史接口 SHALL NOT 返回旧路径（`legacy-workflow`）的行
