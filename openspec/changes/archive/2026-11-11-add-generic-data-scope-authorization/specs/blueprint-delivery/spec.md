## ADDED Requirements

### Requirement: Data Scope Policy Templates in Permissions Layer

`permissions.json` 的规则 SHALL 允许在既有 `scope: own|team|all` 之外新增
`scope: "policy"` 与可选 `dataScope` 模板。`dataScope` MUST 声明维度与深度
（`exact` / `subtree` / `ancestors`），并可声明岗位过滤或关联关系。

- `own` → 单据归属（`self`）
- `team` → 调用方在该维度成员关系上的精确节点
- `all` → 租户内全部
- `policy` → 按 `dataScope` 模板解析

模板 MUST 参与权限层的 canonical digest 与 IR digest；修改模板 MUST 要求重新编译/签名。
租户运行时策略 MUST NOT 扩大模板范围；解析时 MUST 取交集。

#### Scenario: 编译子树策略模板

- **WHEN** 规则声明 `scope: "policy"`、`dataScope: { dimension: "campus", depth: "subtree", positions: ["principal"] }`
- **AND** 实体声明了 `campus` 维度绑定
- **THEN** 编译 SHALL 通过
- **AND** 模板 SHALL 进入权限层摘要

#### Scenario: policy 缺少 dataScope

- **WHEN** 规则声明 `scope: "policy"` 但没有 `dataScope`
- **THEN** 编译 SHALL 失败并指明规则

#### Scenario: own 缺少归属字段

- **WHEN** 规则声明 `scope: "own"`，但实体既没有 `ownership` 也没有 `dataScope.ownerField`
- **THEN** 编译 SHALL 失败
- **AND** MUST NOT 退化为 `all`

#### Scenario: team 缺少维度绑定

- **WHEN** 规则声明 `scope: "team"`，但实体没有可用的维度绑定
- **THEN** 编译 SHALL 失败并指明实体

#### Scenario: 租户不能放大模板

- **WHEN** 蓝图模板为 `own`，租户策略尝试给同一角色 `all`
- **THEN** 运行时 SHALL 按模板 `own` 生效或拒绝该策略
- **AND** MUST NOT 返回模板范围外的数据

#### Scenario: 旧包行为不变

- **WHEN** 旧包只有 `scope: own|team|all` 且实体没有 `dataScope`
- **THEN** 其权限层行为 SHALL 与升级前一致
- **AND** `scope` 仍只作为声明，不启用层级过滤
