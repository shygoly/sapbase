## MODIFIED Requirements

### Requirement: State Transition Execution

模板声明的状态迁移 MUST 可被**执行**；非法迁移 MUST 被拒绝。
状态迁移 MUST 与写入走同一入口，使审计连续。

执行 SHALL 强制 expectedVersion 并锁后重算原状态/审批/规则；已有版本 CAS SHALL 保留并扩为不可省略前提。运行时 SHALL 从编译模板获得冻结的 semantic.transitions、transition.rule 与 flow 执行计划，实际执行支持的 check/require-approval 和规则；无 flow 的简单实体 SHALL 继续执行合法语义迁移。未支持动作/规则、缺模块/许可/绑定 MUST 拒绝，MUST NOT 忽略后返回成功。

库存预占/出库 SHALL 仅由平台批准的候选命令绑定和事务处理器实现，MUST NOT 根据状态名或纯计算 check 推断已完成库存写入。已绑定的确认/出库 SHALL 在同一业务事务、锁和数据库约束下维护库存守恒及本订单预占的一次消费；状态、库存、分录、审计、Outbox 与命令结果 MUST 同生共死。未批准的取消/退货/递归流程 MUST 明确拒绝，不恢复旧 workflow 或把 command/effect 变为 Wasm 原子。

#### Scenario: 合法迁移

**Given** 一张处于 `draft` 的订单，模板声明 `draft → confirmed`
**When** 请求迁移到 `confirmed`
**Then** 迁移 SHALL 成功
**And** 审计 SHALL 记录这次迁移（谁、何时、从哪到哪）

合法请求 SHALL 提供当前聚合 expectedVersion，并满足已声明规则、审批和完整动作绑定；未绑定库存效果的简单模板 MUST NOT 声称已经预占库存。

#### Scenario: 非法迁移

**Given** 一张处于 `draft` 的订单
**When** 请求直接迁移到 `shipped`
**Then** 迁移 SHALL 被拒
**And** 状态 MUST NOT 改变

#### Scenario: 完整候选库存交易守恒

- **WHEN** 完整 auto-parts 冻结候选已批准预占/出库绑定，以足够实库完成确认再出库
- **THEN** SHALL 先增加本订单有效预占，再等量减少该预占与实库，关闭 MUST NOT 重复扣减
- **AND** `0 ≤ reservedMinor ≤ onHandMinor` SHALL 始终成立，分录和事件 SHALL 对应同一提交版本

#### Scenario: 缺版本未执行动作和库存竞争拒绝

- **WHEN** 请求缺 expectedVersion、旧版本、transition.rule 失败、flow 动作无法执行，或并发预占可用量不足
- **THEN** 请求 SHALL 被拒绝且 MUST NOT 部分更新状态、库存、分录或事件
- **AND** check 的计算成功 MUST NOT 被视为未绑定预占/扣减已经成功

### Requirement: Referential Integrity on Delete

删除一个被其他实例引用的实例 MUST 被拒绝，除非模板为该关系声明了明确策略。

引用写入与删除 SHALL 使用同事务维护的规范化引用边、可信组织/安装组合外键和稳定锁序，数据库 MUST 最终阻断写删竞争留下悬空引用。删除 MUST 提供目标聚合 expectedVersion；受支持 setNull SHALL 锁定源聚合、核验权限/范围/字段规则并推进其版本。required 或规则不允许为空、大扇出或未支持 cascade MUST 明确拒绝并全部回滚，不猜测递归顺序。

#### Scenario: 删除被引用的零件

**Given** 一个零件被一张订单行引用
**When** 删除该零件
**Then** 删除 SHALL 被拒
**And** 错误 SHALL 指明引用它的实例

引用实例细节 SHALL 只向有权读取它的调用者展示；他租或他安装对象 MUST NOT 通过错误泄露。

#### Scenario: 合法可空策略完整提交

- **WHEN** 可空引用声明受支持 setNull，授权删除携带当前版本且全部源规则可满足
- **THEN** 引用字段/边 SHALL 同事务清空、源聚合版本 SHALL 推进，目标 SHALL 删除
- **AND** 其它引用和来源审计 SHALL 保留一致

#### Scenario: 写删竞争及不合法置空拒绝

- **WHEN** 新增引用与删除同时发生，或 setNull 违反 required/规则/权限/范围，或跨安装引用
- **THEN** 数据库约束及应用校验 SHALL 保证无悬空引用、无部分置空
- **AND** 失败 SHALL 返回授权范围内可定位错误，不自动刷新版本继续删除
