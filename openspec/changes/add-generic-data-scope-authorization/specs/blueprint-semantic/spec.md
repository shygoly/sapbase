## ADDED Requirements

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
