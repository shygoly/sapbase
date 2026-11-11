# Design: 复核/审批与工作项平台

## Context

已核对的现状：

- `apps/api/src/semantic-runtime/approval.ts`：
  - `ApprovalStepDecl { role: string }`，步骤只有角色；
  - `applyApprove` 只处理 approve；没有 reject/request-changes/resubmit；
  - `chainStatusOf` 能表达 rejected，但没有写入 rejected 的动作。
- `blueprint_approvals` 一行一个步骤：
  `(recordId, ruleId, stepIndex)` 唯一，字段只有 `role/status/actor/decidedAt`。
- `inbox.service.ts` 只查 `blueprint_approvals` 的 pending 行，按当前用户 `role` 过滤。
- `notification-outbox` 已有持久通知、审批待办、事件投递与幂等。
- `docs/protocols/workflow-consolidation.md` 已让旧 workflow 四表退场；
  不能复活 `add-workflow-engine` / `refactor-workflow-to-ddd`。

## Goals / Non-Goals

**Goals**

1. 在现有审批链上支持机器检测 + 多级人工复核。
2. 支持 approve / reject / request-changes / resubmit / delegate / comment / attach。
3. 审批人可以是角色、用户、岗位；岗位可按记录的数据范围节点动态解析。
4. 提供通用 work item 投影，聚合审批、复核、教学任务、申诉等待办。
5. 保留完整轮次与操作历史；SLA、提醒、升级。
6. 旧审批定义与旧数据行为不变。

**Non-Goals**

- 不做 BPMN/通用工作流引擎、并行分支、补偿事务、子流程。
- 不做跨系统编排（由 `add-external-integration-connector` 负责）。
- 不做内容安全检测算法（由 provider/插件提供）。
- 不把 `work_items` 变成审批状态的第二真源。

## Decisions

### D1：扩展现有审批模型，不另建 workflow

- 继续以 `blueprint_approvals` 为审批步骤真源；
- 增加 `round`（轮次）、`kind`（`human` / `check`）、`selector`（JSONB）、
  `assignee`、`checkProvider`、`checkResult`、`comment`、`decidedBy`、`dueAt` 等列；
- 唯一约束改为 `(recordId, ruleId, round, stepIndex)`；
- 旧行迁移为 `round=1, kind='human', selector={kind:'role', role:<旧role>}`。

### D2：步骤类型

```ts
type ReviewStepKind = 'human' | 'check'

type AssigneeSelector =
  | { kind: 'role'; roleId: string }
  | { kind: 'user'; userId: string }
  | { kind: 'position'; positionKey: string; dimension?: string; anchor: 'record' | 'fixed'; nodeId?: string }
  | { kind: 'creator' }
```

- `human`：按 selector 解析审批人；`anchor='record'` 时用记录上的数据范围绑定
  （如 `classId`）找到节点，再找该节点上 `positionKey` 的成员；
- `check`：机器检测步骤，不产生人工待办，由 job facade 异步执行；
- 步骤串行；v1 不支持并行/会签。需要会签时用多个用户 selector + 同一节点成员集合，
  但“任一人通过”还是“全部通过”留到后续。

### D3：机器检测步骤

```ts
interface CheckProvider {
  key: string
  run(input: CheckInput): Promise<CheckResult>
}

type CheckResult =
  | { status: 'pass'; evidence?: unknown }
  | { status: 'warn'; message: string; evidence?: unknown }
  | { status: 'fail'; message: string; evidence?: unknown }
```

- `check` 步骤通过 `add-async-job-and-callback-facade` 执行；
- `pass` → 进入下一步；
- `fail` → 阻断，记录原因，作者可修改后重新提交；
- `warn` → 需人工确认（下一步或同一用户确认），不能静默通过；
- provider 异常/超时 → `fail`（fail-closed）；
- provider 必须有 key、版本、输入/输出证据，写审计。

### D4：人工动作与轮次

| 动作 | 效果 |
|---|---|
| `approve` | 当前步骤 approved；推进到下一步；全部通过 → 整体 approved |
| `reject` | 当前步骤 rejected；整体 rejected；作者可修改 |
| `request-changes` | 不判死，整体回到作者；作者修改后 `resubmit` |
| `resubmit` | 创建新 round；旧 round 只读；步骤重置为 pending |
| `delegate` | 当前步骤委托给他人；受委托人可代为决定；审计记录原/受委托人 |
| `comment` | 追加评论/附件，不改变步骤状态 |

- 只有当前 pending 步骤的合法审批人可操作；越权返回 403。
- 每次动作写 `review_events`（append-only）+ `audit_logs`。
- 整体 approved 后才能触发发布/状态迁移；rejected/request-changes 阻断。

### D5：通用 work item 投影

`work_items` 是统一待办读模型：

- `sourceType`：`approval` / `review` / `task` / `appeal` / `export` 等；
- `sourceId`、`assignee`、`title`、`status`、`priority`、`dueAt`、`metadata`；
- 唯一键：`(organizationId, sourceType, sourceId, assignee)`；
- 状态由源业务事件更新（outbox / 事务内写）；源表仍是真源；
- 现有审批待办可由 `work_items` 读，也可在迁移期回退到 `blueprint_approvals`；
- 支持批量已读/处理、红点/角标、按紧急程度排序。

### D6：动态审批人与数据范围

- `position` selector 依赖 `add-generic-data-scope-authorization`：
  - 记录声明 `dataScope.bindings`（如 `classId → class`）；
  - 取记录绑定节点，在 `scope_memberships` 中找 `positionKey` 的活跃成员；
  - 找不到审批人 → 该步骤阻塞并告警（fail-closed），不能自动跳过。
- 角色 selector 仍按组织内 active 角色解析；用户 selector 直接指定。
- 审批人解析结果写入 `assignee`，避免每次重算；成员变更时可重新解析未决步骤。

### D7：SLA、提醒与升级

- 步骤可声明 `slaHours`、`dueAt`；到期前/到期后发通知；
- 到期未处理可按策略升级到上一级角色/岗位；
- 提醒/升级通过 `notification-center-and-announcements`；
- 提醒必须幂等（每个步骤每个时间窗只发一次），避免风暴。

### D8：评论、附件与审计

- `review_comments`：`requestId`、`round`、`stepIndex`、`author`、`body`、`attachments`（assetId）。
- `review_events`：`requestId`、`round`、`stepIndex`、`action`、`actor`、`before/after`、`comment`、`createdAt`。
- 附件走 `add-asset-and-media-pipeline`；权限与数据范围沿用资产规则。
- 发布/迁移审计保留审批链快照（规则、步骤、决策人、时间、证据）。

### D9：兼容与迁移

- 现有 `POST /approvals/:ruleId/approve` 继续可用；
- 旧 `role` 字段保留并映射到 `selector`；
- 旧 `blueprint_approvals` 行补 `round=1, kind='human'`；
- 旧 `inbox` 行为不变；新 `work_items` 逐步接管；
- 未声明 `check`/SLA/委托的旧模板按原串行角色审批执行。

### D10：失败方向

- 找不到审批人、provider 失败、步骤配置非法、越权操作 → 拒绝/阻塞，不自动通过。
- `warn` 必须有人确认；不能把 warn 当 pass。
- 发布/状态迁移在整体 approved 前一律拒绝。

## Data Model

```sql
-- 扩展 blueprint_approvals
ALTER TABLE blueprint_approvals
  ADD COLUMN round int NOT NULL DEFAULT 1,
  ADD COLUMN kind varchar(16) NOT NULL DEFAULT 'human',
  ADD COLUMN selector jsonb,
  ADD COLUMN assignee varchar(255),
  ADD COLUMN "checkProvider" varchar(128),
  ADD COLUMN "checkResult" jsonb,
  ADD COLUMN comment text,
  ADD COLUMN "decidedBy" varchar(255),
  ADD COLUMN "dueAt" timestamptz;
-- 旧唯一约束改为 (recordId, ruleId, round, stepIndex)

review_comments (
  id uuid pk,
  "organizationId" uuid not null,
  "recordId" uuid not null,
  "ruleId" varchar(128) not null,
  round int not null,
  "stepIndex" int not null,
  author varchar(255) not null,
  body text not null,
  attachments jsonb not null default '[]',
  "createdAt" timestamptz not null default now()
)

review_events (
  id uuid pk,
  "organizationId" uuid not null,
  "recordId" uuid not null,
  "ruleId" varchar(128) not null,
  round int not null,
  "stepIndex" int not null,
  action varchar(32) not null,
  actor varchar(255) not null,
  before jsonb,
  after jsonb,
  comment text,
  "createdAt" timestamptz not null default now()
)

review_delegations (
  id uuid pk,
  "organizationId" uuid not null,
  "recordId" uuid not null,
  "ruleId" varchar(128) not null,
  round int not null,
  "stepIndex" int not null,
  "fromUser" varchar(255) not null,
  "toUser" varchar(255) not null,
  "validFrom" timestamptz,
  "validTo" timestamptz,
  reason text,
  "createdAt" timestamptz not null default now()
)

work_items (
  id uuid pk,
  "organizationId" uuid not null,
  "sourceType" varchar(32) not null,
  "sourceId" varchar(128) not null,
  assignee varchar(255) not null,
  title varchar(512) not null,
  status varchar(32) not null,
  priority int not null default 0,
  "dueAt" timestamptz,
  metadata jsonb not null default '{}',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("organizationId", "sourceType", "sourceId", assignee)
)
```

所有新表纳入 RLS；`work_items` 按组织隔离，查询按 assignee/status/priority 建索引。

## Flows

### 提交复核

```text
submit(record, rule)
  → 创建 round=1 的步骤
  → 第一个步骤：
      check → enqueue job，等待结果
      human → 解析 assignee，写 work_item，发通知
  → check pass → 下一步
  → check fail → 整体 blocked，通知作者
```

### 人工决策

```text
approve/reject/request-changes
  → 校验当前步骤 + assignee/role/position
  → 写 review_events + 更新步骤
  → approve：推进；全部通过 → approved
  → reject/request-changes：整体 blocked；作者可 resubmit
  → 通知作者/下一审批人；更新 work_items
```

### 重新提交

```text
resubmit(record, rule)
  → 校验作者/权限
  → 新 round = max+1
  → 旧 round 只读
  → 步骤重置 pending；重新跑 check / 解析 assignee
```

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| 动态审批人解析失败 | 阻塞并告警，不自动跳过；配置校验 + 预览 |
| 机器检测误判 | 保留 evidence；warn 必须人工确认；provider 可替换 |
| 待办投影不一致 | 源表为真源；事件驱动更新；提供重建/对账 job |
| SLA 提醒风暴 | 幂等提醒键 + 时间窗 + 升级策略 |
| 旧审批兼容 | 旧字段映射 + 默认 round/kind + 旧接口保留 |
| 审批人离职/调岗 | 未决步骤可重新解析 assignee；委托/管理员兜底 |
| 绕过发布卡点 | semantic runtime 在整体 approved 前拒绝发布/迁移 |

## Migration Plan

1. 扩展 `blueprint_approvals` 列与唯一约束；旧行回填。
2. 新增 `review_comments/review_events/review_delegations/work_items`。
3. 保留旧 approve API；新 API 逐步接入。
4. `inbox` 先双读（work_items + approvals），再切主路径。
5. 回滚：停用新步骤类型；旧字段仍可工作。

## Open Questions

- 会签/或签是否需要？v1 先串行，按客户需求再加。
- 机器检测 provider 是内置还是插件？v1 用接口 + 内置规则，外部走插件。
- 审批人解析是“任一成员”还是“全部成员”？v1 任一；会签后置。
- work item 是否包含导出任务、通知？v1 先审批/复核/教学任务，导出后续接入。
