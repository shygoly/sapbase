# Change: 指标、看板与预警平台

## Why

当前只有零散统计：

- `module_statistics` 是模块注册表的一部分，不是通用指标；
- 航运 `reports/**` 是领域静态页面，不能复用到教育/其他行业；
- 没有指标注册、口径、周期、维度、快照、下钻、对比、预警规则、异步导出；
- 教育项目 A-016/A-026—A-036 要求 7+ 核心指标、学校/院系/专业/课程多级看板、
  三级下钻、联动筛选、学情预警（30 分钟）、多格式导出、100 并发/<5s。

这些是跨行业通用能力；图表组件已有（`ui-kit/chart` + Recharts），不需要再引一套。

## What Changes

- **ADDED** `metrics-dashboard`：指标注册表
  - key/name/description/period/aggregation/source/dimensions/filters/permissions/status
  - 平台内置指标 + 租户自定义指标（受控来源/维度，不写任意 SQL）。
- **ADDED** 指标快照：`metric_values`，按组织/应用/指标/周期/维度存储；
  定时/手动/增量聚合，幂等、可回填。
- **ADDED** 看板：`dashboards` + `dashboard_widgets`
  - 数字卡、柱状、折线、饼图、排行、表格；
  - 筛选（时间/组织节点/课程等）、对比、三级下钻；
  - 复用 `ui-kit/chart`，不新建图表库。
- **ADDED** 预警：`metric_alerts` + `metric_alert_events`
  - 阈值/环比/同比/持续窗口、频率、静默、通知渠道；
  - 通过 job/cron 评估，通知走 `notification-center`。
- **ADDED** 导出：看板/查询结果走 `bulk-import-export`（Excel/CSV/PDF/MD）。
- **ADDED** 数据权限：指标查询/下钻 MUST 应用数据范围；聚合维度包含 scope 节点。
- **ADDED** 性能：预聚合/快照/缓存/索引；100 并发/<5s 目标。
- **NOT CHANGED** 现有 `module_statistics`、航运报表、图表组件。
- **NON-GOALS** 通用 BI 设计器、任意 SQL、机器学习预测、外部 BI 集成。
- **BREAKING** 无。新能力可选；旧统计/报表继续可用。

## Impact

- 受影响规格：`metrics-dashboard`（新增）、`semantic-runtime`（数据源适配，可选）
- 受影响代码：
  - 新模块 `apps/api/src/metrics/**` 或 `libs/platform-core/src/metrics/**`
  - `apps/web-portal` / `web-console` 看板/指标/预警页
  - `libs/ui-kit/src/chart.tsx`（复用，不重写）
  - `DOMAIN.md`、`FLOWS.md`、`DECISIONS.md`
- 依赖：`add-generic-data-scope-authorization`（数据范围/维度）、
  `add-async-job-and-callback-facade`（聚合/回填/预警/导出）、
  `add-notification-center-and-announcements`（预警通知）、
  `add-bulk-import-export-framework`（导出）。
- 迁移：新增表；旧统计/报表不变；指标按业务逐步接入。
- 风险：指标口径漂移、聚合性能、维度爆炸、权限泄露、预警误报。
