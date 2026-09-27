# 旧工作流退场登记（W3）

> 状态：`consolidate-platform-foundations` W3 完成后
> 相关：蓝图记录迁移见 [`record-transition.md`](./record-transition.md)；410 墓碑见 `backend/src/legacy-workflow-gone/`；归档实体见 `backend/src/workflow-archive/`

本文件逐条登记旧工作流退场项、理由与能力去向。存量 `workflow_*` 四表**不物理删除**（只读归档）。

---

## 1. 退场登记

| 退场项 | 类型 | 理由 | 能力去哪了 |
| --- | --- | --- | --- |
| `workflows/`（16 个 `.ts` + README） | 代码树 | 双状态存储 + 桥 = 漂移来源 | 迁移/历史/建议→蓝图（W1）；定义→`flows.json`；状态图→W2 |
| `workflow-context/` | 代码树 | 未单独装配、有 spec 但无实现价值 | 同上；其 spec 随树删除（理由：能力已由 blueprint 驱动实现承接） |
| `workflow-context` 6 份 spec（`workflow-definition.repository` / `execute-transition` / `start-workflow-instance` / `transition-validator` / 两个 domain entity） | 测试 | 测的是已删树的领域对象与仓储 | 新侧断言由 `blueprint-read-interfaces.e2e-spec.ts` 与 semantic-runtime 单测承接 |
| `WorkflowConverterService`（AI 建流程） | 能力 | 旧协议路径（`step3_stateFlow` → 旧定义表） | **A1/A2**（AI→蓝图五层） |
| `buildWorkflowStateContext`（AI prompt 里的流程状态） | 能力 | 依赖 design §1.1 点名的桥（业务实体状态 ↔ 流程实例状态）；蓝图侧没有「按业务实体反查蓝图记录」的映射，硬造一个是把桥换个名字 | **失去**。回归时机 = chat-first 的 Interaction Plan 或蓝图记录反查建立之后 |
| `ai-modules.service` 的 `Auto-create workflow from step3_stateFlow` | 能力 | AI 产出→工作流的旧路径，正是 A1/A2 要替代的东西 | **A1/A2**；本轮只退场、不实现 |
| `ai-modules.service.spec.ts` 里对 `WorkflowConverterService` / `WorkflowInstanceService` 的 DI mock | 测试 | 服务构造器已不再注入旧树；spec 本身没有覆盖这两条旧路径的用例 | 无净损失（被删的是空 mock，不是断言） |
| `ai-module-context/infrastructure/external/workflow.service.ts` | 适配器 | 注入 `workflow-context` 两个仓储 token，实现 `IWorkflowService` | 端口 `IWorkflowService` **保留**（标明接缝）；`GeneratePatchService` 改为 `@Optional()`，缺实现时没有工作流上下文 |
| `@Cron` 夜间建议（旧 `workflow-context/.../workflow-auto-transition.job.ts`） | 能力 | 旧实现只写建议日志、未执行迁移 | **换生产者**：`SuggestionCronJob`（`0 2 * * *`）对 `autoSuggest` 的非终态记录调用 `listSuggestedTransitions`，写入 `blueprint_suggestion_logs`，不改状态 |
| `cancelInstance` 语义 | 能力 | 旧引擎专有 | 蓝图侧改为「迁到声明的 `final` 状态」（W2 已做） |
| 四张 `workflow_*` 表（`workflow_definitions` / `workflow_instances` / `workflow_history` / `workflow_auto_suggestion_logs`） | 数据 | 不物理删除 | **只读归档**（`backend/src/workflow-archive/`）+ W0 导出脚本 |
| `seeds/mock-data.seed.ts` 的 TRUNCATE 三表 + Opportunity 定义插入 | 种子 | 表变成只读归档，种子脚本不该改它（TRUNCATE 归档表比不种更糟） | 归档表不再被种子改写 |
| `test/utils/domain-builders.ts` 的 `WorkflowDefinitionBuilder` / `WorkflowInstanceBuilder` | 测试工具 | 全仓库无人使用（grep 0 命中） | 无净损失 |
| `workflow-parity.e2e-spec.ts` | 测试 | 对拍对象（旧 service 读路径）已不存在；这是双跑期的过渡测试，已按计划退役 | 新侧断言由 `blueprint-read-interfaces.e2e-spec.ts` 承接（列表/迁移/历史/只读/租户） |
| `speckit/src/lib/api/workflows.api.ts` | 前端死代码 | W2 已切数据源；全 `speckit/src/**` 无人 import | 页面走 `blueprints.api.ts` |

---

## 2. 410 墓碑

旧路径一律 **410 Gone**（不是 404），body 含 `migratedTo`：

| from | to |
| --- | --- |
| `GET /api/workflows` | `GET /api/blueprints` |
| `GET /api/workflow-instances` | `GET /api/blueprints/:id/records/:entity?state=` |
| `POST /api/workflow-instances/:id/transition` | `POST /api/blueprints/:id/records/:entity/:recordId/transition` |
| `GET /api/workflow-instances/:id/history` | `GET /api/blueprints/:id/records/:entity/:recordId/history` |

实现：`backend/src/legacy-workflow-gone/`。断言：`backend/test/legacy-workflow-gone.e2e-spec.ts`。

---

## 3. 净损失与回归时机

| 失去的能力 | 回归时机 |
| --- | --- |
| AI prompt 里的「当前工作流状态 / 下一状态」 | chat-first Interaction Plan，或蓝图记录按业务实体反查建立之后 |
| AI `step3_stateFlow` → 自动建流程定义 | A1/A2（`mergedDefinition` → 蓝图五层） |
| 旧 `@Cron` 的 `execute` 策略（注释里有、从未实现） | 本轮仍不自动改状态；夜间任务只记建议 |
| `cancelInstance` | 已由 W2「迁到 `final`」替代，不另开回归 |
