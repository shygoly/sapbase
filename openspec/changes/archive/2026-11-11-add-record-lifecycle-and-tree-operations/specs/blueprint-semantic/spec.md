## ADDED Requirements

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
