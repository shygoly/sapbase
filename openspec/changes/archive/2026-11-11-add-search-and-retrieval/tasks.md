## 1. 契约与元语

- [x] 1.1 `schemas/search.schema.json`（document/query/hit）
- [x] 1.2 META §3.15 + 不变量 34–38
- [x] 1.3 DOMAIN「搜索」+ check-domain-doc 0 error
- [x] 1.4 DECISIONS D-13

## 2. 存储与索引

- [x] 2.1 迁移 179430 + tsvector/trigram GIN
- [x] 2.2 可选，N/A：v1 不启用 pgvector，语义检索后置
- [x] 2.3 RLS 表清单 + e2e 跨租户 403
- [x] 2.4 `SearchDocument` + `SearchModule` 注册

## 3. 索引管道

- [x] 3.1 `SearchIndexSubscriber` 事件 → `search.index` job
- [x] 3.2 contentHash + 唯一键幂等；删除同步移除索引
- [x] 3.3 公告/素材/AI 模块/已发布知识四类适配（课程实体暂不存在）
- [x] 3.4 `search.reindex` job + `POST /search/reindex`
- [x] 3.5 job 重试 3/2 次；索引失败不回滚业务
- [x] 3.6 `search.service.spec.ts`（6 tests）

## 4. 查询

- [x] 4.1 `GET /api/search`
- [x] 4.2 tsvector + ILIKE/trigram 兜底
- [x] 4.3 ts_rank 排序 + indexedAt 次序
- [x] 4.4 `[[[`/`]]]` 高亮，前端按文本节点渲染
- [x] 4.5 空词返回最近索引；page≤500、pageSize≤50
- [x] 4.6 单测 + e2e 中文/模糊/空结果/高亮

## 5. 权限与数据范围

- [x] 5.1 组织隔离已实现；资源级 dataScope 打开源资源时由源模块执行（v1 边界，见 docs/search.md）
- [x] 5.2 预索引 scope 字段：v1 未落；搜索只做组织隔离，资源级可见性由源接口承担
- [x] 5.3 仅索引 title/body/tags/metadata 可展示字段
- [x] 5.4 e2e 随机组织头 403
- [x] 5.5 可选，N/A：v1 不落搜索日志

## 6. 可选语义检索

- [x] 6.1 可选，N/A：v1 不启用语义检索
- [x] 6.2 可选，N/A
- [x] 6.3 可选，N/A
- [x] 6.4 可选，N/A
- [x] 6.5 可选，N/A

## 7. UI/API 与兼容

- [x] 7.1 `/dashboard/search`
- [x] 7.2 `docs/search.md` + `searchApi`
- [x] 7.3 未改旧知识/Agent 检索路径
- [x] 7.4 新增模块，旧页面/查询未改
- [x] 7.5 validate 通过
- [x] 7.6 check-domain-doc / check-meta-docs 0 error
