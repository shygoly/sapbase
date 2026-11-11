## MODIFIED Requirements

### Requirement: Transactional Event Publication

业务事件 MUST 与产生它的业务写入**在同一事务内**持久化；
业务写入回滚时 MUST NOT 留下事件。跨进程投递 MUST NOT 依赖进程内事件总线。

publish SHALL 消费真实事务 manager 与可信租户/安装上下文，事件 SHALL 关联命令、聚合版本及定义摘要。逻辑幂等键 SHALL 按组织/安装隔离，并以无异常 ON CONFLICT 语句处理同事实重复；同键同摘要 SHALL 返回既有事件，不同事实 MUST 拒绝，MUST NOT 覆盖或在捕获无 savepoint 唯一异常后继续事务。

既有主数据逐行导入 SHALL 保留独立事务与显式部分成功；每行产生的事件 MUST 与该行提交，最终批结果与 completed 事件 MUST 同完成事务并可恢复。系统 MUST NOT 虚称所有导入行和最后摘要在同一事务，也 MUST NOT 因完成事件失败重复导入已成功行。

#### Scenario: 业务回滚不留事件

**Given** 一次包含事件发布的业务写入
**When** 该写入因校验失败而回滚
**Then** MUST NOT 存在对应的事件记录

#### Scenario: 事件在重启后仍可投递

**Given** 已持久化但尚未投递的事件
**When** 服务重启
**Then** 该事件 SHALL 仍会被投递

#### Scenario: 同事实重复与租户隔离

- **WHEN** 同命名空间同事实再次 publish，或另一组织/安装使用相同逻辑键发布自身事实
- **THEN** 前者 SHALL 返回同一事件 ID，后者 SHALL 独立持久化且不可读到前者事件
- **AND** 当前业务事务 SHALL 仍可继续合法 SQL 并提交

#### Scenario: 同键改事实与汇总故障拒绝

- **WHEN** 同命名空间同键 payload/版本/定义不同，或导入批完成记录后 completed 事件写入失败
- **THEN** 冲突 SHALL 拒绝而不覆盖；批完成记录和事件 SHALL 一起回滚并可恢复
- **AND** 已独立成功导入行 MUST NOT 被重复执行或伪称全批原子回滚

### Requirement: At-Least-Once Delivery with Idempotency

投递 MUST 至少一次；每条事件 MUST 带幂等键，订阅者 MUST 能据此去重。
投递失败 MUST 可查（重试次数与最后错误），MUST NOT 静默丢弃。

dispatcher SHALL 在可信租户内使用短事务 SKIP LOCKED 领取到期事件，提交租约/fence 后再处理，完成状态 SHALL 按 fence 确认；MUST NOT 把整个组织 drain 或网络副作用放在领取事务内。稳定 subscriberId SHALL 在既有唯一注册面显式登记，MUST NOT 使用类名作持久身份；必需消费者缺失/失败 MUST NOT 标为 delivered。

数据库本地效果 SHALL 与 processed inbox 或等价既有 deliveries 扩展同事务持久幂等，使用无异常冲突语句。已有通知 sourceEventId/userId 唯一键 SHALL 保留，WS SHALL 在效果提交后可重放且按持久 ID 去重。外部效果 MUST 使用可证明的供应商幂等/发送账本/结果不明对账；无此能力 MUST 明确 unresolved/blocked，MUST NOT 宣称网络恰好一次。下方副作用一次指已证明本地或供应商幂等边界的逻辑效果，不意味着只投递一个网络包。

#### Scenario: 重复投递被去重

**Given** 同一事件被投递两次
**When** 订阅者处理
**Then** 副作用 SHALL 只发生一次

#### Scenario: 投递失败可查

**Given** 一次投递失败
**When** 查询事件状态
**Then** 结果 SHALL 包含重试次数与最后错误
**And** SHALL 能手动重投

#### Scenario: 两实例和消费者崩溃恢复

- **WHEN** 两 dispatcher 竞争领取，或消费者效果提交后完成确认前崩溃，租约到期重领
- **THEN** SHALL 通过租约/fence 和持久 processed 记录恢复投递，数据库逻辑效果 SHALL 不重复
- **AND** 旧 fence MUST NOT 确认新 attempt，类重命名 SHALL 保持批准映射的 subscriberId

#### Scenario: 必需消费者缺失或外部结果不明

- **WHEN** 必需订阅者未注册、处理失败，或外部响应不明且无法证明幂等/对账
- **THEN** 状态 SHALL 保留失败或不可确定原因并阻断成功确认
- **AND** MUST NOT 通过删去重行、吞唯一异常或空 subscribers 把事件伪记 delivered
