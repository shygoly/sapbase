# blueprint-delivery Specification

## Purpose
TBD - created by archiving change add-deliverable-blueprint. Update Purpose after archive.
## Requirements
### Requirement: Licensed and Signed Delivery

蓝图包 SHALL 能声明授权范围（可运行的租户、可否再销售、到期时间）并携带签名。
装载器 MUST 在装载前验签并校验授权；任一项不通过 MUST 拒绝装载，
MUST NOT 以"先跑起来"的方式降级。

#### Scenario: 授权范围内的租户

**Given** 一个已签名、`grantedTo` 含当前租户且未过期的包
**When** 装载该包
**Then** 装载 SHALL 成功
**And** 审计 SHALL 记录授权校验结果

#### Scenario: 未授权租户

**Given** 一个 `grantedTo` 不含当前租户的包
**When** 装载该包
**Then** 装载 SHALL 失败并说明该租户不在授权范围内
**And** MUST NOT 产生任何可执行计划

#### Scenario: 包被篡改

**Given** 一个已签名的包
**When** 任一文件或清单被修改（授权字段包含在内）而签名未更新
**Then** 验签 SHALL 失败
**And** 装载 SHALL 被拒

#### Scenario: 授权过期

**Given** 一个 `expiresAt` 已过去的包
**When** 装载该包
**Then** 装载 SHALL 被拒

### Requirement: Explicit Unsigned Exemption

系统 MAY 为开发场景提供未签名豁免，但该豁免 MUST 显式开启、MUST 只豁免授权链
（完整性、编译、防漂移 MUST 仍然生效）、MUST 写审计，且在**生产环境 MUST 被拒绝**
（报错，而不是警告）。

#### Scenario: 开发豁免

**Given** 显式开启未签名豁免且非生产环境
**When** 装载一个未签名的包
**Then** 装载 MAY 成功
**And** SHALL 写入一条明确的审计记录

#### Scenario: 生产下拒绝豁免

**Given** 生产环境
**When** 配置里带有未签名豁免
**Then** 该豁免 SHALL 被拒绝

### Requirement: Complete Business Definition Layers

蓝图包 SHALL 能表达完整的业务定义：语义、流程、规则（校验/审批/记账）、经验策略。
编译器 MUST 逐文件校验，**未覆盖的文件 MUST 被拒绝**（不跳过未知文件），
且规则与经验策略中引用的一切（实体、字段、状态、事件、动作、角色）MUST 在包内可解析。

#### Scenario: 规则引用不存在的字段

**Given** `rules.json` 里一条校验规则引用了 `semantic.json` 中不存在的字段
**When** 编译该包
**Then** 编译 SHALL 失败并指明是哪条规则的哪个引用

#### Scenario: 借贷不平衡

**Given** 一条记账规则，其借贷两侧是**字面量**且不相等
**When** 编译该包
**Then** 编译 SHALL 失败
**And** 明细 SHALL 指出两侧的值（而不是一句"不平衡"）

#### Scenario: 经验策略不得包含布局

**Given** `experience.json` 里出现 `layout` / `width` / `position` 之类的布局字段
**When** 校验该文件
**Then** 校验 SHALL 失败（经验策略只描述"何时需要人介入"，不描述界面长什么样）

#### Scenario: 未覆盖的层文件

**Given** 包内存在 v1 协议未覆盖的文件
**When** 编译该包
**Then** 编译 SHALL 失败
**And** MUST NOT 忽略该文件继续编译

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

### Requirement: Template Upgrade Preserves Existing Data

模板升级（如 1.0.0 → 1.1.0）时，新增字段 MUST 有声明式默认值或明确的迁移路径；
旧数据 MUST 在升级后仍可读（读时按默认值补齐），且 MUST NOT 被隐式改写回库。
升级 MUST NOT 打破既有的非空约束。

#### Scenario: 升级后旧行仍可读

**Given** 已有 1.0.0 写入的旧行，缺失 1.1.0 新增字段
**When** 用 1.1.0 模板读取旧行
**Then** 读取 SHALL 成功，缺失字段按声明的默认值呈现
**And** 存储 SHALL NOT 被自动更新（读不改写）

#### Scenario: 升级后的写入受新约束

**Given** 1.1.0 新增了一个非空字段
**When** 写入一条缺该字段的记录
**Then** 写入 SHALL 被拒绝

### Requirement: Re-Sign After Upgrade

模板内容变更后 MUST 重新编译与**重新签名**：授权绑定 MUST NOT 因升级而被绕过。

#### Scenario: 升级未重签

**Given** 一份已签名的 1.0.0 包被就地改为 1.1.0
**When** 装载该包
**Then** 验签 SHALL 失败
**And** 装载 SHALL 被拒绝

### Requirement: Currency Is Part of the Type

金额字段 MUST 携带货币；**不同货币 MUST NOT 相加**，编译期与运行时都 MUST 判定。

#### Scenario: 跨币种求和被拒

**Given** 一张单的行分别是 CNY 与 USD
**When** 汇总金额
**Then** 汇总 SHALL 被拒并指明币种不一致

### Requirement: Built-in Query Views

平台 SHALL 提供常用查询视图（库存 / 应收 / 在途），其口径 MUST 冻结在协议里，
MUST NOT 要求使用者自行写 SQL 才能看到常用视图。

#### Scenario: 库存视图

**Given** 已写入的零件与库存记录
**When** 查询库存视图
**Then** 结果 SHALL 包含在库、预留、在途与可用量
**And** 口径 SHALL 与协议文本一致（含缺失列的 COALESCE 规则）

### Requirement: UI and Permissions Layers

Blueprint packages MAY contain `ui.json` and `permissions.json`; the platform SHALL validate both files when present.

`ui.json` SHALL declare pages (identifier/type/entity and optional route/fields) and optional
menus. `permissions.json` SHALL declare role → resources → scope/actions.

Both layers MUST be covered by JSON Schema and included in the IR digest. Unknown or
malformed layers MUST fail compilation.

#### Scenario: Compile a package with UI

- **WHEN** a package contains `ui.json` with a page referencing an existing entity
- **THEN** compilation SHALL succeed
- **AND** the IR SHALL contain a `ui` layer digest

#### Scenario: Page references a missing entity

- **WHEN** `ui.json` references an entity not declared in `semantic.json`
- **THEN** compilation SHALL fail with a conflict
- **AND** the conflict SHALL name the page and entity

#### Scenario: Permissions reference a missing resource

- **WHEN** `permissions.json` grants access to an undeclared entity
- **THEN** compilation SHALL fail with a conflict

### Requirement: Runtime Reads Published UI and Permissions

The runtime SHALL expose the loaded package's UI and permissions layers after license and
tenant validation.

#### Scenario: Read UI

- **WHEN** an authorized tenant requests `GET /blueprints/:id/ui`
- **THEN** the response SHALL contain the published pages/menus
- **AND** an unauthorized tenant SHALL be rejected

#### Scenario: Layer absent

- **WHEN** a package has no `ui.json`
- **THEN** the endpoint SHALL return 404

### Requirement: Generic Blueprint UI Consumer

The system SHALL provide a runtime consumer that loads a published package's `ui.json`,
compiled entities and `permissions.json` and renders pages without generating static routes.

The consumer SHALL support `list`, `form`, and `detail` page types using the existing
`ui-runtime` components, and SHALL filter pages by the permission layer.

#### Scenario: Open a published app

- **WHEN** an authorized user opens `/dashboard/apps/<packageId>`
- **THEN** the first accessible page SHALL render
- **AND** list pages SHALL load records through the existing blueprint records API

#### Scenario: No accessible page

- **WHEN** the actor matches no page resource in `permissions.json`
- **THEN** the consumer SHALL show an explicit empty state
- **AND** MUST NOT render an unauthorized page

#### Scenario: Package without UI layer

- **WHEN** the package has no `ui.json`
- **THEN** the consumer SHALL show an explicit missing-layer message

### Requirement: Compiled Runtime Artifact

`compileBlueprint` MUST be able to produce an immutable runtime artifact
(`CompiledBlueprint`) that contains the semantic entities, validation/approval/accounting
rules and the query index plan, in addition to the existing IR.

`loadBlueprint` MUST only return a loaded blueprint after the artifact is built successfully.
The runtime MUST read the compiled artifact instead of re-parsing `semantic.json` /
`rules.json` on every request.

#### Scenario: Load returns compiled template

- **WHEN** a valid `.erpkg` is loaded
- **THEN** `loaded.compiled.template.entities` SHALL contain the package entities
- **AND** `loaded.compiled.template.validation` SHALL contain the validation rules
- **AND** `loaded.compiled.indexPlan` SHALL list declared index candidates

#### Scenario: Invalid package does not produce an artifact

- **WHEN** compilation fails
- **THEN** no `CompiledBlueprint` SHALL be cached or returned

### Requirement: Bounded Runtime Cache

`BlueprintService` MUST cache loaded blueprints by `packageId + tenantId` and MUST invalidate
an entry when the package file fingerprint changes, the license expires, the TTL expires,
or `invalidate()` is called explicitly.

A cache hit MUST NOT unpack, compile or re-verify the package signature.

#### Scenario: Second load is a cache hit

- **GIVEN** a successfully loaded package
- **WHEN** the same package id and tenant is loaded again within TTL
- **THEN** the loader SHALL return the cached `LoadedBlueprint` instance
- **AND** MUST NOT invoke the compiler again

#### Scenario: Deliver invalidates the package cache

- **GIVEN** a cached package
- **WHEN** `deliver()` overwrites the same package id
- **THEN** the cache entry SHALL be removed

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

