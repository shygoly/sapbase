# blueprint-semantic Specification

## Purpose
TBD - created by archiving change add-complete-autoparts-erp. Update Purpose after archive.
## Requirements
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

### Requirement: Declarative Field Defaults

字段 SHALL 可声明默认值；默认值 MUST 只影响**读取与升级路径**，
MUST NOT 在读取时改写存储（读不改写），MUST NOT 让非空约束被绕过。

#### Scenario: 缺字段的旧行按默认值呈现

**Given** 字段 `currency` 声明默认值 `CNY`，而某条旧行没有该字段
**When** 读取该行
**Then** 返回的 `currency` SHALL 为 `CNY`
**And** 存储中的该行 SHALL 保持原样（未被写回）

#### Scenario: 默认值类型与字段类型不符被拒

**Given** 数值字段声明默认值 `"abc"`
**When** 校验该模板
**Then** 校验 SHALL 失败并指明字段与类型

### Requirement: Declarative Rollups

头实体的汇总字段 SHALL 可声明为对其行实体的聚合（如 `totalAmount = sum(lines.amount)`）；
该依赖 MUST 被显式声明与校验，MUST NOT 退化成模板作者之间的隐性约定。

#### Scenario: 声明汇总字段

**Given** 订单头声明 `totalAmount` 为行金额之和
**When** 编译该模板
**Then** 编译 SHALL 通过，且该字段的依赖（行实体与其金额字段）SHALL 被记录
**And** 依赖不存在或成环时 SHALL 编译失败

### Requirement: Page and Permission Declarations

The semantic authoring layer MAY declare pages and permissions; `definitionToBlueprint` SHALL
MUST map non-empty pages to `ui.json` and non-empty permission rules to
`permissions.json`.

Empty or absent declarations MUST NOT create empty layers.

#### Scenario: Pages map to UI layer

- **WHEN** the definition contains pages for `Ticket`
- **THEN** `ui.json` SHALL contain those pages
- **AND** `irDigest` SHALL change when a page changes

#### Scenario: Empty pages

- **WHEN** the definition contains `pages: []`
- **THEN** no `ui.json` SHALL be written

### Requirement: Patch Support for UI and Permissions

Server-side patches SHALL support `page`, `permission`, and `menu` scopes with
add/update/remove operations. Unsupported payloads MUST fail explicitly.

#### Scenario: Add page

- **WHEN** a `page/add` patch provides `payload.page`
- **THEN** the definition SHALL contain the page
- **AND** the next compile SHALL include it in `ui.json`

#### Scenario: Add permission rule

- **WHEN** a `permission/add` patch provides `payload.permission`
- **THEN** the rule SHALL be persisted and published

#### Scenario: Add menu without pages

- **WHEN** a `menu/add` patch is applied to a definition with no pages
- **THEN** it SHALL fail because `ui.json` requires a non-empty page list

### Requirement: Explicit Query Index Declaration

The semantic layer MAY declare `indexed: boolean` on a field; the compiler SHALL treat `indexed` only as a
query index candidate; it MUST NOT change validation, uniqueness or storage semantics.

#### Scenario: indexed is optional

- **GIVEN** a field without `indexed`
- **WHEN** the package is compiled
- **THEN** compilation SHALL succeed
- **AND** no query index SHALL be planned for that field

#### Scenario: indexed remains orthogonal to unique

- **GIVEN** a field with `unique: true` and `indexed: true`
- **WHEN** indexes are applied
- **THEN** the unique index SHALL still be created
- **AND** the query index plan SHALL remain independent

### Requirement: Declarative Data Scope Metadata

蓝图语义层 SHALL 允许实体声明可选 `dataScope`，包含 `ownerField` 与 `bindings`。
每个 binding MUST 声明 `dimension` 与 `kind`（`field` / `owner` / `relation`），
并携带对应字段或关联实体信息。平台 MUST NOT 在语义层硬编码行业维度名。

#### Scenario: 字段绑定

- **WHEN** `Student` 声明 `dataScope.bindings = [{ dimension: "class", kind: "field", field: "classId" }]`
- **AND** `classId` 是已声明的 text 字段
- **THEN** 编译 SHALL 通过
- **AND** 运行时 SHALL 能用 `classId` 解析班级范围

#### Scenario: 关系绑定

- **WHEN** `Course` 声明 `kind: "relation"`，关联实体为 `TeachingAssignment`，
  `fromField: "courseId"`、`actorField: "teacherId"`
- **THEN** 编译 SHALL 通过
- **AND** 关联实体与字段 MUST 存在于同一蓝图

#### Scenario: 绑定字段不存在

- **WHEN** `dataScope` 引用 `semantic.json` 中不存在的字段
- **THEN** 编译 SHALL 失败并指明实体与字段

#### Scenario: ownerField 类型不合法

- **WHEN** `ownerField` 指向非 text 字段或指向不存在的字段
- **THEN** 编译 SHALL 失败并指明原因

#### Scenario: 未知 binding kind

- **WHEN** binding 声明了 `kind: "expression"` 等未支持的值
- **THEN** 编译 SHALL 失败
- **AND** MUST NOT 忽略未知 kind 继续编译

### Requirement: Data Scope Metadata Is Optional

`dataScope` MUST 是可选层。未声明该层的实体 MUST 保持既有语义与运行时行为，
MUST NOT 被默认收窄或默认放开。

#### Scenario: 未声明 dataScope

- **WHEN** 实体没有 `dataScope` 声明
- **THEN** 编译 SHALL 通过
- **AND** 运行时行为 SHALL 与升级前一致

### Requirement: Tree Metadata

蓝图语义层 SHALL 允许实体声明可选 `tree: { parentField, orderField }`。
`parentField` MUST 指向同实体的引用/text 字段，可为空表示根；
`orderField` MUST 是数值字段。编译器 MUST 校验字段存在、类型与自引用；
MUST NOT 把未知字段当作树元数据。

#### Scenario: 声明章节树

- **WHEN** `Chapter` 声明 `parentId`/`sortOrder`
- **THEN** 编译 SHALL 通过
- **AND** 树约束 SHALL 进入运行时校验

#### Scenario: parentField 不存在

- **WHEN** `tree.parentField` 指向未声明字段
- **THEN** 编译 SHALL 失败并指明字段
- **AND** MUST NOT 忽略

#### Scenario: orderField 类型错误

- **WHEN** `orderField` 指向非数值字段
- **THEN** 编译 SHALL 失败并指明类型

#### Scenario: 未声明 tree

- **WHEN** 实体没有 `tree` 元数据
- **THEN** 编译/运行行为 SHALL 与升级前一致

