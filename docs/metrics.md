# Metrics & Dashboards（指标/看板）

指标是受控聚合读模型，不是业务真源。

## 指标定义

`POST /api/metrics/definitions`：

```json
{
  "key": "active.students",
  "name": "活跃学生数",
  "period": "day",
  "aggregation": "count",
  "sourceType": "blueprint",
  "sourceConfig": { "entity": "Student" },
  "dimensions": ["department"],
  "permissions": ["metrics:read"]
}
```

- 来源：`blueprint` / `platform`（表白名单）/ `event`（审计 action）/ `computed`（ratio）。
- 聚合：count/sum/avg/min/max/ratio/distinct_count。
- 口径变更升 `version`；不允许任意 SQL。
- computed 依赖环在计算时报错。

## 查询

`POST /api/metrics/query`：

```json
{ "metricKey": "active.students", "from": "...", "to": "...", "dimensions": ["department"], "compare": "previous" }
```

- 返回按周期 bucket 的维度值 + `sampleCount`；`compare=previous|year` 返回对比序列。
- 权限：definition.permissions 或 `metrics:manage`；跨租户由组织上下文/RLS 拒绝。
- 缓存：`METRICS_CACHE_TTL_MS`（默认 60s）。

## 快照

- `POST /api/metrics/snapshot`：日快照 upsert `metric_values`（org+metric+version+period+维度唯一）。
- `POST /api/metrics/backfill` `{days,metricKey?}`：回填历史。
- cron `metrics.snapshot_scan` 每日 01:30。

## 看板

`POST /api/metrics/dashboards` 支持 widgets：

```json
{
  "key": "overview",
  "name": "总览",
  "widgets": [
    { "key": "students", "type": "number", "metricKey": "active.students" },
    { "key": "trend", "type": "line", "metricKey": "active.students", "config": { "dimensions": ["department"] } }
  ]
}
```

`POST /api/metrics/dashboards/:key/query` 返回每个 widget 的指标结果。Portal `/dashboard/metrics` 渲染。

## 预警

`POST /api/metrics/alerts`：operator `gt/gte/lt/lte/no_data`、阈值、窗口、冷却、静默、channels。
cron `metrics.alert_scan` 每 30 分钟；`POST /api/metrics/alerts/evaluate` 手动评估。
事件 `firing`/`resolved` 按 `(alertId,dedupKey)` 唯一，冷却期内不重复。

## 导出

`POST /api/metrics/export` `{format: csv|json|xlsx|pdf|md, metricKeys, from, to}` 异步生成到对象存储；
`GET /api/metrics/export/:jobId/download` 下载。导出走同一指标查询/权限。

## 兼容

现有 `module_statistics`、航运报表、旧页面不改；新指标/看板共存。
