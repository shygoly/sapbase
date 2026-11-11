# atomic-registry Specification

## ADDED Requirements

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

## MODIFIED Requirements

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
