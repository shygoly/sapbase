# Design: 通用数据范围授权

## Context

已核对的现状：

- `TenantAwareEntity` 给业务表加 `organizationId`；`TenantTransactionInterceptor` 在事务内设置
  组织/应用/用户上下文，PostgreSQL RLS 是最后拒绝边界（`libs/platform-core/src/common/rls/`）。
- `roles` 按组织隔离，`Role.permissions` 是权限点数组；用户权限 = 角色权限 ∪ 直授
  （`libs/platform-core/src/roles/effective-permissions.service.ts`）。
- `departments` 只有 `name / description / managerId / status / organizationId`，
  没有 `parentId`、没有 `path`；`users.departmentId` 只是归属标签，不参与数据过滤。
- 蓝图语义运行时已有：字段级读/写权限、单据级 `ownership`（列表默认 `owner = 当前用户`，
  持 `readAllPermission` 看全部）；`ownership` 只作用于列表读。
- `permissions.json` 有 `role → resource → scope: own|team|all`，但服务端
  `canAccessBlueprintResource` 只判 `role + resource + action`，`scope` 被忽略；
  `add-blueprint-ui-runtime-consumer/design.md` 明确 `team` 不做物理过滤。
- `docs/protocols/blueprint-delivery.md` §14.3 把“数据范围”定义为租户隔离，
  部门/仓库级明确不做，理由是“需要可信的用户属性模型；从请求参数取范围 = 让调用方自己授权”。

本变更补齐的正是那个“可信的用户属性模型”：主体、节点、岗位、绑定、策略都由平台存储，
范围永远从服务端身份解析，不接受客户端声明。

## Goals / Non-Goals

**Goals**

1. 一套平台原语同时表达区域层级（大区→省→市）和学校层级（校区→年级→班级），
   平台代码不出现行业词。
2. 范围声明式、可配置、可审计；AI 生成的蓝图也能携带绑定与策略模板。
3. 所有读写/导出/统计/Agent/插件路径共用同一份判定，fail-closed。
4. 与现有租户隔离、功能权限、`ownership` 兼容；未声明 `dataScope` 的资源行为不变。
5. 定义与实例分离：蓝图声明上限，租户在实例侧只能收窄。

**Non-Goals**

- 不做自由表达式 / ABAC 引擎（v1 固定五种 scope kind）。
- 不做跨租户层级（`organizations` 仍是租户边界，不建父子组织）。
- 不把行级范围写进 RLS（RLS 只做 `organizationId` 边界）。
- 不做可视化拖拽编排、策略市场、按应用分发策略。
- 不迁移 `departments` 到 `scope_nodes`（保留 + 适配器）。
- 不做多跳关系图（v1 只支持单跳关联实体/关联表）。

## Decisions

### D1：通用原语，而不是扩展 `departments`

新增 `scope_*` / `data_policies`，不修改 `departments` 的表结构。理由：

- 给 `departments` 加 `parentId` 只能表达“一种树”，学校/区域/课程维度仍要改代码；
- `departments` 的语义是 HR/组织展示，不应被数据权限绑死；
- 需要时用一个 `department` 维度适配器接入，迁移留给后续变更。

### D2：定义与实例分离

```text
蓝图包（签名、可分发）                 租户运行时（可配置）
  permissions.json                      scope_dimensions
  ├─ scope: own|team|all|policy         scope_nodes
  ├─ dataScope 模板                     scope_memberships
  └─ 编译期校验                          data_policies（租户侧收窄/例外）
  semantic.json entity.dataScope
  ├─ ownerField
  └─ bindings[]（dimension + field/relation）
```

- 蓝图声明“授权形状”与上限（cap），随包签名、版本化。
- 租户配置“授权实例”：实际树、成员、岗位，以及收窄策略。
- 租户策略不得扩大蓝图模板；解析时取交集。这样同一个学校蓝图可以装到不同学校，
  同一套区域蓝图可以装到不同经销商体系，平台不改代码。
- **单一真源**：`blueprint:*` 资源的绑定与策略模板以已装载的签名包为准，不落
  `scope_bindings` / `data_policies`；`scope_bindings` 只存 `platform:*` / `app:*`
  资源的绑定，`data_policies` 只存租户侧策略/例外。避免“包改了、库里的副本没改”的漂移。

### D3：范围只做收窄，不授予功能权限

最终可见集合 = **租户隔离 ∩ 功能权限 ∩ 数据范围**。数据范围永远不能把一个用户
本来没有的功能权限变成有。即使策略是 `all`，也只是“该用户本来能访问的资源里的全部行”。

### D4：五种范围 kind，不做自由表达式

```ts
type ScopeSpec =
  | { kind: 'all' }
  | { kind: 'self'; field: string }
  | { kind: 'nodes'; dimension: string; nodeIds: string[] }
  | { kind: 'node'; dimension: string; anchor: 'membership';
      positions?: string[]; depth: 'exact' | 'subtree' | 'ancestors' }
  | { kind: 'relation'; relation: RelationSpec }
```

- 覆盖“本人 / 精确节点 / 子树 / 祖先 / 关系”五类最常见需求；
- 固定代数可测试、可解释、可编译成 SQL；
- 需要更复杂语义时，优先用多个策略组合，而不是引入表达式语言。

### D5：策略组合 = allow 并集 + deny 覆盖，模板与租户取交集

- 同一主体/资源/动作的多条 allow 策略：OR；
- deny 策略：最终 AND NOT(deny)；
- 多角色：每个角色的策略先与其模板 cap 求交，再跨角色求并；
- 租户策略：与蓝图模板求交（只能更窄）；
- 没有匹配策略且资源声明了 `dataScope`：`none`（fail-closed）。

### D6：范围解析服务端化，绝不接受客户端范围

输入只有可信身份（`userId`、`organizationId`、`roleKeys`、`permissions`）+ 服务端存储的
成员/策略。客户端传的 `deptIds` / `scopeIds` / `nodeIds` 一律忽略或拒绝；
伪造的 `X-Organization-Id` 仍由 `TenantGuard` 校验成员关系。

### D7：AST 而不是 SQL 字符串

解析器输出 `ScopeExpr` AST：

```ts
type ScopeExpr =
  | { op: 'all' }
  | { op: 'none' }
  | { op: 'eq'; field: FieldRef; value: unknown }
  | { op: 'in'; field: FieldRef; values: unknown[] }
  | { op: 'exists'; source: SourceRef; where: ScopeExpr }
  | { op: 'and' | 'or'; args: ScopeExpr[] }
  | { op: 'not'; arg: ScopeExpr }
```

`FieldRef` 支持：

- `{ kind: 'column', table, column }`：平台表；
- `{ kind: 'jsonb', table, column, path }`：蓝图记录 `data->>'classId'`；
- 适配器负责占位符与参数绑定，避免拼接注入。

### D8：关系走现有实体/关联表，不建通用图

- 蓝图：关联实体（如 `TeachingAssignment`）本身就是 `blueprint_records` 里的实体，
  用 `EXISTS (SELECT 1 FROM blueprint_records ta WHERE ta.entity='TeachingAssignment'
  AND ta.data->>'courseId' = row.id AND ta.data->>'teacherId' = $actor)` 解析；
- 平台表：`scope_bindings.relation` 声明关联表/列，适配器编译 JOIN/EXISTS；
- v1 只支持单跳；多跳作为后续扩展，不提前抽象。

### D9：树用物化路径，深树再上闭包表

`scope_nodes.path` 存物化路径（如 `/root/region-east/province-js`），
子树查询用 `path = $1 OR path LIKE $1 || '/%'`，配 `text_pattern_ops` 索引。
节点规模超过约 1 万/租户或出现明显性能问题时，再引入闭包表；v1 不预建。

### D10：缓存按 `scopeVersion` 失效

- `scope_versions(organizationId, version)` 单调递增；
- 维度/节点/成员/策略/绑定变更时 bump；
- 缓存 key 含 `organizationId + scopeVersion + userId + resourceKey + action + packageDigest`；
- 多实例用 Redis，单机/测试用内存实现；
- 版本变化后旧缓存自然不可命中，不依赖 TTL 兜底。

### D11：声明即执行，不静默关闭

实体声明了 `dataScope` 就执行，不提供“静默 off”开关。迁移期若需要观察，
可以后续加显式 `shadow` 模式（记录将被拒绝的请求但不拦截），但必须审计、有到期时间；
v1 不做，避免“以为开了其实没开”。

### D12：失败方向

- 资源声明了 `dataScope`，但解析器异常 / 绑定缺失 / 策略缺失 → `none`（拒绝）；
- 绑定字段为 `null` 的行 → `none`（不可见）。这是与 `ownership` 的关键差异：
  旧 `ownership` 对空归属字段保持“所有人可见”以兼容历史数据；新 `dataScope`
  选择 fail-closed，租户启用前必须做空值预检（见 Migration Plan）。
- 未声明 `dataScope` 的资源 → 只走租户隔离，保持旧行为。

### D13：多应用/多蓝图命名空间

资源键必须带命名空间：

- `platform:<table>`，如 `platform:crm_customers`；
- `blueprint:<packageId>:<Entity>`，如 `blueprint:pkg_school:Student`；
- `app:<installationId>:<Entity>`，用于应用私有数据。

绑定与策略按命名空间匹配，A 应用的策略不影响 B 应用；跨应用读取只能走显式发布的数据能力，
并在该能力边界上再次应用范围。

### D14：`ownership` 与 `dataScope` 组合，不替换

- 既有 `ownership` 保持原语义（含“空归属对所有可见”的兼容裁决）；
- `dataScope` 是新增的 AND 条件；
- 新实体可以只用 `dataScope.self` 表达“只看自己的单”，语义是 fail-closed；
- 迁移时可按实体逐个切换，不强制一次性改。

### D15：管理面与预览

- `/scope-dimensions`、`/scope-nodes`、`/scope-memberships`、`/data-policies` CRUD；
- `POST /data-policies/preview`：给定 `userId + resourceKey + action`，返回解析出的节点集合
  与谓词摘要，不返回业务行；
- 所有变更写 `audit_logs`（actor、before/after、原因）；
- 管理权限点：`data-scope:read` / `data-scope:manage`。

## Data Model

```sql
scope_dimensions (
  id uuid pk,
  "organizationId" uuid not null,
  key varchar(64) not null,          -- region / campus / class / course_group
  name varchar(255) not null,
  description text,
  config jsonb not null default '{}',
  status varchar(32) not null default 'active',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("organizationId", key)
)

scope_nodes (
  id uuid pk,
  "organizationId" uuid not null,
  "dimensionId" uuid not null,
  "parentId" uuid null,
  path text not null,                -- /<id>/<id>/...
  depth int not null,
  name varchar(255) not null,
  code varchar(128),
  metadata jsonb not null default '{}',
  status varchar(32) not null default 'active',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("organizationId", "dimensionId", path)
)
-- index ("organizationId", "dimensionId", path text_pattern_ops)
-- index ("organizationId", "dimensionId", "parentId")

scope_memberships (
  id uuid pk,
  "organizationId" uuid not null,
  "subjectType" varchar(16) not null, -- user | role | group
  "subjectId" uuid not null,
  "nodeId" uuid not null,
  "positionKey" varchar(64) not null, -- province_manager / head_teacher / principal
  "validFrom" timestamptz null,
  "validTo" timestamptz null,
  metadata jsonb not null default '{}',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
)
-- index ("organizationId", "subjectType", "subjectId")
-- index ("organizationId", "nodeId", "positionKey")

scope_bindings (
  id uuid pk,
  "organizationId" uuid not null,
  "resourceKey" varchar(255) not null, -- 仅 platform:* / app:*；blueprint:* 以包内声明为准
  "dimensionKey" varchar(64) not null,
  kind varchar(16) not null,         -- field | owner | relation
  field varchar(128) null,
  relation jsonb null,               -- { entity/table, fromField, actorField }
  writable boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("organizationId", "resourceKey", "dimensionKey", kind)
)

data_policies (
  id uuid pk,
  "organizationId" uuid not null,
  name varchar(255) not null,
  subject jsonb not null,            -- { kind: user|role|group|position, ... }
  "resourceKey" varchar(255) not null, -- 租户策略；蓝图模板不落库，从已装载包解析
  actions text[] not null,           -- read|list|create|update|delete|export|transition...
  effect varchar(8) not null default 'allow',
  scope jsonb not null,
  priority int not null default 0,
  status varchar(32) not null default 'active',
  version int not null default 1,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
)
-- index ("organizationId", "resourceKey", status)

scope_versions (
  "organizationId" uuid pk,
  version bigint not null default 1,
  "updatedAt" timestamptz not null default now()
)
```

所有 `scope_*` / `data_policies` 表都带 `organizationId` 并纳入 RLS（DIRECT_TABLES）。

## Resolution Algorithm

```ts
async function resolve(input: ResolveInput): Promise<ScopeExpr> {
  const declared = await dataScope.isDeclared(input.resourceKey) // 包内 dataScope 或平台绑定
  if (!declared) return { op: 'all' } // 未声明：保持租户隔离

  const bindings = await bindings.forResource(input.resourceKey)
  if (bindings.length === 0) return { op: 'none' } // 声明了但绑定缺失：fail-closed

  const policies = await policies.match({
    organizationId: input.organizationId,
    actor: input.actor,
    resourceKey: input.resourceKey,
    action: input.action,
    at: now(),
    packageTemplates: input.packageDigest ? blueprintTemplates(input) : [],
  })
  if (policies.length === 0) return { op: 'none' } // fail-closed

  const allows = policies.filter(p => p.effect === 'allow')
    .map(p => compilePolicy(p, bindings, input.actor))
  const denies = policies.filter(p => p.effect === 'deny')
    .map(p => compilePolicy(p, bindings, input.actor))

  let expr: ScopeExpr = { op: 'or', args: allows }
  const cap = blueprintCap(input) // 模板 cap；平台资源为空
  if (cap) expr = { op: 'and', args: [expr, cap] }
  if (denies.length > 0) {
    expr = { op: 'and', args: [expr, { op: 'not', arg: { op: 'or', args: denies } }] }
  }
  return expr
}
```

`compilePolicy`：

- `all` → `{ op: 'all' }`
- `self` → 对 `owner` 绑定生成 `eq(field, actor.userId)`；无绑定则解析失败
- `nodes` → 对 `field` 绑定生成 `in(field, nodeIds)`
- `node` → 取 actor 在对应维度的活跃成员关系，按 `positions` 过滤，
  按 `depth` 展开为节点集合，再生成 `in(field, nodeIds)`
- `relation` → 对 `relation` 绑定生成 `exists(source, where)`

## Enforcement Map

| 入口 | 执行方式 |
| --- | --- |
| 语义运行时列表 / 详情 / 单条读 | `ScopeExpr` → JSONB 谓词，拼进 `WHERE` |
| 写 / 更新 / 删除 / 状态迁移 | 先按 id 读并校验范围；越界返回 403/404 |
| 导入 | 每行校验；批量返回逐行错误，不部分落库 |
| 导出 / 统计 / 视图 / 追溯 | 与列表共用同一谓词 |
| 平台表 CRUD | TypeORM `QueryBuilder` 适配器 |
| Agent 工具面 | 工具调用前按资源/动作解析；工具结果不得绕过 |
| 插件 capability broker | 声明式表/操作上叠加范围；越界拒绝 |
| 全文搜索 / 通知 | 若资源已绑定，搜索/列表同样过滤 |

## Blueprint Integration

`semantic.json` 实体新增可选块：

```json
{
  "name": "Student",
  "dataScope": {
    "ownerField": "headTeacherId",
    "bindings": [
      { "dimension": "class", "kind": "field", "field": "classId" }
    ]
  }
}
```

关系绑定：

```json
{
  "name": "Course",
  "dataScope": {
    "bindings": [
      {
        "dimension": "class",
        "kind": "relation",
        "relation": { "entity": "TeachingAssignment", "fromField": "courseId", "actorField": "teacherId" }
      }
    ]
  }
}
```

`permissions.json` 规则新增 `scope: "policy"` + `dataScope`（加法式扩展，旧值语义不变）：

```json
{
  "role": "principal",
  "scope": "policy",
  "resources": ["Student"],
  "actions": ["read", "list"],
  "dataScope": {
    "dimension": "campus",
    "depth": "subtree",
    "positions": ["principal"]
  }
}
```

映射规则：

- `own` → `self`（要求实体有 `ownerField`）
- `team` → 绑定维度上 actor 成员关系的**精确节点**
- `all` → 租户内全部
- `policy` → 按 `dataScope` 模板解析；租户只能收窄

编译期校验：

- `policy` 必须有 `dataScope`；`dataScope.dimension` 必须是非空键；
- `own` 必须能解析到 `ownerField` 或 `owner` 绑定；
- `team`/`policy` 必须能解析到至少一个 `field` 或 `relation` 绑定；
- 绑定的字段/实体/关联字段必须存在于 `semantic.json`；
- 未知 scope 值仍被拒（遵守“加法式协议扩展”）。

## Migration Plan

1. 新表 + RLS + 索引，纯增量；不改 `departments` / `roles` / `users`。
2. 既有 `ownership` 不动；新 `dataScope` 按实体逐个声明。
3. 启用前预检：对声明了绑定字段的资源统计 `null`/空值行数；
   `dataScope` 对空绑定按 fail-closed 处理，必须先回填或给出迁移脚本。
4. 先接平台表（如 CRM 客户/订单）做样板，再接蓝图运行时。
5. 回滚：移除 `dataScope` 声明或停用策略；表与数据保留，不影响旧路径。

## Invariants to Register

实现时在 `docs/META_LANGUAGE.md` 第 4 节登记（编号以该文件为准）：

- **INV-DS-01**：数据范围只做收窄，不授予功能权限；最终可见 = 租户 ∩ 功能权限 ∩ 范围。
- **INV-DS-02**：范围只从可信身份与服务端存储解析，不接受客户端范围声明。
- **INV-DS-03**：声明 `dataScope` 即执行；未声明不改变旧行为；解析失败一律拒绝。
- **INV-DS-04**：租户边界先于范围；RLS 只做 `organizationId` 边界，不表达行级范围。
- **INV-DS-05**：定义/实例分离；租户策略不得扩大蓝图模板 cap。
- **INV-DS-06**：范围变更 bump `scopeVersion`；缓存不得跨越版本。

## Risks / Trade-offs

| 风险 | 对策 |
| --- | --- |
| 复杂策略难解释 | 固定五种 scope + 预览 API + 策略命中原因 |
| JSONB 字段过滤慢 | 绑定字段建表达式索引；树用 path 索引；关系 EXISTS 建索引 |
| 深树/大规模 | 物化路径起步；超阈值再引入闭包表 |
| 缓存陈旧 | `scopeVersion` 单调递增，key 带版本；变更即失效 |
| 绕过执行点 | 统一 `DataScopeService` + 路由清单 + 负例 e2e + 代码评审清单 |
| 跨应用串数据 | 资源键命名空间 + 绑定/策略按命名空间匹配 |
| 租户放大权限 | 模板 cap ∩ 租户策略；管理 API 拒绝扩大并报错 |
| 空绑定字段误伤历史数据 | 启用前空值预检；fail-closed；提供回填脚本 |
| RLS 不能表达行级范围 | 明确 RLS 只做租户边界；应用层谓词 + 负例；不宣称 DB 级保证 |


## Rollout Note

- 声明 `dataScope` 即执行；未声明实体保持租户隔离旧行为。
- 空绑定按 fail-closed 隐藏；启用前跑 `/data-scope/preflight` 并回填。
- 蓝图模板 cap ∩ 租户策略；租户只能收窄，不能放大。
- 先接平台表/单实体，再接视图/导出/Agent；所有入口复用同一 `ScopeExpr`。

## Open Questions

- `departments` 是否在后续变更中迁移为 `department` 维度？（本变更只做适配器。）
- 是否需要 `shadow` 观测模式？（v1 不做，避免“声明了但没执行”。）
- 多跳关系（课程→班级→校区）是否需要在 v2 支持？（v1 用单跳 + 组合策略。）
- 节点规模阈值与闭包表引入时机，按真实租户数据量再定。
