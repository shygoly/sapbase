# metrics-dashboard Specification

## Purpose
TBD - created by archiving change add-metrics-and-dashboard-platform. Update Purpose after archive.
## Requirements
### Requirement: Metric Registry and Definitions

平台 SHALL 提供指标注册：key、名称、周期、聚合、来源、维度、默认过滤、权限、版本与状态。
指标口径变更 MUST 升版本；历史快照 MUST 保留其版本标记。
自定义指标 MUST 只能从受控来源/聚合/维度组合中选择，MUST NOT 写任意 SQL。

#### Scenario: 注册核心指标

- **WHEN** 管理员注册“活跃学生数”（周期 day、count、来源学生实体）
- **THEN** 指标 SHALL 可用于看板/查询
- **AND** 口径/版本 SHALL 可查

#### Scenario: 非法自定义指标

- **WHEN** 用户尝试提交任意 SQL 或未注册来源
- **THEN** 请求 SHALL 被拒绝
- **AND** MUST NOT 执行

### Requirement: Metric Sources and Aggregation

指标 MUST 通过注册的 `MetricSource` 适配器查询/聚合；来源可以是 Blueprint 实体、
平台表、事件或计算指标。聚合 MUST 支持 count/sum/avg/min/max/ratio/distinct_count；
计算指标 MUST 禁止循环引用。

#### Scenario: 实体源聚合

- **WHEN** 查询按院系分组的课程数
- **THEN** 系统 SHALL 通过注册源聚合
- **AND** 结果 SHALL 带维度值与样本数

#### Scenario: 计算指标环

- **WHEN** 指标 A 依赖 B，B 又依赖 A
- **THEN** 保存/计算 SHALL 失败并指明环

### Requirement: Metric Snapshots and Backfill

系统 SHALL 按周期生成指标快照，并支持手动/定时回填。
同一组织/指标/版本/周期/维度 MUST 唯一；重复计算 MUST 幂等。
回填 MUST 可进度/取消/重试，MUST NOT 阻塞在线查询。

#### Scenario: 每日快照

- **WHEN** 日聚合任务运行
- **THEN** 每个指标/维度 SHALL 生成或更新当日快照
- **AND** 重复运行结果一致

#### Scenario: 回填历史

- **WHEN** 管理员回填过去 30 天
- **THEN** 系统 SHALL 异步执行并显示进度
- **AND** 在线看板仍可读旧/新快照

### Requirement: Dashboard Definitions and Widgets

看板 SHALL 支持数字卡、柱状、折线、饼图、排行、表格组件；
每个组件 MUST 引用指标而非写查询；看板 MUST 支持布局、默认筛选与可见性。
前端 MUST 复用现有图表组件，不新建图表库。

#### Scenario: 创建看板

- **WHEN** 管理员添加“学生总数”数字卡与“课程建设趋势”折线图
- **THEN** 看板 SHALL 保存布局与组件配置
- **AND** 组件 SHALL 使用已注册指标

#### Scenario: 不可见看板

- **WHEN** 用户不在看板 visibility 范围
- **THEN** 看板 SHALL 不可见/拒绝
- **AND** MUST NOT 返回指标数据

### Requirement: Filters, Comparison, and Drill-down

看板/查询 SHALL 支持时间、组织节点、课程等联动筛选，支持上一周期/同比对比，
并支持至少三级下钻。下钻 MUST 保持同一指标口径与数据权限。

#### Scenario: 三级下钻

- **WHEN** 用户从院系下钻到课程再到学生
- **THEN** 每一级 SHALL 使用对应维度过滤
- **AND** 结果 MUST 只在用户可见范围内

#### Scenario: 周期对比

- **WHEN** 用户选择“上一周期”对比
- **THEN** 系统 SHALL 返回同口径的对比值
- **AND** 缺失数据 SHALL 明确标记

### Requirement: Data Scope and Permissions

指标查询、下钻、导出 MUST 全程应用数据范围；预聚合快照 MUST 带 scope 维度，
实时查询 MUST 注入范围谓词。无权限指标/维度/节点 MUST 被拒绝或过滤。
MUST NOT 通过聚合结果反推越权明细。

#### Scenario: 院系管理员只看本院系

- **WHEN** 院系管理员查询全校指标
- **THEN** 结果 MUST 只含其授权院系
- **AND** 汇总 MUST NOT 包含其他院系

#### Scenario: 越权下钻

- **WHEN** 用户尝试下钻到无权限班级
- **THEN** 请求 SHALL 被拒绝或返回空
- **AND** MUST NOT 返回该班明细

### Requirement: Alert Rules and Notifications

系统 SHALL 支持指标预警：阈值/环比/无数据、窗口、频率、冷却、静默、scope 与通知渠道。
预警评估 MUST 幂等去重；触发/恢复 MUST 通知；MUST NOT 重复风暴。

#### Scenario: 30 分钟低活跃预警

- **WHEN** 某班活跃学生数连续 30 分钟低于阈值
- **THEN** 系统 SHALL 产生预警事件并通知
- **AND** 冷却期内 MUST NOT 重复通知

#### Scenario: 恢复通知

- **WHEN** 指标回到阈值以上
- **THEN** 系统 SHALL 标记 resolved
- **AND** 按配置发送恢复通知

### Requirement: Export and Performance

看板/查询结果 SHALL 支持导出（Excel/CSV/PDF/MD），导出 MUST 异步、受权限与数据范围约束。
看板查询 MUST 优先读快照/缓存，满足约定的并发与首屏目标；慢查询 MUST 有降级/超时。

#### Scenario: 导出看板数据

- **WHEN** 用户导出当前筛选的看板数据
- **THEN** 导出 MUST 只含其可见范围
- **AND** 大导出 SHALL 异步完成

#### Scenario: 首屏性能

- **WHEN** 100 个并发用户打开总览看板
- **THEN** 首屏 SHALL 在约定时间内返回
- **AND** 不得实时全表扫描

### Requirement: Tenant Isolation

指标定义/快照/看板/预警 MUST 绑定组织（平台内置指标除外）并受 RLS 约束；
跨租户查询/导出/预警 MUST 被拒绝。MUST NOT 跨租户聚合。

#### Scenario: 跨租户指标

- **WHEN** A 组织用户查询 B 组织指标/看板
- **THEN** 请求 SHALL 被拒绝
- **AND** 结果 MUST NOT 包含他租数据

### Requirement: Backward Compatibility

本能力 MUST NOT 改变现有 `module_statistics`、航运报表与旧页面行为。
新看板/指标共存；旧路由与接口 MUST 继续可用。

#### Scenario: 旧报表

- **WHEN** 用户访问现有航运报表
- **THEN** 行为 SHALL 与升级前一致
- **AND** 不强制迁移到新看板

#### Scenario: 旧模块统计

- **WHEN** 查询模块统计
- **THEN** 结果 SHALL 保持不变
- **AND** 新指标系统 MAY 读取但不改写

