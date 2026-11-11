## 1. 契约与元语

- [x] 1.1 `schemas/metrics.schema.json`
- [x] 1.2 META §3.20 + 不变量 61–66
- [x] 1.3 DOMAIN「指标与看板」+ check-domain 0 error
- [x] 1.4 FLOWS/registry：snapshot_scan、alert_scan + job types
- [x] 1.5 DECISIONS D-19

## 2. 存储与 RLS

- [x] 2.1 迁移 179500 + DDL
- [x] 2.2 唯一/索引已建
- [x] 2.3 TENANT_RLS_DDL + e2e 跨租户
- [x] 2.4 entities + app.entities + MetricsModule

## 3. 指标定义与源

- [x] 3.1 definition 字段齐备
- [x] 3.2 MetricSourceService 四类来源
- [x] 3.3 blueprint aggregate SQL
- [x] 3.4 平台表白名单 + org 过滤
- [x] 3.5 audit action 事件源
- [x] 3.6 computed ratio + 环检测
- [x] 3.7 version+1；单测
- [x] 3.8 metrics 单测 6 tests

## 4. 聚合与快照

- [x] 4.1 upsert + values API
- [x] 4.2 snapshot cron + backfill API
- [x] 4.3 按日重算 upsert（小表）
- [x] 4.4 唯一键 upsert + job 重试
- [x] 4.5 dimension 限制在 source/查询
- [x] 4.6 单测快照/幂等

## 5. 看板

- [x] 5.1 dashboard/widget 创建/查询
- [x] 5.2 widget type 六类
- [x] 5.3 Portal 复用现有样式/CSS 柱，不新增图表库
- [x] 5.4 query 时间/维度/compare
- [x] 5.5 以 dimensions 逐级 drill-down
- [x] 5.6 layout/config/visibility
- [x] 5.7 e2e widget query/compare

## 6. 查询与数据权限

- [x] 6.1 POST /metrics/query
- [x] 6.2 scopeNodeIds 注入 blueprint 查询
- [x] 6.3 snapshot scopeNodeIds + source 谓词
- [x] 6.4 permissions 检查 + 维度白名单
- [x] 6.5 query hash + TTL cache
- [x] 6.6 e2e 跨租户 + 无权限单测

## 7. 预警

- [x] 7.1 alert 创建/列表
- [x] 7.2 alert_scan 30m + cooldown/silence
- [x] 7.3 dedupKey + firing/resolved
- [x] 7.4 事件可通知；渠道字段
- [x] 7.5 单测 firing/冷却 + e2e resolved

## 8. 导出与性能

- [x] 8.1 异步 metrics.export：csv/json/xlsx/pdf/md
- [x] 8.2 导出走同一 query/permissions
- [x] 8.3 快照+缓存+索引；未做 100 并发压测（环境限制）
- [x] 8.4 缓存优先 + 查询/TTL；超时降级后续
- [x] 8.5 单测+导出 e2e

## 9. 管理端与兼容

- [x] 9.1 `/dashboard/metrics`
- [x] 9.2 `/admin/metrics`
- [x] 9.3 未改旧报表
- [x] 9.4 docs/metrics.md + metricsApi
- [x] 9.5 seed/catalog 权限点
- [x] 9.6 validate 通过
- [x] 9.7 check-domain 0 error / check-meta 0 error
