## 1. 策略与运行表

- [x] 1.1 新建 DDL：`release_automation_policies`（organizationId、appKey、autonomy、enabled、allowedChangeClasses、guardrails、canaryStages、autoRollbackEnabled、consecutiveCleanRuns、lastReviewedAt、reviewedBy）
- [x] 1.2 新建 DDL：`release_automation_runs`（policyId、proposalId、releaseId、action、status、actorId、actorAgent、details、createdAt）
- [x] 1.3 唯一约束：每个 `organizationId + appKey` 一条 active policy
- [x] 1.4 新建 migration 与实体；更新 `contracts/schema-manifest.json` 与 `DOMAIN.md`

## 2. 白名单与策略校验

- [x] 2.1 定义 A2 白名单：帮助文案、字段提示、错误消息、changelog 措辞、菜单名称/图标、表单布局（不增删字段/不改校验）、校验消息、纯操作知识
- [x] 2.2 `ReleaseAutomationPolicyService.assertEligible()`：校验 `autonomy=A2`、`enabled=true`、变更类在白名单、提议证据齐全
- [x] 2.3 结构性变更（数据/流程/权限/工具/迁移）直接拒绝，返回 `DENIED` 与原因
- [x] 2.4 策略本身修改必须走人工审批，Agent 不得起草自动生效
- [x] 2.5 单测：白名单外拒绝；A1 拒绝；无证据拒绝；策略修改不能由 Agent 自动生效

## 3. 发布执行

- [x] 3.1 新建 `ReleaseAutomationService`：唯一执行 A2 发布/激活/回退的组件
- [x] 3.2 执行时强制 `actorAgent = null`；`actorId` 记策略服务或系统账号
- [x] 3.3 复用 Release 的 G0–G8；G5/G6 必须通过
- [x] 3.4 发布只到灰度（默认 5%），100% 激活仍需人工确认（可配置）
- [x] 3.5 每次动作写 `release_automation_runs` 与 `app_release_events`
- [x] 3.6 单测：Agent 无 publish 权限；A2 运行 `actorAgent` 为 null；结构性变更 0 次自动发布

## 4. 护栏与自动回退

- [x] 4.1 定义护栏指标：5xx、错误率、任务完成率下降、工具失败率、答疑差评率
- [x] 4.2 策略创建/修改时必须显式配置阈值；未配置则 `autoRollbackEnabled` 只能为 false
- [x] 4.3 观察窗口内轮询指标；超阈值触发回退评估
- [x] 4.4 自动回退必须检查目标 Release 存在、未 revoked、数据兼容
- [x] 4.5 回退写审计 + 通知 + `release_automation_runs`；不得修改旧 Release
- [x] 4.6 单测：无阈值时拒绝自动回退；目标不兼容时拒绝；回退不修改旧 Release

## 5. 复核与资格

- [x] 5.1 发布后 24h 内必须人工复核；未复核自动降回 A1
- [x] 5.2 连续 5 次无回退才保留 A2 资格；发生回退/护栏触发则计数清零
- [x] 5.3 季度审计报告：A2 使用范围、回退次数、结构性变更自动发布次数（必须为 0）
- [x] 5.4 一键关闭：`enabled=false` 立即停止 A2，所有进行中发布回到人工
- [x] 5.5 单测：未复核降级；回退清零；一键关闭后不再自动发布

## 6. 管理端与验收

- [x] 6.1 A2 策略页：开关、白名单、护栏阈值、灰度档位、连续无回退计数
- [x] 6.2 A2 运行记录页：谁触发、发布/回退/复核、证据、审计号
- [x] 6.3 验收演练：文案变更 A2 发布到 5% → 观察 → 回退演练 → 恢复；结构性变更被拒
- [x] 6.4 更新 `FLOWS.md`（护栏/复核 job）、`DECISIONS.md`（A2 边界）与 `DOMAIN.md`
- [x] 6.5 跑 `check:all` 与相关单测/E2E
