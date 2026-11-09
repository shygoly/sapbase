# Design: 搜索与检索

## Context

- 没有 `tsvector`/`pg_trgm`/向量索引；知识检索是 Agent 上下文的关键词过滤。
- 素材/课程/知识点/公告需要全文、标签、资源类型过滤与高亮。
- 教育项目需要素材检索、课程/知识点搜索、推荐召回。
- `add-async-job` 可做索引/重建；`data-scope` 做权限过滤。

## Goals / Non-Goals

**Goals**

1. 统一搜索文档与索引管道，支持多资源类型。
2. PostgreSQL 全文 + trigram；中文分词可插拔。
3. 查询：关键词、过滤、排序、高亮、分页。
4. 权限/数据范围/租户隔离全程生效。
5. 索引增量更新、全量重建、幂等、可观测。
6. 可选向量检索（pgvector），v1 非必需。

**Non-Goals**

- 不引入外部搜索集群。
- 不做 ML 排序/个性化搜索（推荐是另一个模块）。
- 不做跨租户/公网搜索。
- 不做网页爬虫/通用内容索引。

## Decisions

### D1：搜索文档

`search_documents`：

- `organizationId`、`appInstallationId?`
- `resourceKey`、`resourceId`
- `title`、`body`、`tags`、`metadata`（JSONB）
- `tsv`（tsvector）、`updatedAt`
- 唯一 `(organizationId, resourceKey, resourceId)`

- 资源键与数据范围命名空间一致。
- `body` 存可搜索文本（去 HTML/富文本）；敏感字段不索引。
- 元数据用于过滤（类型/课程/班级/标签/时间），不参与全文。

### D2：索引与分词

- 全文：`to_tsvector('simple'/'chinese', title || body)`；中文分词可用 `zhparser`（可选扩展）
  或应用侧分词后写 `tsv`。
- trigram：`pg_trgm` 支持模糊/子串；GIN 索引。
- 可选向量：`embedding vector(1536)` + ivfflat/hnsw（pgvector）；v1 非必需。
- 索引字段/权重：标题 > 标签 > 正文；可配置。

### D3：索引管道

```text
resource.created/updated/deleted
  → outbox event
  → async job: build SearchDocument
  → upsert/delete search_documents
```

- 全量重建：按资源类型分页扫描 → 批量 upsert；进度/取消/重试。
- 幂等：按 resourceKey+resourceId upsert；删除标记/物理删除。
- 一致性：写入后最终一致；提供“重建/对账”job。
- 索引失败不影响业务写入；重试/告警。

### D4：查询

```text
GET /search?q=&types=&tags=&from=&to=&page=&pageSize=
```

- 关键词：全文 + trigram 兜底；空关键词时按过滤/时间。
- 排序：相关度/更新时间/标题；可配置。
- 高亮：`ts_headline` 或应用侧标记；返回片段。
- 分页：limit/offset 或游标；限制最大页大小。
- 结果：资源类型/ID/标题/片段/高亮/URL/元数据。
- 无结果/降级：返回空 + 建议；不报错。

### D5：权限与数据范围

- 查询前解析用户可见范围；对资源类型应用数据范围谓词。
- 预索引文档可带 `scopeNodeIds`/`ownerId` 等过滤字段；查询按可见节点过滤。
- 字段级权限：不索引/不返回无权限字段；高亮片段脱敏。
- 跨租户：`organizationId` 强制 + RLS；签名/缓存按租户隔离。
- 搜索日志/审计：可选记录查询词/结果数（脱敏），用于优化。

### D6：可选语义检索

- `EmbeddingProvider` 接口；为文档生成向量；查询向量相似度。
- v1 不做默认；客户需要时启用；成本/延迟可控。
- 语义结果仍受权限/范围过滤；不替代关键词。

### D7：兼容

- 现有 Agent 知识检索不变；可逐步复用搜索索引。
- 现有页面/API 不变；搜索是新增入口。
- 回滚：停用搜索/索引；旧查询继续。

## Data Model

```sql
search_documents (
  id uuid pk,
  "organizationId" uuid not null,
  "appInstallationId" uuid,
  "resourceKey" varchar(255) not null,
  "resourceId" varchar(128) not null,
  title text not null,
  body text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}',
  tsv tsvector,
  embedding vector(1536),            -- 可选，需 pgvector
  "scopeNodeIds" uuid[] not null default '{}',
  "ownerId" varchar(128),
  "updatedAt" timestamptz not null default now(),
  unique ("organizationId", "resourceKey", "resourceId")
)
-- GIN (tsv), GIN (tags), GIN (metadata), GIN (scopeNodeIds), optional vector index
```

新表纳入 RLS；按组织/资源类型/更新时间索引。

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| 索引不一致 | outbox/job 重试 + 重建/对账 job |
| 中文分词 | simple + trigram 起步；可选 zhparser/应用分词 |
| 权限泄露 | 查询前范围过滤 + 字段脱敏 + 负例 |
| 大表性能 | GIN/分区/限制页大小；只索引必要字段 |
| 向量成本 | 可选、按需启用；缓存/批量 |
| 旧检索兼容 | 新 API 增量；Agent 知识检索不变 |
| 高亮 XSS | 转义/白名单；前端安全渲染 |

## Migration Plan

1. 新增表/索引（含 pg_trgm；向量可选）。
2. 先索引素材/课程/知识点；再接公告/知识。
3. 全量重建 job；灰度查询。
4. 可选启用 embedding。
5. 回滚：停用搜索；旧查询继续。

## Open Questions

- 中文分词用 simple+trigram 还是 zhparser？先 simple+trigram，按效果再定。
- 是否引入 pgvector？按推荐/语义搜索需求，v1 可选。
- 搜索日志保留/隐私？默认脱敏、短保留。
- 是否支持跨资源统一排序？v1 按相关度/时间，权重可配。
