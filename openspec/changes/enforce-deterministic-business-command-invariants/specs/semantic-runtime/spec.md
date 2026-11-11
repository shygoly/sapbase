## ADDED Requirements

### Requirement: Shared Deterministic Business Command Adapter

人工 REST 与 Registry 业务写工具 SHALL 调用同一确定性应用命令用例，共享字段/单据权限、数据范围、有效定义、版本、规则与审计；Kernel MUST NOT 访问模型或执行任意 SQL/脚本。首批命令目录 MUST 只登记已实现并批准的用例；record.update 等尚未实现操作 MUST NOT 因工具或 UI 声明而被视为可执行。工具 MUST 经 Registry 的参数、权限、范围和确认验证，且最终规范化参数摘要 MUST 与确认关联一致。人工不需要伪造工具 token，但 MUST 满足业务审批。

命令上下文 MUST 从可信身份与平台安装/定义解析获得，MUST NOT 信任请求体的权限、组织、角色或执行成功声明。兼容语义审批入口 SHALL 复用既有复核步骤及身份资格判定，body.role MUST NOT 授予审批权；内容/汇总改变 MUST 按既有轮次规则失效重审。现有查询、历史、建议读取 MUST 保持只读。

#### Scenario: 人工与工具执行同一用例

- **WHEN** 同一有效定义下已授权人工请求与经确认的 Registry 工具提交相同建单命令
- **THEN** 两者 SHALL 命中同一命令处理器与字段/规则校验
- **AND** 结果 SHALL 关联真实 commandExecutionId、提交版本和业务事件，不从计划推测成功

#### Scenario: 兼容审批伪造角色被拒绝

- **WHEN** 非当前步骤合法审批者通过旧语义路由自报 body.role 或缺少数据范围资格
- **THEN** 命令 SHALL 拒绝且审批步骤、单据状态与事件 MUST NOT 改变
- **AND** 旧入口 MUST NOT 绕过既有复核平台的可信资格判定

#### Scenario: 未支持操作及未确认工具拒绝

- **WHEN** 工具调用尚未实现的 record.update，或写工具无对应最终参数确认，或请求自报有效安装/定义
- **THEN** 系统 SHALL 拒绝而不直接写 repository、换工具或执行模型推断的业务行为

### Requirement: Persistent Command Outcome and Aggregate Version

创建以外的修改、删除、迁移和审批命令 MUST 提供目标聚合 expectedVersion；头行修改和受支持 setNull SHALL 推进所属聚合版本。命令 SHALL 在稳定锁序下重算原状态、规则、权限及范围，并以含可信命名空间、原版本和必要原状态的 CAS 或等价锁加条件写入提交；适配器 MUST NOT 自动补当前版本或盲重试旧请求。

命令 SHALL 持久保存组织/安装/可信用户/commandId/idempotencyKey 命名空间内的规范化请求摘要、执行权及结果。业务状态、库存、分录、审计、Outbox 和 completed 结果 MUST 同事务提交；同键改参 MUST 拒绝，幂等命中 MUST 重新授权且不得泄露已撤权数据。重启/租约接管 SHALL 使用锁和 fence，旧 owner MUST NOT 提交第二个逻辑效果；既有 PG jobs 仅承载异步运行，不替代此同步交易判据。

#### Scenario: 并发与丢响应恢复同一结果

- **WHEN** 两实例提交同键同摘要命令，成功提交后响应丢失并在重启后重试
- **THEN** SHALL 只有一个逻辑业务提交，重试 SHALL 经重新授权读回相同结果与事件引用
- **AND** 旧 fence 的执行者 MUST NOT 再次提交

#### Scenario: 缺版本或旧版本拒绝

- **WHEN** 修改、删除、迁移或审批缺 expectedVersion，或锁后聚合版本/原状态与预期不符
- **THEN** 命令 SHALL 返回可定位缺前提或冲突错误
- **AND** MUST NOT 自动获取当前版本续写，头行、库存、分录、事件 MUST 保持原值

#### Scenario: 改参或撤权后的幂等命中拒绝

- **WHEN** 同键请求改变目标/参数/定义，或完成后调用者已失去权限或范围
- **THEN** 系统 SHALL 拒绝冲突或授权访问
- **AND** MUST NOT 执行第二次业务写或从缓存返回受限结果

### Requirement: Fixed Numeric Transaction Boundary

decimal/money 写命令 MUST 只接受十进制文本并执行字段 p/s、枚举集合、单位及物理存储范围；裸 decimal SHALL 保留已批准缺省 p18/s4。数量参与金额计算时 MUST 为安全整数或具有明确单位/标度的定点文本，MUST NOT 把遗留浮点强转成精确数据。入口、派生、汇总、审批、分录 SHALL 复用单一 bigint 金额库；中间运算 MUST 保留精度，最终金额字段 SHALL 在声明写入点单一舍入并检查精度，汇总/审批/分录 MUST 引用同一量化值。

货币与入账标度 MUST 显式一致；无批准换算时跨币种 MUST 拒绝。分录当前 signed bigint 小单位 MUST 在写入前校验物理范围，业务 precision=38 MUST NOT 自动扩张此范围。非法数值 MUST 拒绝整个交易，MUST NOT 截断、回绕、静默舍入入口或部分记账。

#### Scenario: 小数数量和单一金额来源

- **WHEN** 批准候选以允许分割单位和固定标度数量文本乘 decimal 单价，生成行金额、总额、审批和分录
- **THEN** SHALL 使用同一库和声明舍入点，结果 SHALL 与批准预期相符且可从数据库对账
- **AND** 审批/分录 SHALL 引用同一量化总额与币种/标度

#### Scenario: 浮点精度枚举与数量非法拒绝

- **WHEN** decimal 输入为 JSON number/指数文本、超 p/s，枚举不在 values，或数量单位/标度未知及非安全整数
- **THEN** 命令 SHALL 给出实体/字段错误且 MUST NOT 落库
- **AND** MUST NOT 移除非整数 number 与 decimal 混算的拒绝而恢复浮点计算

#### Scenario: 物理范围和跨币种拒绝

- **WHEN** 金额虽满足业务 p/s 但分录小单位超 signed bigint，或货币/入账标度不兼容且无批准转换
- **THEN** 整个交易 SHALL 被拒绝，状态、库存、分录及 Outbox MUST 回滚
