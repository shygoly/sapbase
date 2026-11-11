# atomic-registry Specification (delta)

## MODIFIED Requirements

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
