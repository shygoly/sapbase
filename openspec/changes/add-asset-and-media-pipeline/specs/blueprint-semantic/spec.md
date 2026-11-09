## ADDED Requirements

### Requirement: Asset Field Type

蓝图语义层 SHALL 支持 `asset` 字段类型（可选 `assetKind` 约束）。
资产字段 MUST 存储 `assetId` 而非 URL，运行时解析为受权限约束的资产摘要/签名 URL。
编译器 MUST 校验 `assetKind` 合法、字段类型不滥用；运行时 MUST 校验资产归属、
状态与类型。

#### Scenario: 声明课程封面

- **WHEN** `Course` 声明 `cover: { type: "asset", assetKind: "image" }`
- **THEN** 编译 SHALL 通过
- **AND** 写入时只接受当前组织、`ready` 的图片资产

#### Scenario: 跨组织资产

- **WHEN** 写入的 `assetId` 属于其他组织
- **THEN** 写入 SHALL 被拒绝
- **AND** MUST NOT 返回该资产内容

#### Scenario: 未就绪资产

- **WHEN** 写入引用 `scanning`/`failed`/`quarantined` 资产
- **THEN** 写入 SHALL 被拒绝并指明状态

#### Scenario: 旧文本 URL 字段

- **WHEN** 实体仍使用 text 字段存 URL
- **THEN** 编译与运行时行为 SHALL 保持不变
