# wasm-atomic-runtime Specification (delta)

## MODIFIED Requirements

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

## ADDED Requirements

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
