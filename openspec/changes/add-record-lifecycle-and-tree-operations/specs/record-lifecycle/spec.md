## ADDED Requirements

### Requirement: Tree Metadata and Integrity

实体 MAY 声明 `tree: { parentField, orderField }`。编译器 MUST 校验字段存在、类型与自引用；
运行时 MUST 校验父节点同组织/同蓝图、不能成环、不能跨树。
未声明 `tree` 的实体 MUST 保持原行为。

#### Scenario: 声明章节树

- **WHEN** `Chapter` 声明 `parentId` 与 `sortOrder`
- **THEN** 编译 SHALL 通过
- **AND** 运行时 SHALL 拒绝成环/跨树父节点

#### Scenario: 成环移动

- **WHEN** 把节点移动到自身或后代下
- **THEN** 操作 SHALL 被拒绝
- **AND** 树结构 MUST NOT 改变

### Requirement: Clone and Copy

系统 SHALL 支持深层克隆记录及子树；克隆 MUST 生成新 ID、重映射内部引用，
并按策略处理唯一字段（fail/suffix/placeholder）。克隆 MUST 在事务中完成，
失败 MUST 全部回滚；重复请求 MUST 幂等。

#### Scenario: 克隆课程树

- **WHEN** 用户克隆一门含章节/知识点的课程
- **THEN** 新课程/章节/知识点 SHALL 使用新 ID
- **AND** 内部引用 SHALL 指向克隆后的节点
- **AND** 原课程 MUST NOT 改变

#### Scenario: 唯一字段冲突

- **WHEN** 克隆的唯一字段与原记录冲突且策略为 fail
- **THEN** 克隆 SHALL 失败并指明字段
- **AND** MUST NOT 产生部分克隆

### Requirement: Move and Reorder

系统 SHALL 支持跨父节点移动与同级排序；移动 MUST 校验目标同组织/同树、防环，
MUST 使用事务/乐观锁避免并发破坏。MUST 记录前后父节点与序号。

#### Scenario: 跨章节移动知识点

- **WHEN** 用户把知识点从章 A 移到章 B
- **THEN** 父节点与序号 SHALL 更新
- **AND** 两个章节的顺序 SHALL 保持一致

#### Scenario: 并发移动

- **WHEN** 两个请求同时移动同一节点
- **THEN** 至多一个成功
- **AND** 另一个 SHALL 冲突/重试，不得产生双父

### Requirement: Archive and Restore

系统 SHALL 支持软归档与恢复；归档 MUST 从活跃列表隐藏、保留历史与审计，
MUST NOT 物理删除。恢复 MUST 校验父节点/唯一键冲突。

#### Scenario: 归档课程

- **WHEN** 用户归档一门课程
- **THEN** 课程 SHALL 从活跃列表隐藏
- **AND** 历史/数据 MUST 保留

#### Scenario: 恢复冲突

- **WHEN** 恢复时父节点已归档或唯一键冲突
- **THEN** 恢复 SHALL 失败并指明原因
- **AND** 记录 MUST NOT 被静默覆盖

### Requirement: Version Snapshot and Diff

系统 SHALL 支持记录快照、发布版本、字段级 diff 与从旧版本恢复。
恢复 MUST 创建新版本，MUST NOT 覆盖/删除历史版本；快照 MUST 记录 data/state/操作者/原因。

#### Scenario: 发布版本

- **WHEN** 用户发布当前内容为 `v1.2`
- **THEN** 快照 SHALL 保存 data/state/label
- **AND** 历史版本 SHALL 可查

#### Scenario: 从旧版本恢复

- **WHEN** 用户从 `v1.1` 恢复
- **THEN** 系统 SHALL 创建新版本（如 `v1.3`）
- **AND** `v1.1`/`v1.2` MUST 保留

### Requirement: Permissions and Data Scope

克隆/移动/归档/快照 MUST 校验源读、目标写与数据范围；目标节点不在可写范围 MUST 拒绝。
操作 MUST 写审计（源、目标、策略、操作者）。

#### Scenario: 跨范围克隆

- **WHEN** 用户克隆到无写权限的班级/院系
- **THEN** 操作 SHALL 返回 403
- **AND** MUST NOT 创建记录

### Requirement: Async Large Operations

大克隆/批量移动/归档 SHALL 通过异步任务执行，提供进度、取消、重试与错误报告。
小操作 MAY 同步；阈值 MUST 可配置。

#### Scenario: 大课程树克隆

- **WHEN** 克隆包含上千节点的课程树
- **THEN** 系统 SHALL 异步执行并显示进度
- **AND** 客户端 SHALL 能取消/重试

### Requirement: Backward Compatibility

本能力 MUST NOT 改变未声明 `tree` 的实体、头行 `children/parent`、既有 CRUD/状态迁移。
旧记录 MUST 不需要迁移；快照表为新增。

#### Scenario: 未声明 tree

- **WHEN** 实体没有 `tree` 元数据
- **THEN** 旧 CRUD/迁移行为 SHALL 不变
- **AND** MUST NOT 强制新操作

#### Scenario: 头行结构

- **WHEN** 写入头行记录
- **THEN** 既有 `children/parent` 校验 SHALL 保持不变
