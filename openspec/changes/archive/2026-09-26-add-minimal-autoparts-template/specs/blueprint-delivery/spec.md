# blueprint-delivery Specification

## ADDED Requirements

### Requirement: Additive Protocol Extension

对**已冻结协议**的扩展 MUST 是加法式的：只允许新增允许值（枚举项、角色名、操作符），
MUST NOT 改变既有值的语义、也 MUST NOT 放松既有判据。
每次扩展 MUST 在协议文本里登记**发起它的变更 id**，并 MUST 配一条"未知值仍被拒"的负例。

#### Scenario: 加法式扩展一个枚举

**Given** 模板需要一个冻结枚举里没有的值（如 `greaterOrEqual`）
**When** 扩展该枚举
**Then** 既有值的行为 MUST 保持不变
**And** 协议文本 SHALL 记录发起扩展的变更 id
**And** SHALL 存在"未知值仍被拒"的负例

#### Scenario: 不得用相近条件顶替表达不了的语义

**Given** 模板想要的条件（如金额合计 `quantity * unitPrice`）在当前受限语法里无法表达
**When** 作者改用一个可表达但**语义不同**的条件
**Then** 该条件的 `id` 与 `message` MUST 描述它**实际检查的东西**
**And** 无法表达的语义 SHALL 在协议文本里登记为**已知缺口**，MUST NOT 用相近条件静默顶替
