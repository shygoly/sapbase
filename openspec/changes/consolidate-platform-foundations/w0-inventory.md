# W0 收敛准备：调用点清点

> 这份清单是 **`rg` 扫出来的**，不是手抄的（复现命令见文末）。
> 范围：`backend/src/workflows/`（1887 行）与 `backend/src/workflow-context/`（2896 行）。

## 0. 结论（先看这五条）

1. **`workflows` 与 `workflow-context` 不是"两棵独立的树"，而是同一套 API 的两个半边**：13 条路由分属两个 Controller，其中 `/workflow-instances` 那个的构造函数里**同时注入两棵树的服务**（5 + 5，见 §2）。这比"两套并存"更棘手 —— W1 不是"选一边"，而是按接口逐个接线。
2. 前端只有**一个入口**：`/admin/workflows`（1 page + 6 组件 + 1 API 客户端）。
3. 数据面是 **4 张表**，不是 3 张 —— 计划里漏了 `workflow_auto_suggestion_logs`。
4. 自动迁移 job **只有一个是活的**：`workflow-context` 的那个（模块里注册了）。`workflows/workflow-auto-transition.job.ts` 是**没有任何导入者的死文件** —— 但它带 `@Cron('0 2 * * *')`，谁把它接进模块，当天的自动迁移就会跑两遍。（W0 初稿把这对说成"双跑期会各跑一次"，是错的：见 §1 的更正。）
5. `workflow-context` 那棵树**唯一的功能出口不是** AI 上下文 —— 更正：`ai-module-context` 只是它两个消费者之一，真正对外的是 `/workflow-instances/*` 的 5 条路由（见 §2）。

---

## 1. 后端调用点

| 调用点 | 现在用它做什么 | 收敛后 |
| --- | --- | --- |
| `backend/src/app.module.ts:20,50-53,105-108,132` | 装配 `WorkflowsModule`，并把 4 个实体注册进 TypeORM | W3 摘除 |
| `backend/src/workflows/workflows.module.ts:19,23` | 引入 `WorkflowContextModule` —— **第二棵树唯一的装配入口** | W3 摘除 |
| `backend/src/ai-modules/ai-modules.module.ts:26,33` | 引入 `WorkflowsModule` | A 段改 |
| `backend/src/ai-modules/ai-modules.service.ts:13-14,33-34` | 注入 `WorkflowConverterService` + `WorkflowInstanceService` | A 段改 |
| ↳ `:160` | `findByEntity` 读出实例 → 给 LLM 拼"当前状态 / 下一状态"上下文 | 改读蓝图记录（`blueprint_records`） |
| ↳ `:721-748` | 把 AI 产出的 `step3_stateFlow` 建成/更新 workflow 定义，并把 `workflowId` 写回模块注册表 | 转换器改为产出 `flows.json`（A2） |
| `backend/src/ai-module-context/ai-module-context.module.ts:26,33` | 引入 `WorkflowContextModule` | 换到蓝图读 |
| `backend/src/ai-module-context/infrastructure/external/workflow.service.ts` | 注入 `workflow-context` 的仓库读实例 → 拼 AI 上下文（第二棵树的消费者之一；**不是**唯一出口，见 §2） | 换到蓝图接口（按实体 + 状态列实例） |
| `backend/src/seeds/mock-data.seed.ts:19-23,52-54,95-110` | 播种 1 条 `Opportunity` workflow（`draft → formal`） | W3：种子改走蓝图模板或删除 |
| `backend/src/workflows/workflow-auto-transition.job.ts:28` | `@Cron('0 2 * * *')` 自动建议 —— **没有任何导入者（死文件）**；用的是 `WorkflowSuggestionService`（只有它自己在用） | W1-0：删（它一被接进模块，cron 就翻倍） |
| `backend/src/workflow-context/infrastructure/jobs/workflow-auto-transition.job.ts:28` | `@Cron('0 2 * * *')` 自动建议 —— **唯一注册的那个**（`workflow-context.module.ts:72`），用的是 `GetSuggestedTransitionsService`，也就是 `GET /workflow-instances/:id/suggested-transitions` 同一个实现 | 保留到 W3（届时换蓝图驱动） |

> 误报已排除：`backend/test/unique-index-db.e2e-spec.ts` 命中的是注释里的 `.github/workflows/ci.yml`；`speckit/.../module-registry/page.tsx:66` 与 `unified-sidebar.tsx:51` 命中的是图标名 `workflow`，都不是调用点。

## 2. HTTP 出口（13 条）

`workflows.controller.ts` 里有**两个** `@Controller`，所以路由前缀有两种 —— 而且**两半用的是不同的树**：

```text
@Controller('workflows')            POST /  · GET /  · GET /:id  · PATCH /:id  · DELETE /:id
                                   POST /:id/start  · GET /:id/instances
   └─ 全部由 `workflows` 树的服务实现（WorkflowDefinitionService / WorkflowInstanceService / …）

@Controller('workflow-instances')  GET /  · GET /:id  · GET /:id/suggested-transitions
                                   POST /:id/transition  · POST /:id/cancel  · GET /:id/history
   └─ **混血**：构造函数注入 10 个服务，两棵树各 5 个
        workflows 侧：      WorkflowInstanceService / TransitionEngineService / WorkflowHistoryService /
                           WorkflowSuggestionService（注入了但**全类未被使用**）/ EntityStateUpdaterRegistry
        workflow-context 侧：GetWorkflowInstanceService / GetAvailableTransitionsService /
                           GetSuggestedTransitionsService / ExecuteTransitionService / CancelWorkflowInstanceService
```

**这条决定 W1 的做法**：`/workflow-instances/*` 不能靠"换数据源"整体切走 —— 同一个 Controller 里 `POST /:id/transition` 走 `workflow-context` 的 `ExecuteTransitionService`、而 `GET /` 走 `workflows` 的 `WorkflowInstanceService`。必须**按接口逐个**把实现换到蓝图接口上，并在双跑期用 `audit.source` 区分。

顺带两个"死枝"（W1-0 处理，见 tasks）：

- `workflows/workflow-auto-transition.job.ts` 无导入者；
- `WorkflowSuggestionService` 在删掉上面那个 job 后就**零消费者**（Controller 里注入但未使用）—— 留到 W3 与树一起删，避免这一步动构造函数。

## 3. 前端调用点（8 个文件）

```text
speckit/src/app/[locale]/admin/workflows/page.tsx                    页面（唯一入口）
speckit/src/app/[locale]/admin/workflows/components/workflow-definition-editor.tsx
speckit/src/app/[locale]/admin/workflows/components/workflow-instance-list.tsx
speckit/src/app/[locale]/admin/workflows/components/workflow-instance-viewer.tsx
speckit/src/app/[locale]/admin/workflows/components/workflow-transition-buttons.tsx
speckit/src/app/[locale]/admin/workflows/components/workflow-history-timeline.tsx
speckit/src/app/[locale]/admin/workflows/components/workflow-state-diagram.tsx
speckit/src/lib/api/workflows.api.ts                                  13 个方法，一一对应上面 13 条路由
```

菜单项：`speckit/src/config/default-menu-items.ts:110-113`（`id: admin-workflows`，`path: /admin/workflows`）。

## 4. 数据面（4 张表）

```text
workflow_definitions            定义（entityType / organizationId / states / transitions / status / version）
workflow_instances              实例（entityType / entityId / currentState / workflowDefinitionId）
workflow_history                历史（每次迁移一条）
workflow_auto_suggestion_logs   自动建议日志 ← **计划里漏掉的第 4 张**
```

来源：`backend/src/migrations/1737500000000-CreateWorkflowTables.ts` + `schema-baseline.ts:350-495`（含外键与索引 `idx_workflow_def_entity_type` / `idx_workflow_def_organization` / `idx_auto_suggestion_*`）。

导出与核对：`backend/scripts/export-workflow-legacy.ts`（W0 交付，只读 SELECT，落 JSON + 行数 + sha256）。

## 5. 测试面

| 树 | spec 数 | 备注 |
| --- | --- | --- |
| `workflow-context` | **5** | `execute-transition` / `start-workflow-instance` / `workflow-definition.entity` / `workflow-instance.entity` / `workflow-definition.repository` |
| `workflows` | **0** | 1887 行、零测试 —— 这是"已装配却零判据"的由来 |
| 跨界 | 1 | `ai-modules.service.spec.ts` 依赖 `workflows` 的两个 service（改 A 段时同改） |

退场时这 5 个 spec 会一起消失，所以其中**真正描述判据的部分**（迁移合法性、起始状态）要在 W1 就搬到 `semantic-runtime` 的测试里，不能跟着树一起删。

## 6. 用户可见能力清单（W 段"能力不减"的对照表）

从 13 条路由与 6 个前端组件反推，旧树对外承诺的能力是 7 项：

| # | 能力 | 蓝图侧现在有吗 | W1 要补什么 |
| --- | --- | --- | --- |
| 1 | 定义：list / detail / create / update / delete | 部分（`flows.json` 编译期已校验，蓝图自带版本） | 定义编辑改走蓝图包 |
| 2 | 实例：按实体+状态列表、详情 | **没有** | 按实体 + 状态列 `blueprint_records` |
| 3 | 生命周期：start | **没有**（蓝图记录由创建产生，没有"启动"概念） | 明确语义：创建即启动，或补一个 start |
| 4 | 生命周期：transition | 有（`record-transition`：乐观锁 + 审计 + 蓝图校验） | 无需补 |
| 5 | 生命周期：cancel | **没有** | 语义对齐（终态 or 取消）后再补 |
| 6 | 历史（时间线） | **没有对外读接口**（审计里有，但没读回入口） | 迁移审计读回 |
| 7 | 建议迁移 + 自动迁移（cron 02:00） | **没有** | 建议迁移只读补齐；自动迁移按蓝图驱动重写 |

> 结论：**13 条路由里只有 1 条（`transition`）在蓝图侧已经存在**。W1 不是"换个数据源"，而是"把 12 条路由的能力补齐到蓝图接口上" —— 这是本变更最大的一块工作量，也是 W3 之前不许删代码的原因。

## 7. 复现命令

```bash
# 后端调用点
rg -n "from '.*(workflows|workflow-context)" backend/src backend/test \
  --glob '!backend/src/workflows/**' --glob '!backend/src/workflow-context/**'

# 前端调用点
rg -n "workflows.api" speckit/src
find speckit/src -ipath '*workflow*' -type f

# 数据面
rg -n "workflow_[a-z_]+" backend/src/migrations/schema-baseline.ts

# 测试面
find backend/src/workflows backend/src/workflow-context -name '*.spec.ts'
```
