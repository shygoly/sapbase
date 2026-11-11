# Document Intelligence（文档智能）

文档是 untrusted 输入；解析只生成带锚点的结构化草案，人工确认后才转换到业务资源。

## 解析

`POST /api/document-intelligence/runs` `{assetId}` → parse run + `document.intelligence.parse` job。

支持的 parser：

| 类型 | 说明 |
|---|---|
| PDF | 文本层（BT/ET + Tj/TJ + flate 解压）；扫描件需 OCR provider（未配置时拒绝） |
| PPTX | 按 slide 排序提取 `<a:t>` |
| DOCX | `word/document.xml` 段落；Heading 样式映射为 Markdown 标题 |
| TXT/MD | UTF-8 文本 |

限制：`DOCUMENT_MAX_BYTES`（默认 20MB）、`DOCUMENT_MAX_PAGES`（默认 500）、zip 条目/解压上限；
拒绝 VBA/可执行内容；不执行宏/脚本/外链。

## 结构与锚点

- 标题：Markdown `#`、编号 `1.2`、`第X章/节`。
- 候选：`知识点/概念/定义/要点/掌握/理解` 行或 bullet；每个候选必须有
  `anchor {page,line,quote}`；置信度 < 0.6 标 `lowConfidence`。
- PII 脱敏：候选正文/quote 中手机号/身份证/邮箱替换为占位符。
- 文档内容作为 untrusted 数据，不执行文档内指令。

## 草案编辑

- `GET /runs/:id` 返回 run + sections + candidates。
- `PATCH /candidates/:id` 编辑标题/正文/状态/置信度。
- `POST /runs/:id/sections/merge|split|reorder`。
- 每次编辑 `draftVersion += 1`；候选合并/拆分保留/分配锚点。

## 确认与转换

1. `POST /runs/:id/candidates/confirm` 批量接受候选。
2. `POST /runs/:id/confirm` 锁定 `confirmedVersion = draftVersion`。
3. `POST /runs/:id/convert`：

```json
{ "targetResourceKey": "course", "packageId": "erp-course", "entity": "CourseSection" }
```

- `knowledge` → `agent_knowledge_entries` draft；
- `course`/`section` → `blueprint_records`（需要 packageId）。
- `(runId,candidateKey)` 幂等；重复转换不新增；已转换到其他资源返回 409。

## 异步与审计

- 任务类型 `document.intelligence.parse`；进度/取消/重试走 async-job。
- 审计：`document.run/edit/convert`（操作者、run、锚点、目标）。
- 旧知识/课程/导入/CRUD 不变。
