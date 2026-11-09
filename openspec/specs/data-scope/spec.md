# data-scope Specification

> **Archive Note（2026-11-09）**：本规格由 `add-generic-data-scope-authorization` 起草。
> 实现与验收已完成（原语、解析器、执行点、RLS、Agent/Plugin 闸、管理/预览 UI、
> 真实 DB e2e），等待归档流程并入 `openspec/specs/`。归档时保留本说明并移除“等待归档”措辞。
>
> 实现落点：`libs/platform-core/src/data-scope/`；契约：`schemas/data-scope.schema.json`；
> 领域表：`DOMAIN.md`「数据范围」；决策：`DECISIONS.md` D-5/D-6。

## Purpose

为多租户平台提供与行业无关的数据范围原语：可配置树维度、节点、成员、资源绑定与数据策略，
在应用层生成行级谓词；范围只收窄，不授予功能权限；RLS 只做租户边界。

## Requirements

### Requirement: Generic Data Scope Primitives

平台 SHALL 提供按组织隔离的数据范围原语：范围域（scope dimension）、范围节点（scope node）、
范围成员（scope membership）、资源绑定（scope binding）、数据策略（data policy）。
平台 schema 与代码标识符 MUST NOT 包含行业专有词（如 school / class / province）；
这些词 MUST 只作为租户配置值或蓝图元数据出现。

#### Scenario: 同一组织内并存区域树与学校树

- **WHEN** 同一租户创建 `region` 与 `class` 两个范围域，并分别建树
- **THEN** 两个维度 SHALL 互不影响
- **AND** 同一资源可以只绑定其中一个维度，也可以同时绑定两个维度

#### Scenario: 跨租户隔离

- **WHEN** A 组织查询 B 组织的维度、节点、成员或策略
- **THEN** 查询 SHALL 返回空或拒绝
- **AND** 数据库 RLS SHALL 作为最后边界拒绝跨租户读写

### Requirement: Scope Tree Integrity

范围节点 SHALL 属于唯一组织与唯一范围域；父节点 MUST 属于同一组织与同一范围域。
树 MUST NOT 成环；节点路径（path）与深度 MUST 在创建、移动、删除时保持一致。

#### Scenario: 拒绝成环

- **WHEN** 把节点 A 的父节点设置为 A 的后代节点
- **THEN** 操作 SHALL 被拒绝并指明成环

#### Scenario: 拒绝跨维度父节点

- **WHEN** 把 `class` 域节点的父节点设置为 `region` 域节点
- **THEN** 操作 SHALL 被拒绝

#### Scenario: 子树查询只返回后代

- **WHEN** 查询“江苏省及以下”节点
- **THEN** 结果 SHALL 包含江苏及其所有后代
- **AND** MUST NOT 包含同级省份或祖先节点

### Requirement: Scope Membership and Positions

范围成员 SHALL 把主体（用户/角色/组）映射到节点，并携带 `positionKey` 与可选有效期。
同一主体 MAY 在多个节点、多个岗位上有成员关系；解析时 MUST 只取当前有效的关系。

#### Scenario: 一人多岗

- **WHEN** 用户 U 同时是“江苏省经理”和“高二3班班主任”
- **THEN** 两条成员关系 SHALL 都参与范围解析
- **AND** 两个岗位各自按自己的维度与深度生效

#### Scenario: 过期成员不生效

- **WHEN** 一条成员关系的 `validTo` 已过去
- **THEN** 该关系 MUST NOT 参与范围解析

#### Scenario: 重复的活跃成员关系

- **WHEN** 同一主体、节点、岗位存在两条都有效的成员关系
- **THEN** 系统 SHALL 拒绝重复创建或按幂等处理
- **AND** 解析结果 MUST NOT 因重复而扩大范围

### Requirement: Resource Binding

资源绑定 SHALL 声明资源键到范围域的映射，支持三种方式：`field`（行上存节点 ID）、
`owner`（行上存主体 ID）、`relation`（通过关联实体/关联表）。
资源键 MUST 带命名空间：`platform:`、`blueprint:<packageId>:` 或 `app:<installationId>:`。

#### Scenario: 字段绑定

- **WHEN** `Student` 声明 `class` 维度绑定到 `classId` 字段
- **THEN** 解析器 SHALL 用 `classId` 生成范围谓词

#### Scenario: 关系绑定

- **WHEN** `Course` 声明通过 `TeachingAssignment(courseId, teacherId)` 绑定 `class` 维度
- **THEN** 解析器 SHALL 用关联实体生成 `EXISTS` 谓词
- **AND** MUST NOT 把关联实体的行当作课程本身返回

#### Scenario: 未知资源键

- **WHEN** 绑定或策略引用未注册的资源键
- **THEN** 编译/装载/保存 SHALL 失败并指明资源键

### Requirement: Scope Algebra

数据策略 SHALL 支持五种范围：`all`、`self`、`nodes`、`node`（`exact`/`subtree`/`ancestors`）、
`relation`。策略 MUST 支持 `allow` 与 `deny`；同一主体/资源/动作的多条 allow SHALL 取并集，
deny SHALL 覆盖 allow；多角色 SHALL 先按角色模板取交集，再跨角色取并集。

#### Scenario: 省经理看本省及以下

- **WHEN** 省经理对 `Customer` 的读策略为 `node(dimension=region, depth=subtree, positions=[province_manager])`
- **THEN** 结果 SHALL 包含其所在省及所有下属市的客户
- **AND** MUST NOT 包含其他省的客户

#### Scenario: 市经理只看本市

- **WHEN** 市经理的策略为 `node(dimension=region, depth=exact)`
- **THEN** 结果 SHALL 只包含其所在市的客户

#### Scenario: deny 覆盖 allow

- **WHEN** 一条 allow 策略覆盖某节点，另一条 deny 策略覆盖该节点下的子节点
- **THEN** 子节点 SHALL 不可见

#### Scenario: 多角色取并集

- **WHEN** 用户同时拥有“省经理”和“审计员”两个角色，两个角色各有 allow 策略
- **THEN** 可见范围 SHALL 为两个角色范围的并集

### Requirement: Scope Resolution Uses Trusted Identity

范围 MUST 从服务端可信身份（认证主体、组织上下文、已存储的成员关系与策略）解析。
请求参数、请求头或请求体中的范围声明（如 `deptIds`、`nodeIds`、`scopeIds`）
MUST NOT 扩大范围；系统 SHALL 忽略或拒绝这类输入。

#### Scenario: 客户端传入范围被忽略

- **WHEN** 请求体附带 `nodeIds` 或 `deptIds`
- **THEN** 服务端 SHALL 按认证身份解析范围
- **AND** MUST NOT 采用客户端传入的节点集合

#### Scenario: 伪造组织头

- **WHEN** 客户端伪造 `X-Organization-Id` 指向非成员组织
- **THEN** 请求 SHALL 被拒绝

### Requirement: Fail-Closed Data Scope

资源声明了 `dataScope` 时，系统 MUST 在以下情况拒绝该行/该请求（`none`）：
没有匹配策略、绑定缺失、解析异常或绑定字段为空；MUST NOT 退化为“全部可见”。
未声明 `dataScope` 的资源 MUST 保持租户隔离与既有权限行为，不受本能力影响。

#### Scenario: 解析异常拒绝

- **WHEN** 策略引用的维度在租户中不存在
- **THEN** 读取 SHALL 返回拒绝或空集合
- **AND** MUST NOT 返回租户内全部数据

#### Scenario: 空绑定字段不可见

- **WHEN** 一条 `Student` 记录的 `classId` 为空
- **THEN** 该记录 MUST NOT 出现在按 `class` 范围过滤的列表中

#### Scenario: 未声明资源保持旧行为

- **WHEN** 某实体没有 `dataScope` 声明
- **THEN** 其读写 SHALL 只受租户隔离与功能权限约束
- **AND** MUST NOT 因本能力被额外收窄

### Requirement: Uniform Enforcement Across Entry Points

声明了 `dataScope` 的资源 MUST 在列表、详情、单条读、创建、更新、删除、状态迁移、导入、
导出、统计、视图、追溯、Agent 工具面与插件能力面上执行同一份范围判定。
写路径 MUST 在落库前校验目标行/目标节点在范围内；越界 MUST 拒绝且 MUST NOT 部分写入。

#### Scenario: 列表与详情一致

- **WHEN** 一条记录不在调用方范围内
- **THEN** 列表 SHALL 不返回该记录
- **AND** 按 ID 读取 SHALL 返回 404 或拒绝

#### Scenario: 越权更新/删除

- **WHEN** 调用方尝试更新或删除范围外的记录
- **THEN** 操作 SHALL 被拒绝
- **AND** 记录 MUST NOT 被修改

#### Scenario: 越权创建

- **WHEN** 调用方创建记录时写入其不可写的节点字段
- **THEN** 创建 SHALL 被拒绝并指明字段

#### Scenario: 导出与统计同样收窄

- **WHEN** 调用方导出或统计声明了 `dataScope` 的资源
- **THEN** 结果 SHALL 与列表使用同一范围
- **AND** MUST NOT 通过导出绕过列表过滤

#### Scenario: Agent 与插件不能绕过

- **WHEN** Agent 工具或插件通过平台能力读取/写入受范围约束的资源
- **THEN** 范围判定 SHALL 同样生效
- **AND** 越界调用 SHALL 被拒绝

### Requirement: Definition and Instance Separation

蓝图包 SHALL 能声明资源绑定与策略模板（定义），租户 SHALL 能配置实际维度、节点、成员与
收窄策略（实例）。租户策略 MUST NOT 扩大蓝图模板声明的范围上限（cap）；
解析时模板与租户策略 SHALL 取交集。

#### Scenario: 租户收窄模板

- **WHEN** 蓝图模板允许某角色看校区子树，租户策略把该角色限制到某个班级
- **THEN** 最终范围 SHALL 为班级

#### Scenario: 租户扩大模板被拒

- **WHEN** 蓝图模板为 `own`，租户策略尝试给同一角色 `all`
- **THEN** 扩大 SHALL 被拒绝或按 `own` 生效
- **AND** MUST NOT 返回超出模板的数据

#### Scenario: 蓝图升级重新解析

- **WHEN** 蓝图包升级并改变策略模板
- **THEN** 解析缓存 SHALL 按新的包摘要失效
- **AND** 旧模板 MUST NOT 继续生效

### Requirement: Effective Scope Preview and Audit

系统 SHALL 提供有效范围预览：给定用户、资源、动作，返回解析出的节点集合与谓词摘要，
MUST NOT 返回业务数据行。维度、节点、成员、策略的变更 MUST 写入审计。

#### Scenario: 预览不泄露数据

- **WHEN** 管理员预览某用户对 `Student` 的读范围
- **THEN** 返回 SHALL 包含节点集合与策略命中原因
- **AND** MUST NOT 包含学生记录本身

#### Scenario: 变更可审计

- **WHEN** 管理员修改成员关系或策略
- **THEN** 审计 SHALL 记录操作者、变更前后值与时间

### Requirement: Scope Cache Versioning

范围解析结果 MAY 缓存，但缓存 MUST 按版本失效。任何维度、节点、成员、策略或绑定变更 MUST 使该组织的范围版本递增；
缓存键 MUST 包含版本，MUST NOT 在版本变化后继续返回旧结果。

#### Scenario: 移除成员立即生效

- **WHEN** 删除某用户的省经理成员关系
- **THEN** 下一次请求 MUST NOT 再返回该省范围的数据
- **AND** MUST NOT 等待缓存 TTL 过期

#### Scenario: 策略变更立即生效

- **WHEN** 停用或修改一条数据策略
- **THEN** 下一次请求 SHALL 使用新策略解析

### Requirement: Backward Compatibility

本能力 MUST NOT 改变未声明 `dataScope` 的实体、旧蓝图包、既有 `ownership` 与
`departments` 表的行为。`ownership` MAY 与 `dataScope` 组合，组合时 SHALL 取交集。

#### Scenario: 旧包行为不变

- **WHEN** 装载一个没有 `dataScope` 的旧蓝图包
- **THEN** 其读写行为 SHALL 与升级前一致
- **AND** `permissions.json` 的 `scope` 仍只作为声明

#### Scenario: ownership 与 dataScope 组合

- **WHEN** 实体同时声明 `ownership` 与 `dataScope`
- **THEN** 记录 MUST 同时满足两者才可见
- **AND** 既有 ownership 对空归属字段的兼容语义 MUST 保持不变
