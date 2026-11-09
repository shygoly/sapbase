# Change: 复核/审批与工作项平台

## Why

现有审批只覆盖 Blueprint 记录的“角色 → 步骤 → approve”：

- `semantic-runtime/approval.ts` 只有 `applyApprove`，没有驳回、要求修改、重新提交、评论、附件；
- 步骤只有 `role`，没有机器检测、用户/岗位指定、委托、SLA、升级；
- `inbox.service.ts` 只列 Blueprint 审批，无法聚合教学任务、内容复核、学生申诉等通用工作项；
- 教育项目需要“机器初审—教师终审”、多级复核、驳回重提、终审卡点、申诉与待办聚合。

旧 `add-workflow-engine` / `refactor-workflow-to-ddd` 已与 workflow 退场方向冲突，不能复活。
本变更在现有审批链上扩展，不另建 workflow 引擎。

## What Changes

- **ADDED** `review-approval`：通用复核/审批能力
  - 步骤类型：`human`（角色/用户/岗位）与 `check`（机器检测）。
  - 动作：approve / reject / request-changes / resubmit / delegate / comment / attach。
  - 轮次（round）与完整历史；驳回后修改重提，不覆盖历史。
  - 动态审批人：按记录的数据范围节点解析岗位/角色成员（如“该班的班主任”）。
  - SLA、到期提醒、升级、委托。
- **ADDED** 通用工作项（work item）投影：聚合审批、复核、教学任务、申诉等待办；
  来源仍是各自业务表，work item 只做统一读模型，不成为第二真源。
- **ADDED** 机器检测 provider 接口：内容安全、规则校验、AI 初审等通过异步任务执行；
  `fail` 阻断、`warn` 需人工确认；provider 失败按 fail-closed 处理。
- **ADDED** 评论/附件/审计：每一步的决策、理由、附件、耗时与操作者留痕。
- **MODIFIED** 语义运行时：Blueprint 审批链接入新步骤模型；发布/状态迁移只在整个复核通过后放行。
- **MODIFIED** 待办：`inbox` 从“只读 blueprint_approvals”扩展为通用 work item 查询，
  现有审批待办行为保持兼容。
- **NOT CHANGED** 现有 `blueprint_approvals` 表名与既有审批数据；新增字段与轮次兼容迁移。
- **NON-GOALS** BPMN/通用工作流引擎、并行分支、补偿事务、子流程、跨系统编排。
- **BREAKING** 无。旧审批定义未声明新字段时按原行为执行。

## Impact

- 受影响规格：`review-approval`（新增）、`semantic-runtime`、`notification-outbox`（待办扩展）
- 受影响代码：
  - `apps/api/src/semantic-runtime/{approval,blueprint-approval.entity,blueprint-approval.ddl}.ts`
  - `apps/api/src/notifications/{inbox.service,notification-subscriber}.ts`
  - 新模块 `apps/api/src/review/**` 或 `libs/platform-core/src/review/**`
  - `apps/web-portal` 待办/复核页、`apps/web-console` 审批配置
  - `DOMAIN.md`、`DECISIONS.md`、`docs/protocols/blueprint-delivery.md`
- 依赖：`add-async-job-and-callback-facade`（机器检测异步执行）、
  `add-generic-data-scope-authorization`（动态审批人按记录范围解析）、
  `add-notification-center-and-announcements`（提醒/升级）。
- 迁移：给 `blueprint_approvals` 增加 `round/kind/assignee/checkResult/comment` 等列，
  旧行按 `round=1, kind='human'` 回填；新增 `work_items` 投影表。
- 风险：动态审批人解析失败、机器检测误判、待办投影不一致、SLA 提醒风暴。
