# Change: 文档智能（解析 → 结构化 → 确认）

## Why

教育项目需要从 PPT/PDF/Word/文本中提取标题、章节、知识点、概念与关联，
形成可编辑/合并/拆分/排序/确认的结构，再生成课程/知识点实体（B-002、B-007—B-009）。
平台已有资产上传（规划）、知识条目/评测、Agent Runtime，但没有：

- 文档解析与版面/章节结构提取；
- 知识点候选与来源锚点（页码/段落）；
- 人工确认/合并/拆分/排序后转换为业务实体；
- 解析任务进度、失败重试、审计。

这是 AI 原生平台的通用“非结构化文档 → 结构化业务数据”能力，不是教育专属。

## What Changes

- **ADDED** `document-intelligence`：
  - 文档接入：PDF / PPTX / DOCX / TXT / MD；OCR provider 可选（扫描件/图片）。
  - 解析：标题/章节/段落/表格/图片；来源锚点（页/段落/字符范围）。
  - 结构化提取：章节树、知识点候选、关键概念、关联、难度/标签；置信度。
  - 人工编辑：查看/编辑/合并/拆分/排序/删除/确认；草案版本。
  - 转换：按声明式映射生成 Blueprint 实体（课程/章节/知识点等）；幂等、可重试。
  - 异步运行：进度/取消/重试/历史；大文件/多文档。
- **ADDED** 解析器/提取器 provider 接口：本地规则 + LLM/OCR 可替换。
- **ADDED** 来源与审计：每个候选可回溯到源文件/页/段落；模型/提示词/版本可追溯。
- **MODIFIED** 资产管道：文档资产可触发解析任务；解析结果作为资产/记录保存。
- **NOT CHANGED** 知识库条目/评测、Agent 会话、资产上传、语义运行时校验。
- **NON-GOALS** 自研 OCR/版面模型、任意格式（CAD/视频字幕）解析、自动发布不经人工确认。
- **BREAKING** 无。新能力可选；未启用时旧知识/课程流程不变。

## Impact

- 受影响规格：`document-intelligence`（新增）、`asset-pipeline`（触发）、`semantic-runtime`（转换）
- 受影响代码：
  - 新模块 `apps/api/src/document-intelligence/**` 或 `libs/platform-core/src/document-intelligence/**`
  - `apps/api/src/assets/**`（文档解析触发）
  - `apps/api/src/semantic-runtime/**`（候选转换/写入）
  - `apps/web-portal` 文档解析/结构确认页
  - `DOMAIN.md`、`DECISIONS.md`
- 依赖：`add-asset-and-media-pipeline`（上传/预览）、`add-async-job-and-callback-facade`
  （解析/OCR/提取）、`add-ai-content-governance`（来源/标识/审核）、
  `add-review-and-approval-platform`（可选确认）、`add-audit-compliance-and-tamper-evidence`。
- 迁移：新增表；旧文档/知识不受影响。
- 风险：解析质量、OCR 成本、提示词注入、超大文档、来源锚点漂移、人工确认工作量。
