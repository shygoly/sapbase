# Change: 批量导入/导出框架

## Why

当前导入只覆盖 Blueprint 主数据的一小段：

- `semantic-runtime/import-rows.ts` 只支持 CSV/JSON；
- `importMaster` 只允许 Part / Customer / Supplier；
- 没有 xlsx、模板下载、列映射、异步大导入、进度/历史、错误文件下载；
- 导出只有审计日志 CSV/JSON，没有通用查询导出、Excel/PDF/MD、异步大导出。

教育项目要求知识点 xlsx 导入（≥100/次、部分成功、行号+原因）、学生批量导入（≥500）、
教学数据 1 万条级异步导出、多格式导出、权限与数据范围适配。这些是跨行业通用能力。

## What Changes

- **ADDED** `bulk-import-export`：通用导入/导出能力
  - 导入：CSV / XLSX / JSON、模板生成、列映射、逐行校验、部分成功、dry-run、
    错误报告（行/列/原因）、幂等、历史。
  - 导出：查询/筛选/排序、字段选择、CSV / XLSX / PDF / MD、异步大导出、
    进度/历史、签名下载、权限与数据范围。
- **ADDED** 资源适配器注册：`ImportAdapter` / `ExportAdapter` 按资源键注册；
  Blueprint 实体、平台表、指标查询都可以接入。
- **ADDED** 导入/导出运行记录：`import_runs` / `export_runs`，
  绑定 `async-job`、结果资产、错误报告、操作者与保留期。
- **MODIFIED** 现有导入：保留旧接口与行为，内部走通用适配器；逐步放开受支持资源。
- **MODIFIED** 导出：审计导出保留，新增通用导出；PDF 通过可替换渲染器。
- **NOT CHANGED** 现有 Blueprint 校验、字段权限、数据范围、RLS。
- **NON-GOALS** 通用 ETL/BI 设计器、任意 SQL、外部数据库同步（由
  `add-external-integration-connector` 负责）、定时同步。
- **BREAKING** 无。旧导入接口与旧导出接口继续可用。

## Impact

- 受影响规格：`bulk-import-export`（新增）、`semantic-runtime`（导入适配器）
- 受影响代码：
  - `apps/api/src/semantic-runtime/{import-rows,semantic-runtime.service}.ts`
  - 新模块 `apps/api/src/import-export/**` 或 `libs/platform-core/src/import-export/**`
  - `apps/api/src/audit-logs/audit-logs.controller.ts`（复用导出框架，可选）
  - `apps/web-portal` / `web-console` 导入向导、导出面板、历史
  - `DOMAIN.md`、`DECISIONS.md`
- 依赖：`add-async-job-and-callback-facade`（大导入/导出）、
  `add-asset-and-media-pipeline`（错误报告/导出文件）、`add-generic-data-scope-authorization`
  （数据范围）、`add-audit-compliance-and-tamper-evidence`（导出审计）。
- 迁移：新增运行记录表；旧导入/审计导出保留；新入口逐步切换。
- 风险：xlsx 解析安全、公式注入、超大文件、部分成功一致性、PDF 渲染依赖。
