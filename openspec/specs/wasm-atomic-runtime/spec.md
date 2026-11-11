# wasm-atomic-runtime Specification

## Purpose
TBD - created by archiving change add-wasm-atomic-runtime. Update Purpose after archive.
## Requirements
### Requirement: Fail-Closed Pre-Execution Verification

运行时 SHALL 在执行原子前完成全部校验（含与执行引擎的**握手与版本协商**），
任一校验不通过 MUST 拒绝执行，且 MUST NOT 回退到内置实现。

#### Scenario: 校验通过后执行

**Given** 原子契约 `available-inventory@1.0.0` 处于 `active`
**And** 其 Wasm 实现处于可执行状态
**And** 模块字节的 SHA-256 与绑定值一致
**And** 静态闸校验通过
**And** 调用方拥有契约声明的权限
**When** 调用方发起调用，输入符合 `inputSchema`
**Then** 运行时 SHALL 执行原子并返回契约定义的结果

#### Scenario: 字节哈希不符则拒绝且不回退

**Given** 磁盘上的模块字节被替换，其 SHA-256 与绑定值不一致
**When** 调用方发起调用
**Then** 运行时 SHALL 拒绝执行
**And** SHALL 返回明确的错误（而非任何内置实现的计算结果）
**And** SHALL 记录审计事件

#### Scenario: 静态闸不通过则拒绝

**Given** 模块字节包含非白名单导入（如 WASI 函数）或含 start 段
**When** 运行时校验该模块
**Then** 校验 SHALL 失败并给出闸的拒绝原因
**And** 该模块 MUST NOT 被实例化

#### Scenario: 引擎握手失败或版本不匹配则拒绝启动

**Given** 执行引擎为 sidecar 形态
**When** 握手失败、协议版本不匹配，或 sidecar 报告的引擎版本不在允许范围内
**Then** 运行时 SHALL 拒绝启动该引擎
**And** MUST NOT 静默回退到其他引擎（除非显式配置允许，且回退须写入审计）

### Requirement: Zero-Capability Execution Sandbox

原子 SHALL 在零能力环境中执行：内存由宿主注入并声明上限，模块 MUST NOT 拥有文件、网络、进程或系统调用能力。
执行 SHALL 发生在与宿主**分离的进程**中，使模块或引擎崩溃不波及宿主。

#### Scenario: 宿主注入内存并投影输入

**Given** 一个待执行的原子调用，输入包含标识字段（如物料号）与数值字段
**When** 运行时准备执行
**Then** 运行时 SHALL 创建有上限的宿主内存并注入模块
**And** SHALL 只把**整数列投影**写入内存，标识字段 MUST NOT 进入模块
**And** SHALL 在调用后按索引把输出回填为业务字段

#### Scenario: 执行发生在独立进程

**Given** 引擎以 sidecar 形态运行
**When** 模块执行期间发生 trap 或引擎进程崩溃
**Then** 宿主进程 MUST 保持存活
**And** 该次调用 SHALL 失败并记录审计（含引擎标识）
**And** 引擎进程 SHALL 被重启，且重启后的调用 SHALL 能正常执行

#### Scenario: 输出超出契约上限则拒绝

**Given** 某原子契约声明输出字节上限
**When** 一次调用的输出超出该上限
**Then** 运行时 SHALL 拒绝该结果
**And** SHALL 记录审计事件

### Requirement: Resource Limits

运行时 SHALL 对原子执行施加**指令预算**、时间与输出资源限制，超限 MUST 中断并记为失败。
指令预算来自契约的 `cpuBudget` 或平台默认值；时间限制以 epoch 中断实现，墙钟超时作为最后一道。

#### Scenario: 指令预算耗尽被中断

**Given** 一次原子调用声明或继承了一个 fuel 指令预算
**When** 模块执行消耗的指令数超过该预算
**Then** 运行时 SHALL 中断该次执行
**And** SHALL 返回失败并记录审计（含预算与实际用量）
**And** MUST NOT 返回部分结果，也 MUST NOT 回退到内置实现

#### Scenario: 长循环按 epoch 被中断

**Given** 一个含长时间循环的模块，且其指令预算设置得足够大
**When** 执行超过 epoch 时间片上限
**Then** 运行时 SHALL 在该时间片内中断执行
**And** 中断 SHALL 早于墙钟兜底超时

#### Scenario: 执行超时被中断

**Given** 一次原子调用在墙钟上限内未返回
**When** 超过配置的执行超时
**Then** 运行时 SHALL 终止该执行
**And** SHALL 返回超时错误
**And** SHALL NOT 返回部分结果

### Requirement: Execution Audit

每次原子调用 SHALL 产生审计事件，记录可追溯的执行证据。

#### Scenario: 记录调用审计

**Given** 一次原子调用（无论成功或失败）
**When** 执行结束
**Then** 系统 SHALL 记录：原子类型与版本、模块哈希、调用方、租户、耗时、结果状态
**And** 审计记录 SHALL 可按模块哈希与原子类型检索

### Requirement: Revocation Enforcement

运行时 SHALL 在执行前检查吊销名单，命中即拒。

#### Scenario: 已吊销模块不可执行

**Given** 某模块哈希已被加入吊销名单
**When** 调用方请求执行该模块对应的原子
**Then** 运行时 SHALL 拒绝执行
**And** SHALL 返回吊销原因与时间
**And** MUST NOT 回退到该原子的其他实现或内置实现

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

### Requirement: Engine Host Contract

执行引擎与宿主 SHALL 通过显式协议通信，协议 SHALL 版本化并可协商；
引擎 MUST 只接受宿主给定的工作（加载模块、按偏移与长度调用），MUST NOT 解释业务语义。

#### Scenario: 协议版本协商

**Given** 宿主以协议版本 `1` 发起握手
**When** 引擎报告的协议版本或引擎版本不被支持
**Then** 宿主 SHALL 拒绝使用该引擎
**And** SHALL 给出可诊断的失败原因（协议号、期望与实际）

#### Scenario: 重复加载同一模块幂等

**Given** 引擎已按某 `sha256` 加载过模块
**When** 宿主再次请求加载同一 `sha256`
**Then** 引擎 SHALL 复用已编译模块
**And** MUST NOT 因重复加载而报错或重复编译

#### Scenario: 引擎不解释业务语义

**Given** 一次调用请求只包含内存偏移、行数、输出长度与预算
**When** 引擎执行该调用
**Then** 引擎 MUST NOT 接触契约、权限、审计或业务字段
**And** 投影与回填 SHALL 全部由宿主完成

