## 1. 知识与技能表

- [x] 1.1 新建 DDL：`agent_knowledge_entries`（organizationId 可空、scope、scopeId、knowledgeKey、version、title、body、status、releaseId、sensitiveReview）
- [x] 1.2 新建 DDL：`agent_skill_versions`（organizationId、skillKey、version、digest、status、releaseId）
- [x] 1.3 建唯一约束：同一 `scope + scopeId + knowledgeKey + version` 唯一；同一 `skillKey + version` 唯一
- [x] 1.4 新建 migration 与 TypeORM 实体
- [x] 1.5 更新 `contracts/schema-manifest.json` 与 `DOMAIN.md`（含 `INV-AGENT-09` 知识只走发布）

## 2. 知识生命周期

- [x] 2.1 `KnowledgeService.createDraft()`：写入 `status='draft'`，记录 scope 与来源证据
- [x] 2.2 `KnowledgeService.submit()` / `review()`：审核人 ≠ 起草人；审核意见留痕
- [x] 2.3 `KnowledgeService.publish()`：发布新版本；同 `scope + scopeId + knowledgeKey` 的旧 active 版本置为 `superseded`
- [x] 2.4 `KnowledgeService.rollback()`：重新发布旧版本内容为新版本，不修改历史行
- [x] 2.5 知识版本变更写 `app_release_events` 或知识审计表，可追溯
- [x] 2.6 单测：未发布不可检索；旧版本 superseded 后仍可查；回退产生新版本

## 3. 敏感信息闸门

- [x] 3.1 实现 `SensitiveInfoDetector`：手机号、证件号、邮箱、姓名、机构名、合同片段
- [x] 3.2 `publish()` 必须逐条确认检测结果；`sensitiveReview` 记录确认人与结果
- [x] 3.3 检测组件异常时拒绝发布（fail-closed），不得放行
- [x] 3.4 敏感信息也检查 changelog 与示例数据
- [x] 3.5 单测：检测到未确认信息拒绝；检测异常拒绝；确认后可发布

## 4. 知识检索与回答

- [x] 4.1 `agent-kernel` 增加 `filterKnowledge()`：按 `releaseId`、scope、用户可见性过滤
- [x] 4.2 只返回 `status='published'` 且未被 superseded（或当前 active）的版本
- [x] 4.3 Context Envelope 的 `knowledge` 只放摘要与分数，不放全文
- [x] 4.4 Answer 引用知识时写 `[kn:<id>@<version>]`；无依据时说“不知道”
- [x] 4.5 回答记录 `knowledgeVersion`；未发布知识不得出现
- [x] 4.6 E2E：发布知识 → Runtime 回答引用 → 回退知识 → 回答恢复旧口径

## 5. 评测用例与运行

- [x] 5.1 新建 DDL：`agent_eval_cases`、`agent_eval_runs`
- [x] 5.2 建立黄金集：`faq`、`navigate`、`query`、`write`、`refusal`、`injection`、`release`
- [x] 5.3 实现 `EvalRunner`：固定模型版本、温度 0、固定种子；逐例记录通过/失败与原因
- [x] 5.4 结果写入 `agent_eval_runs`，绑定 `releaseId + skillVersion`
- [x] 5.5 模型/提示词变更也必须跑同一套件
- [x] 5.6 单测：评测结果可重复；失败原因可读

## 6. G5 与发布闸门

- [x] 6.1 `ReleaseValidationService` 接入 G5：涉及 Agent/工具/技能的 Release 必须跑评测
- [x] 6.2 硬门槛：写操作越权/未确认 = 0；注入套件 = 100%；不达标直接拒绝发布
- [x] 6.3 其他指标门槛：工具选择 ≥ 95%、参数 ≥ 95%、答疑引用 ≥ 90%、拒答 ≥ 95%
- [x] 6.4 回归阈值：相对上一版本下降 > 2% 拒绝发布
- [x] 6.5 G5 结果写入发布详情；`notApplicableReason` 仅在确实不涉及 Agent 时允许
- [x] 6.6 单测：硬门槛失败拒绝；回归超阈值拒绝；不涉及 Agent 时不适用

## 7. 管理端与验收

- [x] 7.1 知识管理页：列表、版本历史、scope、状态、敏感审核结果
- [x] 7.2 发布详情页展示 G5 报告（套件、通过率、失败样例）
- [x] 7.3 验收：未发布知识不进回答；注入 100%；写越权 0；回退知识恢复旧口径
- [x] 7.4 更新 `DECISIONS.md`（知识只追加、发布闸门）与 `FLOWS.md`（评测 job，如启用）
