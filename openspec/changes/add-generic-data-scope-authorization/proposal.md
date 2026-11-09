# Change: 通用数据范围授权（组织树 + 关系）

## Why

当前 sapbase 的数据边界只有三样东西：租户隔离（`organizationId` + RLS）、功能权限点、
蓝图实体的单据归属（`ownership`）。没有“组织架构层级 / 关系”的数据范围模型：

- `departments` 是扁平表（无 `parentId`、无 `path`），部门不参与任何查询过滤；
- `roles` 只有 `permissions: string[]`，没有数据范围；
- `permissions.json` 的 `scope: own|team|all` 只是声明，`team` 明确未做物理过滤；
- 大区/省/市、校区/年级/班级/班主任这类场景无法只靠配置实现。

如果直接给 `departments` 加树、给 `roles` 加 `dataScope`，平台就会被“一种组织树”写死，
学校/区域/其他垂直行业仍要改代码。本变更把数据范围做成**平台原语**，行业词汇全部下沉为
租户配置和蓝图元数据。

## What Changes

- **ADDED** 平台能力 `data-scope`：五个通用原语
  - 范围域 `scope_dimensions`（一棵可配置的树：`region` / `campus` / `class` …）
  - 范围节点 `scope_nodes`（`parentId` + `path`，任意深度、多根）
  - 范围成员 `scope_memberships`（主体 → 节点 + `positionKey`，支持多岗、有效期）
  - 资源绑定 `scope_bindings`（资源 → 维度 → 字段 / 归属 / 关联）
  - 数据策略 `data_policies`（主体 + 资源 + 动作 + 范围 + allow/deny）
- **ADDED** 范围代数：`all | self | nodes | node(exact/subtree/ancestors) | relation`；
  allow 并集、可选 deny 覆盖；多角色按并集，蓝图模板与租户策略按交集（租户只能收窄）。
- **ADDED** 范围解析器 `ScopeResolver`：从可信身份 + 成员关系解析出 `ScopeExpr` AST，
  由适配器编译为 TypeORM / JSONB / 原生 SQL 谓词；缓存按 `scopeVersion` 失效。
- **ADDED** 统一执行点：列表、详情、写、删、迁移、导入、导出、视图、追溯、统计、
  Agent 工具面、插件 capability broker 全部走同一份范围判定。
- **ADDED** 定义/实例分离：
  - 蓝图包（签名、可分发）声明资源绑定与策略模板；
  - 租户运行时配置实际节点、成员、策略；
  - 租户不得扩大蓝图模板声明的范围上限（cap）。
- **ADDED** 资源键命名空间：`platform:<table>` / `blueprint:<packageId>:<Entity>` /
  `app:<installationId>:<Entity>`，编译/装载期校验，避免跨应用撞名。
- **ADDED** 管理面：维度/节点/成员/策略 CRUD、有效范围预览、审计。
- **MODIFIED** 语义运行时：声明了 `dataScope` 的实体在全部读写路径执行范围谓词；
  现有 `ownership` 保留原语义并可与范围组合（AND）。
- **MODIFIED** 蓝图语义：实体可声明 `dataScope`（`ownerField` + `bindings`），编译期校验。
- **MODIFIED** 蓝图交付：`permissions.json` 增加 `scope: "policy"` + `dataScope` 模板；
  旧包的 `own|team|all` 行为不变。
- **NOT CHANGED** 租户隔离、功能权限点、既有 `ownership`、`departments` 表结构。
- **NON-GOALS** 自由表达式/ABAC 引擎、跨租户层级、把行级范围写进 RLS、
  可视化拖拽编排、按应用市场分发策略。
- **BREAKING** 无。声明 `dataScope` 才启用；未声明的资源保持租户隔离 + 现有权限行为。

## Impact

- 受影响规格：`data-scope`（新）、`semantic-runtime`、`blueprint-semantic`、`blueprint-delivery`
- 受影响代码：
  - `libs/platform-core/src/data-scope/**`（原语、解析器、适配器、缓存）
  - `apps/api/src/data-scope/**`（管理 API；或并入 platform-core controller）
  - `apps/api/src/semantic-runtime/**`（列表/详情/写入/迁移/导入/视图/追溯执行）
  - `libs/platform-release/src/blueprint/{compiler,compiled-model}.ts`
  - `schemas/blueprint-semantic.schema.json`、`schemas/blueprint-permissions.schema.json`
  - `libs/shared-schemas`、`libs/api-client`
  - `DOMAIN.md`、`DECISIONS.md`、`docs/META_LANGUAGE.md`
- 迁移：只新增表；不迁移既有数据；`departments` 保留，通过适配器可选接入。
- 兼容性：无 `dataScope` 声明的包/实体行为不变；`ownership` 继续生效。
- 安全边界：数据范围只做**收窄**，不授予功能权限；最终可见集合 =
  租户隔离 ∩ 功能权限 ∩ 数据范围。数据范围解析失败一律拒绝（fail-closed）。
