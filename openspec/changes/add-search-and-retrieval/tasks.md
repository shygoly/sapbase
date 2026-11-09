## 1. 契约与元语

- [ ] 1.1 定义 search-document/query/index-job 的 Schema
- [ ] 1.2 在 `docs/META_LANGUAGE.md` 登记搜索术语与不变量（INV-SE-01..05）
- [ ] 1.3 在 `DOMAIN.md` 新增搜索小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [ ] 1.4 在 `DECISIONS.md` 登记 PG 全文/trigram、可选向量、权限过滤

## 2. 存储与索引

- [ ] 2.1 迁移：`search_documents` + `tsv`/`pg_trgm`/GIN
- [ ] 2.2 可选 `pgvector` 列/索引（feature flag）
- [ ] 2.3 RLS/索引；跨租户负例
- [ ] 2.4 TypeORM 实体/模块注册

## 3. 索引管道

- [ ] 3.1 事件 → job 构建 SearchDocument
- [ ] 3.2 upsert/delete 幂等
- [ ] 3.3 资源类型适配（素材/课程/知识点/公告/知识）
- [ ] 3.4 全量重建/对账 job + 进度/取消
- [ ] 3.5 失败重试/告警；不影响业务写入
- [ ] 3.6 单测：增删改、重建、幂等、失败重试

## 4. 查询

- [ ] 4.1 `GET /search`：关键词/类型/标签/时间/分页
- [ ] 4.2 全文 + trigram 兜底
- [ ] 4.3 排序/权重（标题/标签/正文）
- [ ] 4.4 高亮/片段/转义
- [ ] 4.5 空结果/降级/最大页
- [ ] 4.6 单测：中文、模糊、空词、高亮

## 5. 权限与数据范围

- [ ] 5.1 查询前解析可见范围
- [ ] 5.2 预索引 scope 字段/实时谓词
- [ ] 5.3 字段级脱敏/不索引敏感字段
- [ ] 5.4 跨租户/越权负例
- [ ] 5.5 搜索日志（可选、脱敏）

## 6. 可选语义检索

- [ ] 6.1 `EmbeddingProvider` 接口
- [ ] 6.2 向量生成/存储/索引（feature flag）
- [ ] 6.3 语义查询 + 权限过滤
- [ ] 6.4 成本/延迟/开关
- [ ] 6.5 单测/开关关闭路径

## 7. UI/API 与兼容

- [ ] 7.1 Portal 搜索框/结果页/高亮
- [ ] 7.2 API 文档与 `api-client`
- [ ] 7.3 旧知识/Agent 检索不变
- [ ] 7.4 旧查询/页面不受影响
- [ ] 7.5 `openspec validate add-search-and-retrieval --strict`
- [ ] 7.6 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
