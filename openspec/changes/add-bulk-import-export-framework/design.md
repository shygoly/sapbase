# Design: 批量导入/导出框架

## Context

已核对的现状：

- `apps/api/src/semantic-runtime/import-rows.ts`：
  - CSV（RFC 4180 子集）与 JSON；行号、表头校验、类型转换；
  - `normalizeImportInput` 结构错误整份拒；行级错误由 `importMaster` 收集。
- `semantic-runtime.service.ts#importMaster`：
  - 只允许 `Part / Customer / Supplier`（`IMPORTABLE_ENTITIES`）；
  - 头行实体不能导入；
  - 逐行事务写入，支持 partial success / dryRun / 行号错误；
  - 复用 Blueprint 校验、字段权限、唯一索引。
- 导出只有 `audit-logs.controller.ts` 的 CSV/JSON；没有通用导出。
- 没有 xlsx、模板、列映射、异步运行记录、错误文件、多格式导出。
- `add-async-job-and-callback-facade` 提供 job / 进度 / 结果资产。

## Goals / Non-Goals

**Goals**

1. 资源无关的导入/导出框架，Blueprint 实体与平台表都能接入。
2. xlsx/csv/json 导入，模板下载、列映射、逐行校验、部分成功、错误报告。
3. 通用导出：字段选择、筛选/排序、CSV/XLSX/PDF/MD、异步大导出、历史/下载。
4. 权限、字段权限、数据范围、租户隔离全程生效。
5. 大文件/大结果走 job + 资产，不阻塞 HTTP。
6. 旧导入/审计导出保持兼容。

**Non-Goals**

- 不做 ETL/BI 设计器、任意 SQL、跨库同步（外部连接器负责）。
- 不做定时同步/持续复制（v1 只做手动/一次性运行）。
- 不做用户自定义脚本转换（映射用声明式配置）。
- 不做 Word/ODS 导入（v1 xlsx/csv/json；后续按需扩展）。

## Decisions

### D1：适配器注册

```ts
interface ImportAdapter {
  resourceKey: string                  // platform:users / blueprint:<pkg>:Student
  fields: ImportFieldDef[]
  template(): ImportTemplate
  validateRow(row: RawRow, ctx): Promise<RowValidation>
  writeRow(row: NormalizedRow, ctx): Promise<void>
}

interface ExportAdapter {
  resourceKey: string
  fields: ExportFieldDef[]
  query(input: ExportQuery, ctx): Promise<ExportRowPage>
}
```

- Blueprint 适配器包装现有 `writeDocumentOrRecord` / `validateRecord`，复用字段权限、数据范围、唯一索引。
- 平台适配器按表/服务实现，复用 RBAC + 数据范围。
- 资源键命名空间与 `add-generic-data-scope-authorization` 一致。
- 未知资源键拒绝；适配器必须在启动时注册。

### D2：文件解析与模板

- CSV：复用现有解析器，补公式注入防护。
- JSON：对象数组；每项带 `__line` 可选。
- XLSX：使用 `exceljs`（或等价库）读取第一个/指定 sheet；限制行数、sheet 数、解压大小。
- 模板：从 `fields` 生成 xlsx/csv，包含表头、必填标记、示例行、说明 sheet。
- 列映射：表头别名、大小写/空格规范化；可选保存 `import_mappings`（用户/资源/模板）。
- 未知列默认拒绝；可选 `ignoreUnknownColumns` 但必须显式。

### D3：校验与部分成功

- 行级校验：必填、类型、枚举、引用、唯一性、业务规则、字段权限、数据范围。
- 两种模式：
  - `atomic`：任一行失败整批回滚（适合财务/主数据）；
  - `partial`：成功行落库，失败行返回错误（适合知识点/学生）。
- `dryRun`：只校验不落库，返回同样错误结构。
- 错误结构：`{ line, sheet?, column?, field?, reason, message }`。
- 错误报告可导出为 xlsx/csv，作为资产保存。
- 幂等：`import_runs` + 可选 `idempotencyKey`，重复提交返回同一运行。

### D4：导入运行

`import_runs`：

- `organizationId`、`resourceKey`、`format`、`fileName`、`assetId?`
- `mode`（atomic/partial）、`status`（queued/validating/importing/succeeded/partial/failed/cancelled）
- `totalRows`、`successRows`、`failedRows`、`errors`（JSONB 或错误资产）
- `jobId`、`createdBy`、`createdAt`、`finishedAt`
- `idempotencyKey`、`mappingId?`

流程：

```text
POST /imports (multipart 或 assetId)
  → 校验权限/资源/配额
  → 创建 import_run + job
  → job: 解析 → 校验 → 写入（事务按模式） → 错误报告 → 更新 run
  → 查询/下载错误报告
```

小文件可同步执行（阈值可配置）；大文件默认异步。

### D5：导出运行

`export_runs`：

- `organizationId`、`resourceKey`、`format`、`query`（筛选/排序）、`fields`
- `status`、`rowCount`、`assetId`、`jobId`、`createdBy`、`createdAt`、`expiresAt`

流程：

```text
POST /exports
  → 校验权限/字段/数据范围
  → 创建 export_run + job
  → job 分页查询（每页应用数据范围）
  → 写 CSV/XLSX/MD/PDF 到资产
  → 生成签名下载 URL
  → 历史/过期清理
```

- 分页/流式写，避免一次性加载 1 万+ 行。
- 导出内容按字段权限裁剪；无权限字段拒绝或省略（按配置，默认拒绝）。
- PDF：通过可替换渲染器（HTML→PDF 或 PDF 库）；模板化表头/分页。
- 导出审计：谁、何时、资源、筛选、字段、行数、下载。

### D6：权限、数据范围与安全

- 功能权限：`import:<resource>` / `export:<resource>` 或对应业务权限。
- 字段权限：导入写入字段必须可写；导出字段必须可读。
- 数据范围：导入写入的节点必须在可写范围；导出查询必须带范围谓词。
- 租户隔离：所有 run 带 `organizationId` + RLS；资产签名绑定组织/用户。
- 公式注入：CSV/XLSX 单元格以 `= + - @` 开头时转义/前缀。
- XLSX zip bomb：限制解压大小/文件数/行数；拒绝宏/外部链接。
- 文件大小/行数/并发配额；超限拒绝并给出明确错误。
- PII/敏感字段：可选脱敏/禁止导出；审计。

### D7：兼容与迁移

- 旧 `POST /semantic/:id/import/:entity` 保留，内部走 Blueprint 适配器；
  受支持实体逐步放开（先保持 Part/Customer/Supplier，新增实体按需注册）。
- 旧审计导出保留；可改为调用通用导出。
- 旧数据/旧错误结构兼容；新字段可选。
- 回滚：停用新入口；旧接口仍可用。

## Data Model

```sql
import_runs (
  id uuid pk,
  "organizationId" uuid not null,
  "resourceKey" varchar(255) not null,
  format varchar(16) not null,        -- csv | xlsx | json
  "fileName" varchar(512),
  "assetId" uuid,
  mode varchar(16) not null default 'partial',
  status varchar(32) not null,
  "totalRows" int not null default 0,
  "successRows" int not null default 0,
  "failedRows" int not null default 0,
  errors jsonb not null default '[]',
  "errorAssetId" uuid,
  "jobId" uuid,
  "idempotencyKey" varchar(255),
  "createdBy" uuid not null,
  "createdAt" timestamptz not null default now(),
  "finishedAt" timestamptz
)

export_runs (
  id uuid pk,
  "organizationId" uuid not null,
  "resourceKey" varchar(255) not null,
  format varchar(16) not null,        -- csv | xlsx | pdf | md
  query jsonb not null default '{}',
  fields text[] not null default '{}',
  status varchar(32) not null,
  "rowCount" int not null default 0,
  "assetId" uuid,
  "jobId" uuid,
  "createdBy" uuid not null,
  "createdAt" timestamptz not null default now(),
  "finishedAt" timestamptz,
  "expiresAt" timestamptz
)

import_mappings (
  id uuid pk,
  "organizationId" uuid not null,
  "resourceKey" varchar(255) not null,
  name varchar(255) not null,
  mapping jsonb not null,
  "createdBy" uuid not null,
  "createdAt" timestamptz not null default now()
)
```

所有新表纳入 RLS；`errorAssetId`/`assetId` 走资产管道。

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| xlsx 解析安全 | 限制解压/行数/sheet/宏；只读数据；不执行公式 |
| 公式注入 | 导出转义 `= + - @` 开头单元格 |
| 部分成功一致性 | 每行独立事务；atomic 模式整批事务；结果可重试 |
| 大文件内存 | 流式解析/分页写入；大文件走 job + 资产 |
| 导出权限泄露 | 字段权限 + 数据范围 + 审计；默认拒绝无权限字段 |
| PDF 渲染依赖 | provider 接口；v1 可用轻量库，复杂模板后置 |
| 旧接口兼容 | 保留入口；适配器包装；受支持资源逐步放开 |
| 导入错误报告 | 结构化错误 + 可下载资产；保留期可配置 |

## Migration Plan

1. 新增表 + RLS + 适配器接口。
2. 现有导入包装为 Blueprint 适配器；回归 Part/Customer/Supplier。
3. 接入 xlsx 与模板；接入学生/知识点等资源。
4. 新增导出；审计导出可选切换。
5. 回滚：旧接口保留；新 run 表不影响旧数据。

## Open Questions

- PDF 渲染用哪套？HTML→PDF（Playwright）还是 PDF 库？按部署体积决定。
- 是否支持 ODS/Word？v1 不做，按客户需求扩展。
- 导入映射是否跨用户共享？v1 按组织/资源保存，权限控制。
- 导出是否允许“全部字段”？默认拒绝，需显式授权。
