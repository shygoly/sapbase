# Design: 记录生命周期与树操作

## Context

- `semantic-runtime` 记录有 `version`、迁移历史、字段校验、唯一索引、引用检查；
- 头行结构用 `children`/`parent`（编译期双向一致）；
- 没有通用树元数据、clone/move/sort/archive/version snapshot；
- 教育课程树/知识点树、课程克隆/归档/版本需要这些；
- `add-async-job-and-callback-facade` 可承载大克隆；`data-scope` 约束目标节点。

## Goals / Non-Goals

**Goals**

1. 通用树元数据与完整性校验（自引用、防环、排序）。
2. 深克隆/复制子树，引用重映射、唯一字段策略、事务、幂等。
3. 跨父节点移动/同级排序，防环、并发安全。
4. 软归档/恢复，保留历史与审计。
5. 版本快照/发布/diff/恢复为新版本。
6. 大操作异步、进度/取消；权限与数据范围。

**Non-Goals**

- 不做任意图克隆/跨租户克隆。
- 不做闭包表/图数据库；v1 用 parent/order 查询。
- 不做文件系统/资产二进制复制（资产引用复用）。
- 不改变头行结构语义。

## Decisions

### D1：树元数据

`semantic.json` 实体可选：

```json
{
  "name": "Chapter",
  "tree": {
    "parentField": "parentId",
    "orderField": "sortOrder"
  }
}
```

- `parentField` 必须是同实体的 `reference` 或 text（存本实体 id），可空（根）；
- `orderField` 必须是 number/i32；
- 编译期校验字段存在、自引用、类型；
- 运行时校验：父节点同组织/蓝图、不能成环、不能跨树；
- 未声明 `tree` 的实体不受影响。

### D2：克隆

`clone(recordId, { includeChildren, targetParentId?, uniqueStrategy, referenceStrategy })`：

- 深拷贝实体及子实体（按 tree/children）；
- 生成 ID 映射；克隆内部的引用重映射到新 ID；
- 外部引用（不在克隆集合内）默认保留；可选置空/报错；
- 唯一字段策略：
  - `suffix`：追加 ` (copy)`/序号，冲突重试；
  - `placeholder`：清空/生成占位（需字段可空）；
  - `fail`：冲突即失败（默认）。
- 事务：全部成功或回滚；大克隆异步。
- 幂等：`Idempotency-Key` + 结果映射表；重复请求返回同一结果。
- 审计：源、目标、字段策略、操作者。

### D3：移动/排序

- `move(recordId, newParentId, newIndex?)`：
  - 校验目标父节点同组织/同树；不能移动到自身/后代（防环）；
  - 更新 parentField；同级 orderField 重排（间隙/批量）；
  - 并发：乐观锁/事务；冲突重试；
  - 子节点随父移动（隐式）。
- `reorder(recordId, newIndex)`：同级重排。
- 审计前后父/序号。

### D4：归档/恢复

- 实体声明 `archiveField`（如 `status` 或 `archivedAt`）？v1 用 `archivedAt` 通用列或声明字段。
- 设计：`archive(recordId, reason)` 写 `archivedAt/archivedBy` 或声明字段；从活跃列表隐藏；
  子节点可选择级联归档；唯一约束处理（归档记录仍占唯一键？提供 `uniqueScope` 配置）。
- `restore(recordId)` 校验父节点/唯一冲突；恢复后重新可见。
- 不物理删除；审计；与状态机解耦（归档不是业务状态迁移，除非实体显式映射）。

### D5：版本快照

`record_snapshots`：

- `organizationId`、`blueprintId`、`entity`、`recordId`
- `version`、`data`（JSONB）、`state`、`reason`、`createdBy`、`createdAt`
- `publishedAt?`、`label?`（如 `v1.2`）

操作：

- `snapshot(recordId, reason)`：保存当前数据/状态；
- `publish(recordId, label?)`：创建发布快照并标记；
- `diff(versionA, versionB)`：字段级差异；
- `restore(version)`：以旧快照为源创建**新版本**（不覆盖历史），走正常校验/审计。
- 快照保留策略/上限可配置；与 audit_logs 互补（审计是操作流水，快照是内容状态）。

### D6：权限与数据范围

- 源记录：读权限 + 数据范围；
- 目标父节点/克隆目标：写权限 + 可写范围；
- 跨范围克隆/移动拒绝；审计。
- 操作权限点：`records:clone` / `records:move` / `records:archive` / `records:snapshot`（或实体级）。

### D7：异步

- 克隆/大子树移动/批量归档可异步；进度/取消/重试；
- 小操作同步；阈值可配置；
- 结果映射/错误报告作为资产。

### D8：兼容

- 未声明 `tree`/`archiveField` 的实体：旧 CRUD/状态迁移不变；
- `children/parent` 头行结构不变；
- 快照表新增，不改旧记录；
- 回滚：停用新操作；旧接口继续。

## Data Model

```sql
record_snapshots (
  id uuid pk,
  "organizationId" uuid not null,
  "blueprintId" varchar(128) not null,
  entity varchar(128) not null,
  "recordId" uuid not null,
  version int not null,
  data jsonb not null,
  state varchar(128),
  reason varchar(255),
  label varchar(64),
  "publishedAt" timestamptz,
  "createdBy" uuid,
  "createdAt" timestamptz not null default now(),
  unique ("organizationId", "blueprintId", entity, "recordId", version)
)

-- 可选：克隆/移动运行记录
record_operations (
  id uuid pk,
  "organizationId" uuid not null,
  "blueprintId" varchar(128) not null,
  entity varchar(128) not null,
  operation varchar(32) not null,
  "sourceId" uuid,
  "targetId" uuid,
  status varchar(32) not null,
  "idempotencyKey" varchar(255),
  "jobId" uuid,
  result jsonb not null default '{}',
  error text,
  "createdBy" uuid,
  "createdAt" timestamptz not null default now()
)
```

`record_snapshots` 纳入 RLS；`record_operations` 按组织隔离。

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| 深拷贝引用/唯一键冲突 | ID 映射 + 唯一策略 + 事务 + 冲突可定位 |
| 克隆爆炸 | 深度/数量限制；异步；取消；配额 |
| 树环/并发移动 | 事务 + 防环校验 + 乐观锁/重试 |
| 版本存储增长 | 保留策略/上限；压缩；按需快照 |
| 归档占唯一键 | `uniqueScope` 配置；归档时处理唯一索引 |
| 跨范围操作 | 源读/目标写 + 数据范围 + 审计 |
| 旧结构破坏 | 未声明 tree 不走新路径；头行结构不变 |

## Migration Plan

1. 新增快照/操作表 + RLS；tree 元数据 schema。
2. 先实现 clone/archive（教育课程），再接 move/reorder/version。
3. 大克隆接 job；小操作同步。
4. 旧实体回归；新实体逐步声明 tree。
5. 回滚：停用新操作；旧 CRUD 不变。

## Open Questions

- 归档字段用通用 `archivedAt` 还是实体声明？建议通用列 + 可选映射。
- 唯一字段默认策略？建议 `fail`，业务显式选择 suffix/placeholder。
- 版本快照是否需要 binary/资产快照？v1 只记录引用，不复制资产。
- 树是否需要 path/closure 加速？v1 parent/order 足够，量大再评估。
