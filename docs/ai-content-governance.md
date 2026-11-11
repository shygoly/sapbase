# AI 内容治理（AI Content Governance）

AI 生成/辅助内容必须可追溯、可标识、可检测、可终审；复用 review/asset/audit，不新建第二套审核引擎。

## 溯源

`POST /api/ai-governance/provenance`：

```json
{
  "contentId": "uuid",
  "contentType": "text",
  "producer": "piagent-builder",
  "content": "正文",
  "agent": "piagent-builder",
  "model": "deepseek-chat",
  "prompt": "不会明文保存",
  "taskId": "job-id",
  "parentContentId": "上一版 uuid"
}
```

- `contentHash` 由正文计算；`promptHash` 只保存 SHA-256。
- 编辑/重生成追加新 version 与 `parentContentId`，旧版本保留。
- `GET /api/ai-governance/provenance/:contentId` 返回版本链。

## 标识

- `POST /labels` `{contentId,labelType: explicit|implicit,text?}` 版本化应用。
- `POST /labels/verify` 校验最新标识已应用且非空。
- 默认文本 `AI_CONTENT_LABEL_TEXT=AI 生成内容`。
- 未应用显式/隐式标识的内容发布/导出闸拒绝（`label_missing:explicit|implicit`）。

## 内容安全

- `content-safety` 实现 review `CheckProvider`：`pass/warn/fail`。
- 违规指令/危险内容 → `fail`；手机号/身份证/邮箱 → `warn`；异常/超时由 review 平台 fail-closed。
- `POST /review/submit` 创建终审链：check → content-reviewer → content-final-reviewer。
- `finalStep + subjectAuthor` 保证作者不能自我终审。

## 发布/导出闸

`GET /api/ai-governance/gate/:contentId`：

```json
{ "allowed": false, "reason": "label_missing:explicit" }
```

- 无 provenance → `allowed=true`（非 AI/旧内容不强制）。
- 有 provenance → 显式+隐式标识 applied + 最新轮次全部 approved。
- AI 模块发布接口在 `publish` 前调用同一闸。

## 评分

`POST /scores` 创建 `ai_only` AI 参考分；教师 `confirm` 后 `teacher_confirmed`；
学生 `appeal` 后 `appealed`；终审 `final`。AI 分与人工分分开存储/展示。
确认人不能自我终审；规则版本用 `POST /scores/rule-confirm` 记录确认。

## 审计

`ai.provenance` / `ai.label.apply` / `ai.label.verify` / `ai.review.submit` /
`ai.score` / `ai.score.confirm` / `ai.score.appeal` / `ai.score.final` 全部写入审计链。

## 兼容

- 非 AI 内容无 provenance，不强制标识/检测。
- 旧内容正常读取；可标 legacy/unlabeled。
- 旧审批/评分流程不变。
