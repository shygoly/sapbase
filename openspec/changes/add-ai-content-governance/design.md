# Design: AI 内容治理

## Context

- 平台已有 `agent-knowledge` 的敏感信息检测/知识发布闸门、`agent-eval` 评测、
  `semantic-runtime` 审批链、`asset-pipeline` 资产处理（规划中）。
- 没有生成内容溯源、显式/隐式标识、水印、内容安全 provider、AI 评分治理。
- 教育项目要求生成内容标识（B-033）、机器初审—教师终审（B-034）、
  AI 评分规则确认（B-035）、发布审核（A-014）。

## Goals / Non-Goals

**Goals**

1. 每一份 AI 生成内容可追溯到任务、模型、提示词/模板与操作者。
2. 显式/隐式标识在页面、播放器、导出、转码、离线、分享链路保持。
3. 内容安全 provider 可插拔，检测失败 fail-closed。
4. 机器初审 + 人工终审卡点；未终审不得发布/归档为正式内容。
5. AI 评分与教师评分分离；AI 参考分不得直接作为正式成绩。
6. 申诉、规则确认、审计闭环。
7. 与资产/复核/审计/通知集成，不另建一套流程。

**Non-Goals**

- 不自研检测模型/水印算法；用 provider/插件。
- 不做法律认证/版权登记/DRM。
- 不改变知识库敏感信息检测与 Agent 评测。
- 不做跨平台内容分发/交易。

## Decisions

### D1：生成内容溯源

`ai_content_provenance`：

- `organizationId`、`appInstallationId?`
- `contentType`（`text` / `image` / `audio` / `video` / `document`）
- `resourceKey` + `resourceId`（业务记录/资产）
- `producerType`（`agent` / `model` / `human-assisted`）
- `agentKey`、`modelKey`、`modelVersion`
- `promptHash`、`templateKey`、`taskId`（job/agent run）
- `contentHash`、`parentContentId?`
- `createdBy`、`createdAt`、`metadata`

- 每次生成/导入 AI 内容写一条；后续编辑产生新版本/父链。
- 内容哈希用于追溯与标识校验；不存敏感 prompt 全文，存 hash + 模板引用。
- 查询：给定内容/资产 → 来源链、审核链、标识状态。

### D2：显式/隐式标识

`ai_content_labels`：

- `contentId`、`labelType`（`explicit` / `implicit`）
- `labelVersion`、`text`、`metadata`（JSONB）、`watermarkRef?`
- `status`（`pending` / `applied` / `verified` / `missing`）
- `appliedAt`、`verifiedAt`

规则：

- **显式**：页面/播放器/导出文件显示“AI 生成”标识；文本导出加页眉/页脚；
  视频加角标/片头/片尾（provider）。
- **隐式**：文件元数据（`AIGC` 字段/自定义 atom）、不可见水印、内容 ID；
  具体格式由 provider 决定，平台记录引用与校验结果。
- 标识版本化；内容重新生成/转码/导出必须重新应用并校验。
- 未应用标识的内容不得发布（可按内容类型配置）。

### D3：水印/标识钩子

资产管道事件：

```text
asset.ready → apply labels/watermark
asset.transcode → re-apply/verify
asset.export → re-apply/verify
offline.package → include manifest labels
share → include label metadata
```

- `ContentLabelProvider` 接口：`apply(content, labelSpec)`, `verify(content, expected)`。
- 文本/图片/音频/视频 provider 可不同；外部服务走插件/连接器。
- 失败：内容状态 `label_missing`，发布/导出被拒；不静默放行。
- 标识不替代版权/许可，只做合规标识。

### D4：内容安全 provider

```ts
interface ContentSafetyProvider {
  key: string
  supports(content: ContentRef): boolean
  scan(input: ScanInput): Promise<SafetyResult>
}

type SafetyResult =
  | { status: 'pass'; evidence?: unknown }
  | { status: 'warn'; categories: string[]; evidence?: unknown }
  | { status: 'fail'; categories: string[]; reason: string; evidence?: unknown }
```

- 检测输入（prompt/素材）与输出（生成内容）。
- `fail` 阻断；`warn` 需人工确认；provider 异常/超时 → `fail`（fail-closed）。
- 检测证据写审计；provider/version 可追溯。
- 与 `add-review-and-approval-platform` 的 `check` 步骤集成。

### D5：人工终审

- 复核流程：`check`（安全/规则）→ `human`（教师/审核人）→ `final`（授权终审）。
- 未整体 approved：内容状态 `pending_review`；不得发布、不得作为正式成绩。
- 终审人必须有权限；作者不能自我终审（可配置四眼原则）。
- 驳回/请求修改/重提沿用复核平台。
- 终审通过写 `ai_content_labels` 应用状态 + 发布许可。

### D6：AI 评分治理

`ai_score_records`：

- `organizationId`、`contentId`/`subjectType`+`subjectId`
- `aiScore`、`aiModel`、`aiScoredAt`
- `humanScore?`、`humanScoredBy?`、`humanScoredAt?`
- `status`：`ai_only` / `teacher_confirmed` / `appealed` / `final`
- `policyVersion`、`confirmedByStudentAt`

规则：

- 学生端必须区分“AI 参考分”和“教师评分”。
- 未经教师终审的 AI 评分：不得作为正式成绩、学术评价、纪律处分依据；
  只可用于自测分析、推荐、非正式徽章。
- 首次使用/规则更新：学生确认知悉 AI 评分参考性质与教师评分规则；
  记录 `policyVersion`、时间、用户。
- 申诉：学生发起 → 状态 `appealed` → 强制人工复核 → `final`。
- 教师可修改 AI 分；保留 AI/人工两值与修改理由。

### D7：审计与通知

- 生成、标识应用/校验、检测、终审、评分确认、申诉、修改写审计。
- 通知：待终审、检测失败、申诉、评分确认、规则更新。
- 通知走 `add-notification-center-and-announcements`。

### D8：兼容

- 非 AI 内容不强制标识；`legacy` 内容标记 `unlabeled/legacy`，不阻断旧数据读取。
- 未配置 provider 时：标识/检测步骤按“未配置”处理；生产发布策略可要求必须配置。
- 旧审批/评分流程不变；新字段可选。

## Data Model

```sql
ai_content_provenance (
  id uuid pk,
  "organizationId" uuid not null,
  "appInstallationId" uuid,
  "contentType" varchar(32) not null,
  "resourceKey" varchar(255) not null,
  "resourceId" varchar(128) not null,
  "producerType" varchar(32) not null,
  "agentKey" varchar(128),
  "modelKey" varchar(128),
  "modelVersion" varchar(64),
  "promptHash" varchar(64),
  "templateKey" varchar(128),
  "taskId" varchar(128),
  "contentHash" varchar(64) not null,
  "parentContentId" uuid,
  "createdBy" uuid,
  "createdAt" timestamptz not null default now(),
  metadata jsonb not null default '{}'
)

ai_content_labels (
  id uuid pk,
  "organizationId" uuid not null,
  "contentId" uuid not null,
  "labelType" varchar(16) not null,   -- explicit | implicit
  "labelVersion" varchar(32) not null,
  text varchar(512),
  metadata jsonb not null default '{}',
  "watermarkRef" varchar(255),
  status varchar(32) not null default 'pending',
  "appliedAt" timestamptz,
  "verifiedAt" timestamptz,
  unique ("contentId", "labelType", "labelVersion")
)

ai_score_records (
  id uuid pk,
  "organizationId" uuid not null,
  "subjectType" varchar(32) not null,
  "subjectId" varchar(128) not null,
  "contentId" uuid,
  "aiScore" numeric,
  "aiModel" varchar(128),
  "aiScoredAt" timestamptz,
  "humanScore" numeric,
  "humanScoredBy" uuid,
  "humanScoredAt" timestamptz,
  status varchar(32) not null default 'ai_only',
  "policyVersion" varchar(32),
  "confirmedByStudentAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
)
```

新表纳入 RLS；内容/资产权限与数据范围同样适用。

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| 标识被转码/导出剥离 | 每个处理/导出环节 verify；失败阻断；离线 manifest 校验 |
| 检测误报/漏报 | provider 可替换 + warn 人工确认 + 证据；不承诺 100% |
| AI 分数误用 | 状态机 + 前端双值显示 + 未终审禁止归档 |
| prompt/内容泄露 | 只存 hash/模板引用；审计脱敏 |
| provider 差异 | 接口 + 版本 + 证据；按内容类型降级/拒绝 |
| 旧内容 | legacy 标记；不强制回填；发布策略可配置 |
| 申诉滥用 | 权限/频率/审计；人工终审 |

## Migration Plan

1. 新增表 + RLS；接入资产/复核/通知。
2. 先生成内容（文本/图片），再接音视频水印 provider。
3. 先内容终审，再接 AI 评分治理/申诉。
4. 旧内容标记 legacy；新内容按策略启用。
5. 回滚：停用标识/检测/评分治理；旧流程继续。

## Open Questions

- 显式标识的文案/样式由平台还是租户配置？建议平台默认 + 租户可配。
- 隐式标识格式（元数据/水印）是否需要按客户合规要求定制？provider 支持。
- AI 评分规则确认是否每次规则变更都强制确认？建议是，记录版本。
- 是否允许教师完全覆盖 AI 分？允许，但保留 AI 原值/理由/审计。
