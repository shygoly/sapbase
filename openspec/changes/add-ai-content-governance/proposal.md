# Change: AI 内容治理

## Why

平台已有 Agent 会话、工具契约、知识/评测与审批基础，但对“AI 生成内容”缺少治理：

- 没有生成内容的来源/模型/提示词/任务溯源；
- 没有显式/隐式标识、水印，下载/离线/分享/导出/转码后可能丢失；
- 没有统一的内容安全 provider（机器检测）与人工终审卡点；
- 没有“AI 参考分 vs 教师评分”的状态与规则确认，AI 分数可能被当成正式成绩；
- 没有申诉与审计闭环。

教育项目 A-014、B-015、B-033—B-035 明确要求生成内容标识、机器初审—教师终审、
AI 评分参考性质与规则确认。这是 AI 原生平台的通用合规能力，不是教育专属。

## What Changes

- **ADDED** `ai-content-governance`：
  - 生成内容溯源记录：生产者、模型/版本、提示词/模板、生成任务、时间、内容哈希、父内容。
  - 显式标识（页面/播放器/导出文件）与隐式标识（元数据/水印/内容 ID）。
  - 水印/标识钩子：资产处理、转码、导出、离线包、分享链路保持标识。
  - 内容安全 provider 接口：文本/图片/音频/视频检测，`pass/warn/fail`，fail-closed。
  - 人工终审：机器检测 → 人工复核 → 发布/归档；未终审不得作为正式内容/成绩。
  - AI 评分治理：`ai_only` / `teacher_confirmed` / `appealed` / `final` 状态；
    首次使用/规则更新确认；AI 参考分不得直接归档为正式成绩。
  - 申诉：学生对 AI 评分/内容发起申诉，强制转人工复核。
- **MODIFIED** 资产与复核：资产处理管道增加标识/水印钩子；复核平台增加机器检测与终审动作。
- **NOT CHANGED** 现有知识库敏感信息检测、Agent 评测、审批链、资产管道。
- **NON-GOALS** 自研内容检测模型、法律认证、完整 DRM、跨平台版权交易。
- **BREAKING** 无。未声明 AI 治理的内容/流程行为不变。

## Impact

- 受影响规格：`ai-content-governance`（新增）、`asset-pipeline`（钩子）、`review-approval`（终审）
- 受影响代码：
  - 新模块 `apps/api/src/ai-governance/**` 或 `libs/platform-core/src/ai-governance/**`
  - `apps/api/src/asset*`（水印/标识钩子）
  - `apps/api/src/semantic-runtime/**`（内容发布卡点）
  - `apps/web-portal` / `web-console` 标识、终审、评分状态
  - `DOMAIN.md`、`DECISIONS.md`
- 依赖：`add-asset-and-media-pipeline`（资产/水印）、`add-review-and-approval-platform`
  （机器检测/终审）、`add-async-job-and-callback-facade`（检测/水印任务）、
  `add-audit-compliance-and-tamper-evidence`（审计）。
- 迁移：新增表/字段；旧内容标记 `legacy`，不强制回填标识。
- 风险：标识被转码/导出剥离、检测误报、AI 分数误用、provider 差异、性能。
