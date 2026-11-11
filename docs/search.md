# Search

统一搜索入口：`GET /api/search`。v1 用 PostgreSQL 全文（tsvector）+ trigram 兜底，
不引入外部搜索集群。

## 资源类型

| resourceKey | 来源表 | 标题 | 正文 | 标签 |
|---|---|---|---|---|
| `announcement` | `announcements` | title | body | announcement/status/audienceType |
| `asset` | `assets` | originalName | metadata.description | asset/kind/status |
| `ai_module` | `ai_modules` | name | description + prompt | ai_module/status/entities |
| `agent_knowledge` | `agent_knowledge_entries` | title（仅 published） | body | knowledge/scope/knowledgeKey |

索引只存可展示字段；`search_documents` 按 `(organizationId, resourceKey, resourceId)` 唯一。
敏感字段（密钥、原始文件、个人信息等）不进入索引。

## 索引管道

- 单条：`POST /api/search/index` `{ resourceKey, resourceId }`
- 全量：`POST /api/search/reindex`（同步，可重复执行）
- 事件：`announcement.published` 等 topic 经 `SearchIndexSubscriber` 转成 `search.index` 任务；
  worker 未启用时同步索引（本地开发不丢索引）。
- 任务类型：`search.index`（单条，重试 3 次）、`search.reindex`（全量，重试 2 次）。
- 幂等：内容 hash 未变不重写；索引失败不回滚业务。

## 查询

```
GET /api/search?q=课程&types=announcement,asset&tags=published&from=2026-01-01&page=1&pageSize=20
```

返回：

```json
{
  "items": [{
    "resourceKey": "announcement",
    "resourceId": "...",
    "title": "课程公告",
    "snippet": "这是 [[[课程]]] 公告",
    "tags": ["announcement", "published"],
    "rank": 0.6,
    "indexedAt": "..."
  }],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "tookMs": 5
}
```

- 全文命中按 `ts_rank` 排序；无全文命中时 `ILIKE`/trigram 兜底。
- `snippet` 用 `[[[` / `]]]` 标记高亮，前端按文本节点渲染（不注入 HTML）。
- `pageSize` 上限 50，`page` 上限 500；空关键词返回最近索引。
- 只查当前组织；跨租户由租户上下文/RLS 拒绝。

## 边界

- 搜索是**可重建读模型**，业务表仍是唯一真源；删除/重建索引不影响业务。
- 资源级数据范围/可见性由源模块负责；搜索 v1 只做组织隔离与字段白名单，
  打开结果后仍走源接口的权限与数据范围校验。
- 语义检索（pgvector）为可选后置能力，v1 不启用。
