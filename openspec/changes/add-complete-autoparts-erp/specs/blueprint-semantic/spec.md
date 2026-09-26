# blueprint-semantic Specification

## ADDED Requirements

### Requirement: Master-Detail Structure

语义层 SHALL 支持"头 + 行"结构：头实体声明其行实体，行实体声明对头的归属。
编译期 MUST 校验双向一致（头声明的行必须存在，行的 parent 必须指回头）。

#### Scenario: 声明一张多行订单

**Given** `SalesOrder` 声明 `children: ["SalesOrderLine"]`
**And** `SalesOrderLine` 声明 `parent: SalesOrder`
**When** 编译该模板
**Then** 编译 SHALL 通过
**And** 写入一张两行的订单 SHALL 成为可能

#### Scenario: 头行声明不一致

**Given** 头声明了某行实体，但该行实体未声明 parent（或 parent 指向别处）
**When** 编译该模板
**Then** 编译 SHALL 失败并指明不一致之处

### Requirement: Declarative Uniqueness Enforced by Database

字段唯一性 MUST 可声明，且 MUST 翻译为**数据库唯一索引**。
MUST NOT 只依赖应用层判重（并发下"先查后写"会双双通过）。

#### Scenario: 唯一字段重复写入

**Given** `Part.partNo` 声明为唯一
**When** 写入两个相同 `partNo` 的零件
**Then** 第二次写入 SHALL 被拒
**And** 即使绕过应用层校验直接写库，唯一索引 SHALL 同样拒绝

### Requirement: Fixed-Point Money with Single Rounding Point

金额 MUST 用定点数声明（精度与标度）并声明舍入方式；MUST NOT 用二进制浮点数表达金额。
舍入 MUST 只发生在写入前一处。

#### Scenario: 金额加法不产生浮点误差

**Given** 两个金额 `0.1` 与 `0.2`（标度 2）
**When** 求和
**Then** 结果 SHALL 等于 `0.3`
**And** 中间计算 MUST NOT 提前舍入

#### Scenario: 用 number 声明金额被拒

**Given** 语义层声明 `type: "number"` 给金额字段
**When** 校验该模板
**Then** 校验 SHALL 失败（金额必须用定点类型）

### Requirement: Computed Fields

系统 SHALL 支持声明派生字段（如金额 = 数量 × 单价），且 MUST 在编译期拒绝循环依赖与悬空引用。

#### Scenario: 声明派生金额

**Given** `SalesOrderLine` 声明 `amount = quantity * unitPrice`
**When** 编译该模板
**Then** 编译 SHALL 通过
**And** 求值结果 SHALL 被其他判据（如审批条件）直接引用

#### Scenario: 循环依赖

**Given** 字段 A 依赖 B，B 又依赖 A
**When** 编译该模板
**Then** 编译 SHALL 失败并指出循环

### Requirement: Enumerated Fields and Cardinality

字段 SHALL 可声明受限取值集合（枚举）；关系 SHALL 可声明基数（一对一/一对多）。
未在集合内的取值 MUST 被拒绝。

#### Scenario: 枚举外取值被拒

**Given** `unit` 声明为枚举 `["piece","set","box"]`
**When** 写入 `unit: "pallet"`
**Then** 写入 SHALL 被拒并列出合法取值

#### Scenario: 一对多关系

**Given** 一个供应商供应多个零件
**When** 声明该关系基数为多
**Then** 编译 SHALL 通过
**And** 一个零件被多个供应商引用 SHALL 成为可能
