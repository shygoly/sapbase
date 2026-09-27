# notification-outbox Specification

## ADDED Requirements

### Requirement: Transactional Event Publication

业务事件 MUST 与产生它的业务写入**在同一事务内**持久化；
业务写入回滚时 MUST NOT 留下事件。跨进程投递 MUST NOT 依赖进程内事件总线。

#### Scenario: 业务回滚不留事件

**Given** 一次包含事件发布的业务写入
**When** 该写入因校验失败而回滚
**Then** MUST NOT 存在对应的事件记录

#### Scenario: 事件在重启后仍可投递

**Given** 已持久化但尚未投递的事件
**When** 服务重启
**Then** 该事件 SHALL 仍会被投递

### Requirement: At-Least-Once Delivery with Idempotency

投递 MUST 至少一次；每条事件 MUST 带幂等键，订阅者 MUST 能据此去重。
投递失败 MUST 可查（重试次数与最后错误），MUST NOT 静默丢弃。

#### Scenario: 重复投递被去重

**Given** 同一事件被投递两次
**When** 订阅者处理
**Then** 副作用 SHALL 只发生一次

#### Scenario: 投递失败可查

**Given** 一次投递失败
**When** 查询事件状态
**Then** 结果 SHALL 包含重试次数与最后错误
**And** SHALL 能手动重投

### Requirement: Persistent Notifications

通知 MUST 持久化（MUST NOT 只存内存），已读状态 MUST 持久；重启 MUST NOT 丢失未读通知。

#### Scenario: 重启后未读仍在

**Given** 一条未读通知
**When** 服务重启
**Then** 该通知 SHALL 仍在未读列表中

#### Scenario: 审批待审产生通知

**Given** 一张单据进入待审
**When** 审批事件被投递
**Then** 对应审批人 SHALL 收到一条通知

### Requirement: Approval Inbox

系统 SHALL 提供按审批人聚合的待办入口：列出**所有**等待该审批人处理的审批项，
MUST NOT 要求调用方先知道是哪张单。

#### Scenario: 待办列出跨单据类型的待审项

**Given** 三种不同单据各有待审项，审批人相同
**When** 读取待办
**Then** 结果 SHALL 包含全部三项

#### Scenario: 批准后即时从待办消失

**Given** 待办中有一项
**When** 批准它
**Then** 该批准与待办状态变更 SHALL 在同一事务内完成
**And** 待办中 MUST NOT 再出现该项
