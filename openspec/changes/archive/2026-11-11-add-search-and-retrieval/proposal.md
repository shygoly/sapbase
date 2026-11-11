# Change: 搜索与检索

## Why

平台没有通用搜索：

- 知识检索只在 Agent 上下文里做 PG 关键词过滤；
- 素材/课程/知识点/公告没有全文检索、标签过滤、高亮；
- 教育项目需要素材检索（A-009/A-010）、课程/知识点搜索、推荐召回（B-026）；
- 现有 `rg`/LIKE 查询无法支撑多资源、权限过滤与排序。

搜索是跨行业通用能力；v1 用 PostgreSQL 全文/trigram，不引入外部搜索集群。

## What Changes

- **ADDED** `search`：
  - 统一 `SearchDocument`：组织/应用、资源键/ID、标题、正文、标签、元数据。
  - 索引：PostgreSQL 全文（tsvector）+ trigram；GIN 索引。
  - 索引管道：事件/任务驱动 upsert/delete；全量重建；幂等。
  - 查询 API：关键词、过滤（资源类型/标签/时间/范围）、排序、高亮、分页。
  - 权限与数据范围：只返回可见资源；字段脱敏。
  - 可选语义检索：embedding provider + 向量列（pgvector），v1 非必需。
- **MODIFIED** 知识/素材/课程/公告在写入/更新时触发索引（通过事件/job）。
- **NOT CHANGED** 现有 Agent 知识检索、数据库查询、页面路由。
- **NON-GOALS** 外部搜索集群（ES/OpenSearch/Meilisearch）、ML 排序、跨租户搜索、
  通用爬虫/网页索引。
- **BREAKING** 无。搜索为新增 API；旧查询/知识检索不变。

## Impact

- 受影响规格：`search`（新增）、`asset-pipeline`（索引触发）、
  `document-intelligence`（索引候选/知识点）、`agent-knowledge`（可选）
- 受影响代码：
  - 新模块 `apps/api/src/search/**` 或 `libs/platform-core/src/search/**`
  - `apps/api/src/assets/**`、`apps/api/src/semantic-runtime/**`（事件）
  - `apps/web-portal` 搜索框/结果页
  - `DOMAIN.md`、`DECISIONS.md`
- 依赖：`add-async-job-and-callback-facade`（索引/重建）、
  `add-generic-data-scope-authorization`（范围过滤）、`add-ai-content-governance`（标识/脱敏）。
- 迁移：新增表/索引；现有数据可后台重建；旧查询不变。
- 风险：索引一致性、中文分词、权限泄露、大表性能、向量成本。
