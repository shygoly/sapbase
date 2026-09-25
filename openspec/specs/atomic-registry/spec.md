# atomic-registry Specification

## Purpose
TBD - created by archiving change add-wasm-atomic-runtime. Update Purpose after archive.
## Requirements
### Requirement: Atomic Contract Definition

系统 SHALL 允许定义与版本化**原子契约**（Atomic Contract），描述一个最小业务能力的接口与约束，
且契约与其实现解耦。

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

#### Scenario: 契约版本解析

**Given** `available-inventory` 存在 `1.0.0` 与 `1.1.0` 两个版本
**When** 调用方请求 `available-inventory@^1.0`
**Then** 系统 SHALL 解析到满足该语义化范围的最高版本 `1.1.0`
**And** 当范围无法满足时 SHALL 返回明确错误，而非回退到任意版本

### Requirement: Implementation Binding with Admission Evidence

每个原子契约 SHALL 可绑定一个或多个实现，Wasm 实现 MUST 携带模块哈希、ABI 版本与准入证据。

#### Scenario: 绑定 Wasm 实现

**Given** 原子契约 `available-inventory@1.0.0` 处于 `active`
**And** 一个经准入的 Wasm 模块，其清单声明 `sha256`、`abiVersion = 1`、`tier = A`
**When** 将该模块绑定为该契约的实现
**Then** 系统 SHALL 记录 `moduleSha256` / `abiVersion` / `tier` / 闸报告 / 审查背书
**And** 该实现的 `status` SHALL 取自准入状态机（不得为 `active` 之外的越权赋值）

#### Scenario: 拒绝无准入证据的实现

**Given** 一个声称来自第三方（`tier = B`）的原子实现
**When** 其缺少复现构建引用或审查背书
**Then** 系统 SHALL 拒绝绑定，并返回缺失字段说明

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

