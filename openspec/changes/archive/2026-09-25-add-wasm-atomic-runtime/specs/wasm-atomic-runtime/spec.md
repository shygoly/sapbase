# Wasm Atomic Runtime Specification

## ADDED Requirements

### Requirement: Fail-Closed Pre-Execution Verification

运行时 SHALL 在执行原子前完成全部校验，任一校验不通过 MUST 拒绝执行，且 MUST NOT 回退到内置实现。

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

### Requirement: Zero-Capability Execution Sandbox

原子 SHALL 在零能力环境中执行：内存由宿主注入并声明上限，模块 MUST NOT 拥有文件、网络、进程或系统调用能力。

#### Scenario: 宿主注入内存并投影输入

**Given** 一个待执行的原子调用，输入包含标识字段（如物料号）与数值字段
**When** 运行时准备执行
**Then** 运行时 SHALL 创建有上限的宿主内存并注入模块
**And** SHALL 只把**整数列投影**写入内存，标识字段 MUST NOT 进入模块
**And** SHALL 在调用后按索引把输出回填为业务字段

#### Scenario: 输出超出契约上限则拒绝

**Given** 某原子契约声明输出字节上限
**When** 一次调用的输出超出该上限
**Then** 运行时 SHALL 拒绝该结果
**And** SHALL 记录审计事件

### Requirement: Resource Limits

运行时 SHALL 对原子执行施加时间与输出资源限制，超限 MUST 中断并记为失败。

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
