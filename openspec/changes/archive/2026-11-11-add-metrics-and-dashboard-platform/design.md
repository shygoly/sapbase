# Design: 指标、看板与预警平台

## Context

已核对的现状：

- `apps/api/src/module-registry/module-statistics.entity.ts`：模块统计，不是通用指标。
- `apps/web-portal/src/app/[locale]/dashboard/shipping/reports/**`：航运领域静态报表。
- `libs/ui-kit/src/chart.tsx` + Recharts：已有图表组件。
- 没有指标注册/口径/快照/下钻/对比/预警/异步导出。
- `add-generic-data-scope-authorization` 提供 scope 节点与范围解析。
- `add-async-job-and-callback-facade` 提供聚合/回填/预警/导出任务。
- `add-notification-center-and-announcements` 提供预警通知。
- `add-bulk-import-export-framework` 提供导出。

## Goals / Non-Goals

**Goals**

1. 指标注册与口径统一：名称、周期、聚合、来源、维度、过滤、权限。
2. 预聚合/快照，支撑多级看板与 100 并发/<5s。
3. 看板/组件/筛选/对比/三级下钻，复用现有图表。
4. 预警规则、静默、通知。
5. 数据范围在查询/下钻/导出全程生效。
6. 平台内置指标 + 租户自定义（受控模板）。

**Non-Goals**

- 不做通用 BI 设计器/任意 SQL/拖拽计算。
- 不做 ML 预测/归因/外部 BI。
- 不做跨租户指标汇聚。
- 不替换现有 module_statistics / 航运报表。

## Decisions

### D1：指标定义

`metric_definitions`：

- `organizationId`（平台内置可为空/固定）、`appInstallationId?`
- `key`、`name`、`description`
- `period`：`hour` / `day` / `week` / `month`
- `aggregation`：`count` / `sum` / `avg` / `min` / `max` / `ratio` / `distinct_count`
- `sourceType`：`blueprint_entity` / `platform_table` / `event` / `computed`
- `sourceRef`：资源键/事件名/公式 key
- `dimensions`：允许的维度（scope node、course、class、status 等）
- `filters`：默认过滤
- `permissions`：查看指标所需权限
- `status`、`version`

约束：

- 不允许任意 SQL；来源必须是注册的 `MetricSource` 适配器。
- 自定义指标只能从允许的 source/dimension/aggregation 组合中选择。
- 口径变更必须升版本，历史快照保留旧版本标记。

### D2：MetricSource 适配器

```ts
interface MetricSource {
  key: string
  supports(aggregation: Aggregation, dimensions: string[]): boolean
  query(input: MetricQuery, ctx: MetricContext): Promise<MetricRow[]>
}
```

- Blueprint 实体源：用语义运行时查询/索引，应用数据范围。
- 平台表源：TypeORM/原生 SQL（受控模板），应用数据范围。
- 事件源：outbox/审计/学习事件，按时间窗口聚合。
- 计算源：比率/派生指标（引用其他指标，禁止环）。
- 维度值来自 scope 节点/枚举/时间桶；维度基数限制。

### D3：快照

`metric_values`：

- `organizationId`、`appInstallationId?`
- `metricKey`、`metricVersion`
- `periodStart`、`periodEnd`
- `dimensions`（JSONB：`{ scopeNodeId?, courseId?, classId?, status? }`）
- `value`（numeric）、`sampleCount`、`computedAt`
- 唯一 `(organizationId, metricKey, metricVersion, periodStart, dimensionsHash)`

聚合：

- 定时 job（hour/day）计算最近窗口；支持回填（按时间范围）。
- 幂等：同一周期/维度重复计算覆盖或跳过（按策略），保留 `computedAt`。
- 增量：事件源可按水位；实体源按 `updatedAt` 或全量小表。
- 维度爆炸：限制允许维度组合；超限拒绝/降级。

### D4：看板

`dashboards`：

- `organizationId`、`appInstallationId?`、`key`、`name`
- `layout`（JSONB）、`filters`（默认筛选）、`visibility`（角色/用户/组织节点）
- `status`、`createdBy`

`dashboard_widgets`：

- `dashboardId`、`type`（`number` / `bar` / `line` / `pie` / `ranking` / `table`）
- `metricKey`、`dimensions`、`filters`、`compare`（none/previous/period）
- `position`/`size`、`drilldown`（维度链）、`link`
- `title`/`description`/`format`（number/percent/currency）

- 组件只引用指标，不写查询。
- 下钻：`drilldown: ['campus','grade','class']`，每级用指标维度过滤。
- 对比：上一周期/去年同期；需要同一口径/周期。
- 前端复用 `ui-kit/chart`；无新图表库。

### D5：查询与数据权限

`POST /metrics/query`：

```json
{
  "metric": "student.active.count",
  "from": "2026-09-01",
  "to": "2026-11-01",
  "dimensions": ["campus"],
  "filters": { "campus": "..." },
  "compare": "previous_period"
}
```

- 解析调用方可见 scope 节点；对指标维度/过滤注入范围谓词。
- 预聚合指标：`metric_values` 行带 `scopeNodeId` 维度；查询只取可见节点。
- 未预聚合/实时指标：走 MetricSource 查询，应用数据范围谓词。
- 无权限指标/维度 → 403/空；不返回越权聚合。
- 缓存：按 org/scopeVersion/metric/query hash 缓存短 TTL。

### D6：预警

`metric_alerts`：

- `organizationId`、`key`、`name`、`metricKey`
- `condition`：`gt` / `gte` / `lt` / `lte` / `change_pct` / `no_data`
- `threshold`、`window`（如 30m/1h/1d）、`frequency`（冷却）
- `scope`（组织/节点/课程/班级）、`channels`（in_app/email）
- `silenceUntil`、`status`

`metric_alert_events`：

- `alertId`、`metricKey`、`windowStart/End`、`value`、`status`（firing/resolved/silenced）
- `dedupKey`（alertId + window + dimensions）唯一；避免重复告警。
- 评估：cron/job 每 N 分钟；状态变化通知；恢复通知。
- 阈值/频率可配置；误报可静默/调参。

### D7：导出与性能

- 导出走 `add-bulk-import-export-framework`：看板/查询结果 → Excel/CSV/PDF/MD；异步、权限、数据范围。
- 性能：
  - 预聚合优先；看板默认读快照；
  - 索引 `(organizationId, metricKey, periodStart)`、维度 GIN；
  - 查询缓存（短 TTL + scopeVersion）；
  - 100 并发目标用快照/缓存，不实时扫全表；
  - 大范围回填走 job，限并发。
- 慢查询/超时监控；降级为快照或提示缩小范围。

### D8：权限与隔离

- `metrics:read` / `dashboards:read` / `dashboards:manage` / `metrics:manage` / `alerts:manage`
- 指标定义可设 `permissions`；看板 visibility 支持角色/用户/节点。
- 所有表带 `organizationId` + RLS；跨租户查询/导出拒绝。
- 预警通知按 scope 解析接收人。

### D9：兼容

- 现有 `module_statistics` / 航运报表不动；可作为指标源或迁移样板。
- 新看板与旧页面共存；旧路由不强制替换。
- 回滚：停用新看板/预警；旧统计继续。

## Data Model

```sql
metric_definitions (
  id uuid pk,
  "organizationId" uuid,              -- 平台内置可为空
  "appInstallationId" uuid,
  key varchar(128) not null,
  name varchar(255) not null,
  description text,
  period varchar(16) not null,
  aggregation varchar(32) not null,
  "sourceType" varchar(32) not null,
  "sourceRef" varchar(255) not null,
  dimensions jsonb not null default '[]',
  filters jsonb not null default '{}',
  permissions text[] not null default '{}',
  status varchar(32) not null default 'active',
  version int not null default 1,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("organizationId", key, version)
)

metric_values (
  id uuid pk,
  "organizationId" uuid not null,
  "appInstallationId" uuid,
  "metricKey" varchar(128) not null,
  "metricVersion" int not null,
  "periodStart" timestamptz not null,
  "periodEnd" timestamptz not null,
  dimensions jsonb not null default '{}',
  "dimensionsHash" varchar(64) not null,
  value numeric not null,
  "sampleCount" bigint not null default 0,
  "computedAt" timestamptz not null default now(),
  unique ("organizationId", "metricKey", "metricVersion", "periodStart", "dimensionsHash")
)

dashboards (
  id uuid pk,
  "organizationId" uuid not null,
  "appInstallationId" uuid,
  key varchar(128) not null,
  name varchar(255) not null,
  layout jsonb not null default '{}',
  filters jsonb not null default '{}',
  visibility jsonb not null default '{}',
  status varchar(32) not null default 'active',
  "createdBy" uuid,
  "createdAt" timestamptz not null default now(),
  unique ("organizationId", key)
)

dashboard_widgets (
  id uuid pk,
  "organizationId" uuid not null,
  "dashboardId" uuid not null,
  type varchar(32) not null,
  "metricKey" varchar(128) not null,
  dimensions jsonb not null default '[]',
  filters jsonb not null default '{}',
  compare varchar(32) not null default 'none',
  position jsonb not null default '{}',
  drilldown jsonb not null default '[]',
  title varchar(255),
  config jsonb not null default '{}'
)

metric_alerts (
  id uuid pk,
  "organizationId" uuid not null,
  key varchar(128) not null,
  name varchar(255) not null,
  "metricKey" varchar(128) not null,
  condition varchar(32) not null,
  threshold numeric,
  window varchar(32) not null,
  frequency varchar(32) not null,
  scope jsonb not null default '{}',
  channels jsonb not null default '["in_app"]',
  "silenceUntil" timestamptz,
  status varchar(32) not null default 'active',
  unique ("organizationId", key)
)

metric_alert_events (
  id uuid pk,
  "organizationId" uuid not null,
  "alertId" uuid not null,
  "metricKey" varchar(128) not null,
  "windowStart" timestamptz not null,
  "windowEnd" timestamptz not null,
  value numeric,
  status varchar(32) not null,
  "dedupKey" varchar(255) not null,
  "createdAt" timestamptz not null default now(),
  unique ("organizationId", "dedupKey")
)
```

所有表纳入 RLS；`metric_values` 按组织/指标/周期索引，维度 GIN。

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| 指标口径漂移 | 版本化定义；变更审计；看板锁定版本 |
| 聚合性能 | 预聚合/快照/缓存；按需回填；慢查询降级 |
| 维度爆炸 | 允许维度白名单 + 基数限制；超限拒绝 |
| 数据权限泄露 | 查询/下钻/导出全链路 scope；负例 |
| 预警误报 | 窗口/冷却/静默；恢复通知；可调参 |
| 自定义指标滥用 | 受控 source/aggregation/dimension；禁止任意 SQL |
| 旧报表兼容 | 新看板共存；旧路由不强制替换 |

## Migration Plan

1. 新增表 + RLS + MetricSource 接口。
2. 先接 7 个核心指标（学生数/活跃/时长/完成率/成绩/预警/课程建设）。
3. 接 1—2 个看板样板（学校/院系/课程），验证权限与下钻。
4. 接预警（30 分钟窗口）与通知。
5. 回滚：停用新看板/预警；旧统计继续。

## Open Questions

- 指标公式是否需要 DSL？v1 只做 ratio/引用其他指标；复杂公式后置。
- 自定义指标是否允许租户写 SQL？不允许，只选受控模板。
- 预警评估频率最低 30 分钟是否符合客户？按 job 能力支持更短，但成本高。
- 看板布局是否拖拽？v1 用预定义布局/配置，拖拽后置。
