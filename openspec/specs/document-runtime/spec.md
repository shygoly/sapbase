# document-runtime Specification

## Purpose
TBD - created by archiving change add-complete-autoparts-erp. Update Purpose after archive.
## Requirements
### Requirement: Atomic Document Write

一张单据的**头与行** MUST 在一次事务内写入：任一行失败 MUST 使整张单不落库。
MUST NOT 存在"头写进去了、行没写进去"的中间状态。

#### Scenario: 行失败则整单回滚

**Given** 模板声明了头实体与其行实体
**When** 提交一张头合法、但有一行违反校验的单据
**Then** 整个写入 SHALL 失败
**And** 头记录 MUST NOT 落库

#### Scenario: 成功提交后头行可一起读回

**Given** 一张合法的头 + N 行
**When** 提交成功
**Then** 头与其所有行 SHALL 可读回

### Requirement: Concurrency-Safe Document Numbering

系统 SHALL 为每张单据分配业务单号，且 MUST 在并发下不产生重号。

#### Scenario: 并发建单不重号

**Given** 模板声明了单号规则
**When** 多个请求并发创建同类单据
**Then** 每个单据 SHALL 得到不同单号
**And** 重复单号 MUST 被拒绝（数据库唯一约束兜底，而不是只靠应用层判重）

### Requirement: State Transition Execution

模板声明的状态迁移 MUST 可被**执行**；非法迁移 MUST 被拒绝。
状态迁移 MUST 与写入走同一入口，使审计连续。

#### Scenario: 合法迁移

**Given** 一张处于 `draft` 的订单，模板声明 `draft → confirmed`
**When** 请求迁移到 `confirmed`
**Then** 迁移 SHALL 成功
**And** 审计 SHALL 记录这次迁移（谁、何时、从哪到哪）

#### Scenario: 非法迁移

**Given** 一张处于 `draft` 的订单
**When** 请求直接迁移到 `shipped`
**Then** 迁移 SHALL 被拒
**And** 状态 MUST NOT 改变

### Requirement: Query Capability

系统 SHALL 支持对实体实例的分页、排序与按字段/状态过滤；
未声明的过滤字段 MUST 被拒绝（MUST NOT 静默忽略）。

#### Scenario: 分页与排序

**Given** 存在 30 条记录
**When** 请求第 2 页、每页 10 条、按编号降序
**Then** 结果 SHALL 返回第 11–20 条且顺序正确

#### Scenario: 未声明的过滤字段

**Given** 模板未声明字段 `foo`
**When** 用 `foo` 过滤
**Then** 请求 SHALL 被拒并指明该字段未被声明

### Requirement: Referential Integrity on Delete

删除一个被其他实例引用的实例 MUST 被拒绝，除非模板为该关系声明了明确策略。

#### Scenario: 删除被引用的零件

**Given** 一个零件被一张订单行引用
**When** 删除该零件
**Then** 删除 SHALL 被拒
**And** 错误 SHALL 指明引用它的实例

