# atomic-registry Specification

## Purpose
TBD - created by archiving change add-wasm-atomic-runtime. Update Purpose after archive.
## Requirements
### Requirement: Atomic Contract Definition

系统 SHALL 允许定义与版本化**原子契约**（Atomic Contract），描述一个最小业务能力的接口与约束，
且契约与其实现解耦。契约 MAY 声明该原子的**执行预算**（`cpuBudget`，fuel 指令单位）；
未声明时由平台取默认预算。

#### Scenario: 定义计算型原子契约

**Given** 平台内置或组织内的原子定义者
**When** 其创建原子契约，包含：
- `atomicType`（如 `available-inventory`）
- `version`（语义化版本，如 `1.0.0`）
- `kind`（`calculation` 或 `query`）
- `inputSchema`（输入投影字段与类型）
- `outputSchema`（输出字段、值域与字节上限）

**Then** 契约 SHALL 被持久化，并带 `status = draft`
**And** 同一 `atomicType` 下不同 `version` SHALL 可共存
**And** 系统 SHALL 拒绝 `kind` 为 `command` / `effect` 的契约（v1 不支持写入型原子）

#### Scenario: 声明执行预算

**Given** 一个原子契约
**When** 其声明可选字段 `cpuBudget`（正整数，fuel 单位）
**Then** 该预算 SHALL 被持久化并在执行时作为指令上限传递
**And** 未声明 `cpuBudget` 的既有契约 SHALL 不受影响（仍可登记与执行，取平台默认预算）

#### Scenario: 契约版本解析

**Given** `available-inventory` 存在 `1.0.0` 与 `1.1.0` 两个版本
**When** 调用方请求 `available-inventory@^1.0`
**Then** 系统 SHALL 解析到满足该语义化范围的最高版本 `1.1.0`
**And** 当范围无法满足时 SHALL 返回明确错误，而非回退到任意版本

### Requirement: Implementation Binding with Admission Evidence

绑定实现 SHALL 记录能指认"客户同意运行的那一份代码"的证据（`moduleSha256` / `abiVersion` / `tier` /
复现构建引用 / 审查背书）。绑定到 `shadow` / `canary` / `active` 时，
MUST 同时满足闸 4 的证据门；吊销动作不受此限制。

#### Scenario: 绑定可运行状态需要证据

**Given** 一个尚未经过影子期的实现
**When** 请求绑定为 `active`
**Then** 绑定 SHALL 失败并指明缺少的阶段
**And** MUST NOT 写入任何"部分绑定"的记录

#### Scenario: 吊销始终可达

**Given** 一个缺少晋升证据的实现
**When** 请求将其吊销
**Then** 吊销 SHALL 成功
**And** 该实现 MUST NOT 再被执行

### Requirement: Module Manifest Import

系统 SHALL 支持从 `wasm-modules/build/manifest.json` 导入原子模块，且 MUST NOT 采信清单自述的哈希。

#### Scenario: 导入清单并重算哈希

**Given** 一份包含模块条目的准入清单与对应的 `.wasm` 文件
**When** 执行导入
**Then** 系统 SHALL 对每个模块字节重新计算 SHA-256
**And** 重算结果与清单声明不符时 SHALL 拒绝该条目
**And** 相符时 SHALL 记录导入台账（文件、哈希、层级、导入人、原始清单快照）
**And** 系统 SHALL 对字节执行静态准入复检，并把报告写入实现记录

#### Scenario: 导入幂等

**Given** 同一模块（相同 `sha256`）已被导入
**When** 再次导入同一清单
**Then** 系统 SHALL 不产生重复记录
**And** 已有绑定关系 SHALL 保持不变

### Requirement: Module Dependency on Atomics

`module-registry` 中的模块 SHALL 可声明其依赖的原子，并在发布时校验依赖可用性。

#### Scenario: 模块声明原子依赖

**Given** 一个模块定义
**When** 该模块声明 `dependsOnAtomics: ["available-inventory@^1.0"]`
**Then** 系统 SHALL 记录模块与原子的关联
**And** 发布时 SHALL 校验每个依赖原子存在且其实现状态可执行
**And** 依赖不满足时 SHALL 拒绝发布并指明缺失的原子

### Requirement: Output Audit Declaration

原子契约 SHALL 能声明输出管控所需的判据前提：执行档位（`outputAudit`）、
输出行的可交换性（`commutative`）、逐列值域（`range`）。
这些声明 MUST 为**可选**，且未声明时 MUST NOT 被解释为"已通过该项判据"。

#### Scenario: 未声明即不判

**Given** 一个契约未声明 `commutative`
**When** 执行输出管控
**Then** 置换不变性 MUST NOT 被判定
**And** 审计 SHALL 记录该项为"未判"

#### Scenario: 非法声明被拒

**Given** 一个契约声明了未知的 `outputAudit` 档位，或某列 `range` 的下界大于上界
**When** 登记或导入该契约
**Then** 校验 SHALL 失败
**And** SHALL 指明具体字段与原因

