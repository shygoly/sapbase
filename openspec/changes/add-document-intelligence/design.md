# Design: 文档智能（解析 → 结构化 → 确认）

## Context

- `add-asset-and-media-pipeline` 提供上传、扫描、预览、资产注册。
- `add-async-job-and-callback-facade` 提供异步解析/OCR/提取任务。
- `add-agent-knowledge-and-eval` 管理“已审核知识条目”，不是文档解析。
- `semantic-runtime` 提供实体校验/写入；`add-bulk-import-export-framework` 提供批量导入。
- 教育项目需要 PPT/PDF/Word → 章节/知识点候选 → 人工确认 → 生成课程实体。

## Goals / Non-Goals

**Goals**

1. 支持 PDF/PPTX/DOCX/TXT/MD 解析；扫描件可接 OCR。
2. 提取章节树、知识点候选、概念、关联、难度/标签，并保留来源锚点。
3. 人工可编辑/合并/拆分/排序/删除/确认，草案可版本化。
4. 确认后按映射生成业务实体，幂等、可重试。
5. 异步运行、进度、取消、历史、失败重试。
6. 安全处理不可信文档与提示词注入；审计/来源可追溯。

**Non-Goals**

- 不自研 OCR/版面/LLM 模型；用 provider/插件。
- 不做自动发布（必须人工确认）。
- 不做任意格式（CAD/音视频字幕）v1。
- 不替代知识库/评测/课程业务模型。

## Decisions

### D1：解析器适配器

```ts
interface DocumentParser {
  key: string
  supports(mime: string): boolean
  parse(input: ParseInput): Promise<ParsedDocument>
}

interface ParsedDocument {
  pages: Array<{ index: number; text: string; blocks?: Block[] }>
  metadata: Record<string, unknown>
  warnings?: string[]
}
```

- 内置：PDF 文本层、PPTX 文本、DOCX 文本、TXT/MD。
- OCR/版面：外部 provider（可选）；扫描 PDF/图片走 OCR。
- 解析失败/超时 → 运行失败，可重试；不静默返回空结构。

### D2：结构提取

```ts
interface StructureExtractor {
  key: string
  extract(input: ExtractInput): Promise<StructureDraft>
}

interface StructureDraft {
  sections: Array<{
    key: string
    title: string
    level: number
    parentKey?: string
    anchors: SourceAnchor[]
  }>
  knowledgePoints: Array<{
    key: string
    title: string
    summary?: string
    concepts?: string[]
    relations?: Array<{ type: string; targetKey: string }>
    difficulty?: 'basic' | 'intermediate' | 'advanced'
    tags?: string[]
    anchors: SourceAnchor[]
    confidence?: number
  }>
}
```

- 规则提取（标题层级/编号） + LLM 提取（知识点/概念/关联）可组合。
- 每个候选必须有 `SourceAnchor`（page/paragraph/charRange），否则不可确认。
- 置信度低于阈值：标记“需人工确认”，不自动通过。
- 模型/提示词/版本记录；输出 schema 校验；非法输出拒绝。

### D3：草案与人工编辑

`document_parse_runs`：

- `organizationId`、`assetId`、`parserKey`、`extractorKey`、`status`
- `progress`、`error`、`modelKey`、`promptVersion`
- `createdBy`、`createdAt`、`finishedAt`

`document_sections` / `document_candidates`：

- 草案版本 `draftVersion`
- section：`runId`、`key`、`title`、`level`、`parentKey`、`order`、`anchors`
- candidate：`runId`、`key`、`title`、`summary`、`concepts`、`relations`、`difficulty`、`tags`、`anchors`、`confidence`、`status`（`candidate`/`confirmed`/`merged`/`split`/`rejected`）
- 人工操作：编辑、合并（保留来源）、拆分（分配锚点）、排序、删除/恢复。
- 草案可保存/丢弃；确认后锁定版本。

### D4：确认与转换

- 人工确认章节/知识点 → `draftVersion` 锁定。
- 映射：

```json
{
  "targetResourceKey": "blueprint:education:KnowledgePoint",
  "fields": {
    "title": "title",
    "summary": "summary",
    "difficulty": "difficulty",
    "chapterKey": "section.key"
  }
}
```

- 通过 `semantic-runtime`/导入适配器写入；幂等键 `(runId, sourceKey, targetResourceKey)`。
- 冲突：同名/唯一键冲突 → 返回可定位错误，人工处理；不静默覆盖。
- 转换后可继续走审批/发布（课程状态机）。

### D5：异步与进度

- 上传/选择文档 → 创建 parse run + job。
- 阶段：`queued` → `parsing` → `extracting` → `review_ready` → `confirmed`/`failed`。
- 进度/事件/取消/重试；大文档分页/分块。
- 并发/大小/页数限制；超限拒绝。

### D6：安全

- 文档是不可信输入：解析在受限进程/沙箱；不执行宏/脚本/外链。
- 提示词注入：文档内容作为 untrusted data 包裹；LLM 不得执行文档内指令。
- PII：最小化保存；预览/日志脱敏。
- 文件类型/大小/页数限制；zip bomb 防护（PPTX/DOCX）。
- 来源锚点不可伪造；确认后修改需审计。

### D7：来源与审计

- 每个候选保留 anchors（页/段落/字符范围）。
- 模型/提示词/版本/操作者/时间写审计；与 `ai_content_provenance` 对齐。
- 转换记录 `runId → 实体 ID` 映射，可回溯/重放。
- 草案/确认/转换动作写审计。

### D8：兼容

- 不改变现有知识库/课程/导入流程；新能力可选。
- 旧文档/知识不受影响；未确认的草案不进入业务实体。
- 回滚：停用解析；草案保留；已转换实体不回滚（需业务操作）。

## Data Model

```sql
document_parse_runs (
  id uuid pk,
  "organizationId" uuid not null,
  "appInstallationId" uuid,
  "assetId" uuid not null,
  "parserKey" varchar(64) not null,
  "extractorKey" varchar(64) not null,
  status varchar(32) not null,
  progress int not null default 0,
  "modelKey" varchar(128),
  "promptVersion" varchar(64),
  "draftVersion" int not null default 1,
  error text,
  "createdBy" uuid not null,
  "createdAt" timestamptz not null default now(),
  "finishedAt" timestamptz
)

document_sections (
  id uuid pk,
  "organizationId" uuid not null,
  "runId" uuid not null,
  "draftVersion" int not null,
  key varchar(128) not null,
  title varchar(512) not null,
  level int not null,
  "parentKey" varchar(128),
  "order" int not null default 0,
  anchors jsonb not null default '[]',
  unique ("runId", "draftVersion", key)
)

document_candidates (
  id uuid pk,
  "organizationId" uuid not null,
  "runId" uuid not null,
  "draftVersion" int not null,
  key varchar(128) not null,
  title varchar(512) not null,
  summary text,
  concepts jsonb not null default '[]',
  relations jsonb not null default '[]',
  difficulty varchar(16),
  tags jsonb not null default '[]',
  anchors jsonb not null default '[]',
  confidence numeric,
  status varchar(32) not null default 'candidate',
  "targetEntityId" varchar(128),
  unique ("runId", "draftVersion", key)
)
```

新表纳入 RLS；`assetId`/`runId` 继承组织。

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| 解析质量差 | 规则 + LLM 组合；置信度；人工确认；provider 可替换 |
| OCR 成本/延迟 | 异步 + 按需；只对扫描件启用 |
| 提示词注入 | 文档内容 untrusted 包裹；不执行文档指令；输出 schema 校验 |
| 超大文档 | 分页/分块/限制；取消/重试 |
| 来源锚点漂移 | 确认后锁定；修改需审计；保留原文版本 |
| 重复转换 | 幂等键 + 映射表；冲突可定位 |
| 人工工作量大 | 批量确认/合并/拆分；低置信度高亮 |

## Migration Plan

1. 新增表 + RLS + parser/extractor 接口。
2. 先接 PDF/PPTX/DOCX 文本解析 + 规则章节；再接 LLM 知识点提取。
3. 先教育知识点导入试点，再接课程/章节转换。
4. 接 OCR/版面 provider（按客户资料类型）。
5. 回滚：停用解析；草案/映射保留。

## Open Questions

- LLM 提取用平台模型网关还是外部 provider？建议走 ModelGateway，便于审计/预算。
- OCR/版面是否 v1 必须？按客户资料类型决定，先支持文本层 PDF。
- 转换是否直接写实体还是生成导入草案？建议先生成草案，人工确认后写入。
- 是否需要文档版本/重新解析？v1 支持重新解析为新 run，旧 run 保留。
