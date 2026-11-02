## 1. 反馈采集

- [x] 1.1 新建 DDL：`agent_feedback`（organizationId、appKey、releaseId、cohort、userId、role、screen、traceId、toolCallIds、category、contentMasked、status、createdAt）
- [x] 1.2 新建 DDL：`agent_feedback_topics`（organizationId、appKey、topicKey、title、severity、evidence、status、linkedProposalId）
- [x] 1.3 新建 `POST /agent/feedback`：校验上下文、脱敏正文、自动带 `releaseId/cohort/screen/traceId/toolCallIds`
- [x] 1.4 反馈去重：同 org + app + screen + 相似文本 + 24h 内合并
- [x] 1.5 脱敏失败时只记结构化上下文，不记正文
- [x] 1.6 反馈读入模型时必须 nonce 包裹；单测注入内容不执行

## 2. 归并与议题

- [x] 2.1 `FeedbackTriageService`：按 app/screen/entity/字段/工具聚类
- [x] 2.2 标注影响角色、频次、严重度、是否重复、是否已有提议
- [x] 2.3 关联指标（表单放弃率、工具失败率等）
- [x] 2.4 输出候选议题；没有证据的议题不得创建提议
- [x] 2.5 单测：重复反馈合并；无证据议题被拒

## 3. Agent Profile 与工具网关

- [x] 3.1 在 `shared-schemas` / 工具契约中定义 `AgentProfile = 'piagent-runtime' | 'piagent-builder'`
- [x] 3.2 改造 `contracts-loader`：不再一律拒绝 `allowedAgents`，改为校验值合法
- [x] 3.3 `AgentToolRegistry.invoke()` / `confirm()` 接收 `agentProfile`；未在 `allowedAgents` 中即拒绝
- [x] 3.4 默认 profile 为 `piagent-runtime`，保证现有 Chat 调用兼容
- [x] 3.5 单测：Runtime 调 `builder_*` 被拒；Builder 调 `erp_*` 写工具被拒；未声明 profile 被拒

## 4. Builder 工具面

- [x] 4.1 `contracts/tools.json` 增加 6 个 `builder_*` 工具，写工具 `confirmation: required`，`allowedAgents: ["piagent-builder"]`
- [x] 4.2 `AGENT-TOOLS.md` 同步这 6 行；处理器指向真实 `backend/src/agent-builder/**` 符号
- [x] 4.3 `builder_feedback_list` / `builder_metrics_get` 只读，结果 `untrustedResult: true`
- [x] 4.4 `builder_proposal_create` 只写 `app_drafts` / `app_change_proposals`
- [x] 4.5 `builder_proposal_validate` 调用 `ReleaseValidationService` 的 G0–G6
- [x] 4.6 `builder_release_preview` 生成签名预览链接；业务用户不可见
- [x] 4.7 `builder_changelog_draft` 只生成草稿，不发布
- [x] 4.8 跑 `check-agent-tools`，确保契约/索引/处理器一致

## 5. 提议硬校验

- [x] 5.1 `ProposalService.create()` 服务端校验：证据、diff、风险、测试、回退、范围、作者
- [x] 5.2 无证据直接拒绝；自然语言 diff 直接拒绝
- [x] 5.3 提议只能改目标 app 的 draft；跨 app 直接拒绝
- [x] 5.4 高风险（权限/工具/知识/迁移）标记需要第二审批人
- [x] 5.5 单测：缺任一必填项拒绝；跨 app 拒绝；高风险缺第二审批人拒绝

## 6. 审批与职责分离

- [x] 6.1 服务端校验 `approverId !== createdBy` 且 `approverId !== createdByAgent`
- [x] 6.2 高风险变更需要 `security` 或 `tech_lead` 第二审批
- [x] 6.3 审批人修改后批准：保留原 diff、记录修改人、重新跑校验
- [x] 6.4 驳回必须写原因，原因回到提议
- [x] 6.5 单测：Agent 起草的提议不能被 Agent 批准；作者=批准人被拒

## 7. 治理台

- [x] 7.1 反馈列表：按 app/screen/严重度/状态筛选；显示脱敏正文与 trace
- [x] 7.2 议题视图：证据、影响角色、频次、关联提议
- [x] 7.3 提议详情：结构化 diff、证据、影响面、测试/评测、回退计划、闸门结果
- [x] 7.4 审批界面：批准/驳回/要求修改；展示作者（Agent+人）与批准人
- [x] 7.5 预览入口：签名短 TTL 链接；每次访问审计

## 8. ai_modules 与配置

- [x] 8.1 `ai_modules` 六步定义可作为 `ChangeProposal` 来源；不另起编辑器
- [x] 8.2 配置 `autonomy: A1` 默认；`A2` 关闭
- [x] 8.3 `builder.enabled=false` 时回到人工 `ai_modules` 流程
- [x] 8.4 更新 `DECISIONS.md`（D-4 作者≠批准人、Builder 边界）与 `DOMAIN.md`

## 9. 验收

- [x] 9.1 端到端演练：反馈 → 议题 → Builder 提议 → 校验 → 预览 → 人工批准 → 发布 → 业务看到
- [x] 9.2 Builder 不能批准/发布自己的提议（服务端拒绝）
- [x] 9.3 无证据提议被拒
- [x] 9.4 业务用户看不到预览
- [x] 9.5 审批人能看到 diff/证据/影响/回退
- [x] 9.6 `check:all` 与后端测试通过
