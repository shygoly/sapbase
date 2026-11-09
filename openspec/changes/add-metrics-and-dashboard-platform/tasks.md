## 1. 契约与元语

- [ ] 1.1 定义 metric-definition / metric-value / dashboard / widget / alert 的持久化形状与 Schema
- [ ] 1.2 在 `docs/META_LANGUAGE.md` 登记指标/看板/预警术语与不变量（INV-MT-01..06）
- [ ] 1.3 在 `DOMAIN.md` 新增指标小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [ ] 1.4 在 `FLOWS.md` 登记聚合/回填/预警 job
- [ ] 1.5 在 `DECISIONS.md` 登记预聚合、受控 MetricSource、版本化口径、数据范围

## 2. 存储与 RLS

- [ ] 2.1 迁移：`metric_definitions` / `metric_values` / `dashboards` / `dashboard_widgets` / `metric_alerts` / `metric_alert_events`
- [ ] 2.2 索引：组织/指标/周期、维度 GIN、dashboard key、alert dedup
- [ ] 2.3 新表加入 `TENANT_RLS_DDL`；跨租户负例
- [ ] 2.4 TypeORM 实体与模块注册

## 3. 指标定义与源

- [ ] 3.1 `MetricDefinition`：key/period/aggregation/source/dimensions/filters/permissions/version
- [ ] 3.2 `MetricSource` 接口与 registry
- [ ] 3.3 Blueprint 实体源（复用语义运行时查询/索引）
- [ ] 3.4 平台表源（受控查询 + 数据范围）
- [ ] 3.5 事件源（outbox/审计/学习事件）
- [ ] 3.6 计算源（ratio/引用指标，禁止环）
- [ ] 3.7 口径版本化/变更审计
- [ ] 3.8 单测：注册、非法组合、版本、环检测

## 4. 聚合与快照

- [ ] 4.1 `metric_values` 写入/覆盖/查询
- [ ] 4.2 定时聚合（hour/day）与手动回填
- [ ] 4.3 增量水位/全量小表
- [ ] 4.4 幂等/重试/并发限制
- [ ] 4.5 维度基数限制/降级
- [ ] 4.6 单测：同周期重复、回填、缺失数据

## 5. 看板

- [ ] 5.1 `dashboards` / `dashboard_widgets` CRUD
- [ ] 5.2 组件类型：number/bar/line/pie/ranking/table
- [ ] 5.3 复用 `ui-kit/chart`；无新图表库
- [ ] 5.4 筛选（时间/节点/课程）、对比（上一周期/同比）
- [ ] 5.5 三级下钻（院系/课程/学生或校区/年级/班级）
- [ ] 5.6 布局/配置/可见性
- [ ] 5.7 单测：组件渲染、下钻、对比

## 6. 查询与数据权限

- [ ] 6.1 `POST /metrics/query`：指标/时间/维度/过滤/对比
- [ ] 6.2 范围解析：可见 scope 节点注入查询
- [ ] 6.3 预聚合指标按 scope 维度过滤；实时指标应用谓词
- [ ] 6.4 无权限指标/维度拒绝
- [ ] 6.5 缓存（org/scopeVersion/query hash）
- [ ] 6.6 负例：跨租户、越权节点、越权指标

## 7. 预警

- [ ] 7.1 `metric_alerts` CRUD：阈值/窗口/频率/scope/channels
- [ ] 7.2 评估 job（30 分钟窗口可配）+ 冷却/静默
- [ ] 7.3 `metric_alert_events` 去重/状态（firing/resolved/silenced）
- [ ] 7.4 通知接 `notification-center`；恢复通知
- [ ] 7.5 单测：触发/恢复/静默/重复/无数据

## 8. 导出与性能

- [ ] 8.1 看板/查询结果导出（Excel/CSV/PDF/MD）走批量导出
- [ ] 8.2 导出应用数据范围/字段权限
- [ ] 8.3 快照/缓存/索引；100 并发/<5s 压测
- [ ] 8.4 慢查询/超时降级
- [ ] 8.5 单测/性能基线

## 9. 管理端与兼容

- [ ] 9.1 Portal 看板页：筛选/下钻/对比/导出
- [ ] 9.2 Console 指标/预警/看板配置
- [ ] 9.3 现有 module_statistics / 航运报表不动
- [ ] 9.4 API 文档与 `api-client`
- [ ] 9.5 权限点：`metrics:read` / `metrics:manage` / `dashboards:manage` / `alerts:manage`
- [ ] 9.6 `openspec validate add-metrics-and-dashboard-platform --strict`
- [ ] 9.7 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
