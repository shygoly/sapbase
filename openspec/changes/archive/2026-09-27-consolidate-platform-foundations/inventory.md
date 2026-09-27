# 旧工作流清点（W0）

> 范围：已装配的 `backend/src/workflows/` + 其拉起的 `workflow-context`。
> `workflow-context` **未**在 `app.module.ts` 直接装配，但经 `WorkflowsModule` 间接装配。
> 本轮不删旧代码。数据行数为本机实测（`backend/scripts/export-workflow-data.ts`）。

---

## 1. 前端：`workflows.api.ts` → 端点 → 组件

| API 函数 | 端点 | 使用方 |
| --- | --- | --- |
| `createWorkflow` | `POST /api/workflows` | `workflow-definition-editor` |
| `getWorkflows` | `GET /api/workflows` | `admin/workflows/page.tsx` |
| `getWorkflow` | `GET /api/workflows/:id` | **无组件调用**（仅 API 暴露） |
| `updateWorkflow` | `PATCH /api/workflows/:id` | `workflow-definition-editor` |
| `deleteWorkflow` | `DELETE /api/workflows/:id` | `workflow-definition-editor` |
| `startWorkflow` | `POST /api/workflows/:id/start` | **无组件调用**（仅 API 暴露） |
| `getInstances` | `GET /api/workflow-instances` | `workflow-instance-list` |
| `getInstance` | `GET /api/workflow-instances/:id` | `workflow-instance-viewer` |
| `executeTransition` | `POST /api/workflow-instances/:id/transition` | `workflow-transition-buttons`、`workflow-instance-viewer` |
| `cancelInstance` | `POST /api/workflow-instances/:id/cancel` | `workflow-instance-list` |
| `getHistory` | `GET /api/workflow-instances/:id/history` | `workflow-instance-viewer` |
| `getSuggestedTransitions` | `GET /api/workflow-instances/:id/suggested-transitions` | `workflow-instance-viewer` |

类型-only（不发请求）：

- `workflow-state-diagram`：吃传入的 `WorkflowDefinition`
- `workflow-history-timeline`：吃传入的 `WorkflowHistory[]`

后端还有 `GET /workflows/:id/instances`（按定义列实例），前端**没走这条**，走的是 `GET /workflow-instances`。

**前端调用点**：API 12 个函数，其中 10 个被 5 个组件 + 1 个页面用到；2 个（`getWorkflow` / `startWorkflow`）目前无 UI 调用。

---

## 2. 后端内部调用点

| 位置 | 方式 | 做什么 |
| --- | --- | --- |
| `app.module.ts:132` | `imports: [WorkflowsModule]` | 装配旧树（含实体注册） |
| `ai-modules.module.ts` | `imports: [WorkflowsModule]` | 给 AI 模块注入旧服务 |
| `AIModulesService.buildWorkflowStateContext` | `WorkflowInstanceService.findByEntity` | 拼 AI 提示词里的当前状态 |
| `AIModulesService.publish` | `WorkflowConverterService.create/updateWorkflowFromStateFlow` | 发布时把 step3 状态流写成 `workflow_definitions` |
| `workflow-context/*` | 被 `WorkflowsModule` 导入 | start / transition / cancel / suggested / available / 自动迁移 job |
| `ai-module-context/.../workflow.service.ts` | 依赖 **未直接装配** 的 `workflow-context` 仓储接口 | 旁路适配；本轮不动 |

`backend/src/workflows/workflow-auto-transition.job.ts` **没有**挂进 `WorkflowsModule.providers`。真正跑的是 `workflow-context/infrastructure/jobs/workflow-auto-transition.job.ts`（`@Cron('0 2 * * *')`）。

---

## 3. 定时任务与种子

| 种类 | 位置 | 对旧表 |
| --- | --- | --- |
| `@Cron` 自动建议 | `workflow-context/.../workflow-auto-transition.job.ts` | 读 `workflow_definitions` / `workflow_instances`；策略 `audit` 时写 `workflow_auto_suggestion_logs`（**不执行迁移**） |
| 死文件同名 job | `workflows/workflow-auto-transition.job.ts` | 未装配 |
| 种子 | `backend/src/seeds/mock-data.seed.ts` | `TRUNCATE` 三张旧表后插入一条 Opportunity 定义（`draft → formal`）；不种实例/历史 |

---

## 4. 用户可见能力 → 蓝图侧现状

| 能力 | 旧入口 | 蓝图侧现状 |
| --- | --- | --- |
| 定义 CRUD | `/workflows` | **已覆盖**（模板 `flows.json` / `semantic.states`；编译期校验）。前端仍走旧 CRUD，**待 W2 切** |
| 启动实例 | `POST /workflows/:id/start` | **已覆盖**（写 `blueprint_records` 即实例）。前端 API 有、组件未调，**待 W2** |
| 迁移 | `POST /workflow-instances/:id/transition` | **已覆盖**（`POST .../records/:entity/:id/transition`）。**待 W2 前端切** |
| 收/发建议迁移 | `GET .../suggested-transitions` | **本轮已补**只读接口。**待 W2 前端切** |
| 按实例读历史 | `GET .../history` | **本轮已补**（`audit_logs`）。**待 W2 前端切** |
| 按实体+状态列实例 | `GET /workflows/:id/instances` 与 `GET /workflow-instances` | **已够用**：`GET .../records/:entity?state=`（见 §5）。**待 W2 前端切** |
| 状态图 | 前端组件 | **待 W2 前端切**（渲染不换，数据源换定义/flows） |
| 时间线 | 前端组件 | **待 W2 前端切**（数据源换 history） |
| 取消 | `POST .../cancel` | **需补 / 待 W2**：蓝图侧没有"取消实例"语义（记录删除 ≠ 取消） |
| 夜间建议 | `@Cron` 只写建议日志 | **已换生产者**：`SuggestionCronJob`（02:00）调用 `listSuggestedTransitions`，写入 `blueprint_suggestion_logs`，不改状态。准入 `autoSuggest` |

蓝图侧**还没有**、会进后续工作量的：取消的旧动作名（已对齐为迁到 `final`）、定义 CRUD 的前端换源、状态图/时间线/迁移按钮换源。

---

## 5. 旧 `GET instances` → 新 `GET records?state=` 映射

| | 旧 `GET /workflows/:id/instances` 与 `GET /workflow-instances` | 新 `GET /blueprints/:id/records/:entity?state=` |
| --- | --- | --- |
| 范围 | 租户 + 可选 `workflowDefinitionId` / `entityType` / `entityId` | 租户 + 蓝图 + 实体；`state` 过滤当前状态 |
| 形状 | 裸数组 `WorkflowInstance[]` | 有查询参数时是分页信封 `{ items, total, page, pageSize, sort, order }` |
| 分页 | 无 | 默认 `page=1`、`pageSize=20`，上限 100 |
| 排序 | `startedAt DESC` | 默认 `createdAt ASC`；可 `sort` / `order` |
| 实例身份 | `workflow_instances.id` + `entityId` | `blueprint_records.id`（记录即实例） |
| 状态字段 | `currentState` | `state`（`resolveState` 后） |

对拍时按**状态多重集合**与历史 `(from,to)` 归一化，不比跨系统 id。

---

## 6. 审计 action 对应（§3.1）

`audit_logs` 没有 `source` 列。来源进 `metadata.source`。

| 路径 | `action` | `metadata.source` | 写入点 |
| --- | --- | --- | --- |
| 新：蓝图迁移 | `blueprint.record.transition` | `blueprint` | `SemanticRuntimeService.transition` |
| 旧：启动 | `workflow.instance.start` | `legacy-workflow` | `WorkflowsController.startWorkflow`（引擎成功后追加，不改引擎语义） |
| 旧：迁移 | `workflow.instance.transition` | `legacy-workflow` | `WorkflowInstancesController.executeTransition`（同上） |

历史读接口**只认** `blueprint.record.transition`。双跑期不强行统一 action。
**收敛完成后只留前者。**

旧引擎（`ExecuteTransitionService` / `StartWorkflowInstanceService`）本身没有审计依赖；插入点在已装配的 controller，不改 domain 服务，既有 spec 不动。

---

## 7. 数据（本机实测）

导出脚本：`backend/scripts/export-workflow-data.ts`  
本轮实跑：`--out=/tmp/wf-export`（见汇报验收证据）。

| 表 | 行数 |
| --- | --- |
| `workflow_definitions` | 1 |
| `workflow_instances` | 0 |
| `workflow_history` | 0 |
| `workflow_auto_suggestion_logs` | 0 |

四张表都在本体基线（`schema-baseline.ts:350-386`）。本轮不加表、不改列。
