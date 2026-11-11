# wasm-atomic-runtime Specification

## ADDED Requirements

### Requirement: Output Gate (Gate 3)

原子执行完成后、结果返回之前，系统 MUST 按契约声明的档位执行输出管控判据。
命中判决 MUST 拒绝返回结果，MUST NOT 以"警告后放行"的方式降级。
全部判据 MUST 是确定性的：同样的输入与声明 MUST 得到同样的结论。

#### Scenario: 结构封闭与值域

**Given** 一个声明了 `outputSchema.columns` 的契约
**When** 实现返回了未声明的列、缺少列、列序不同，或某个值超出声明类型与 `range`
**Then** 闸 3 SHALL 判定失败并给出具体列与期望/实际值
**And** 调用方 MUST NOT 收到任何部分结果

#### Scenario: 批量与单条一致

**Given** 同一组输入
**When** 一次批量计算与逐条计算后拼接的结果出现任何逐值差异
**Then** 闸 3 SHALL 判定失败
**And** 审计 SHALL 记录实际执行的内核回合数

#### Scenario: 置换不变仅在声明后可判

**Given** 契约未声明该原子可交换
**When** 打乱输入行序
**Then** 闸 3 MUST NOT 判定失败（判不了就不判）
**And** 审计 SHALL 明确记录"O5 未判"

#### Scenario: 声明可交换后的置换不变

**Given** 契约声明该原子可交换（`commutative: true`）
**When** 打乱输入行序后输出行未随之重排，或汇总位发生变化
**Then** 闸 3 SHALL 判定失败

#### Scenario: 常量位模式只是信号

**Given** 某个输出列出现了与输入无关的重复位模式
**When** 闸 3 运行
**Then** 系统 SHALL 写入审计信号
**And** MUST NOT 因此拒绝结果（合法原子可能真的输出常量，例如空输入的零汇总）

#### Scenario: 档位

**Given** 契约声明 `outputAudit: off`
**Then** 闸 3 MUST NOT 执行追加判据（既有的大小上限检查不受影响）

**Given** 契约未声明 `outputAudit`
**Then** 系统 SHALL 按 `standard` 执行（O1–O4）

### Requirement: Shadow Release (Gate 4)

实现绑定到 `shadow` / `canary` / `active` MUST 以平台记录的证据为前提；
跳级 MUST 被拒绝，且 MUST NOT 允许调用方以请求体字段冒充证据。

#### Scenario: 不得跳级

**Given** 一个处于 `tested` 的实现
**When** 直接请求绑定为 `active`
**Then** 绑定 SHALL 失败
**And** 错误 SHALL 指明缺少 `shadow` / `canary` 阶段的证据

#### Scenario: 证据不足

**Given** 一个处于 `shadow` 的实现
**When** 影子期存在未审查的差异，却请求晋升到 `canary`
**Then** 绑定 SHALL 失败
**And** SHALL 列出差异条数（而不是一句"证据不足"）

#### Scenario: 吊销不受闸 4 限制

**Given** 一个任意状态的实现
**When** 将其吊销
**Then** 吊销 SHALL 立即生效
**And** MUST NOT 因缺少晋升证据被拒（安全动作永远可达）
