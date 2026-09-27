# 记录迁移历史与建议迁移

> 状态：双跑期约定（`consolidate-platform-foundations` W1）
> 相关：蓝图记录迁移 `POST /blueprints/:id/records/:entity/:recordId/transition`、
> 审计表 `audit_logs`、旧工作流 `workflows` / `workflow-instances`

本文件钉三件事：**迁移历史怎么读**、**建议迁移为什么必须只读**、
**双跑期 `metadata.source` 怎么区分、收敛后只留哪一个**。

---

## 1. 迁移历史的读取语义

来源是 `audit_logs`，**不新建历史表**。

```text
GET /blueprints/:id/records/:entity/:recordId/history
```

过滤：

| 字段 | 值 |
| --- | --- |
| `action` | `blueprint.record.transition` |
| `resource` | 实体名 |
| `resourceId` | 记录 id |
| `organizationId` | 当前租户 |

返回按 `timestamp` **升序**：

```text
[{ at, actor, from, to }]
```

`from` / `to` 优先取 `changes`，缺则取 `metadata`。缺一对的行丢弃，不编。

判据：

- 授权门（`loadOrThrow`）+ 租户过滤。
- 记录不存在（含他租）→ **404**。
- 记录在、没有迁移审计 → **200 + `[]`**（不是 404）。

按实体 + 状态列实例**不新开端点**：沿用

```text
GET /blueprints/:id/records/:entity?state=<state>
```

分页信封（`items / total / page / pageSize`）。旧 `GET /workflows/:id/instances` 无分页、按 `startedAt DESC`；
映射关系见本 change 的 `inventory.md`。

---

## 2. 建议迁移的只读契约

```text
GET /blueprints/:id/records/:entity/:recordId/suggested-transitions
```

从记录**当前状态**（`resolveState`）出发，取当前模板声明的合法 `transitions` 目标。
`requiresApproval` / `pendingApproval` 复用既有 `approval[]` 的 `when` 求值器与审批链读取，
**不另写一套判定**，也**不得**调用建链（`ensureApprovalChains`）。

```text
[{ to, requiresApproval, pendingApproval?: { ruleId, role } }]
```

只读硬约束（调用后必须仍成立）：

1. `blueprint_records.version` 不变。
2. `blueprint_records.state` 不变。
3. `audit_logs` 行数不增。

### 2.1 夜间生产者

每天 02:00（`@Cron('0 2 * * *')`，`backend/src` 只此一处）扫描已安装蓝图包。
只有语义实体 `autoSuggest === true` 的**非终态**记录会进入。缺省不声明，即不产生日志。

生产者调用与上一节**同一个** `listSuggestedTransitions`，把第一条建议的 `to`
追加进 `blueprint_suggestion_logs`（`reason` 为空）。每晚追加，不去重。
单条失败不中断整批。

上一节的三条只读硬约束对夜间任务同样成立：不改 `version`、不改 `state`、不写 `audit_logs`。
旧表 `workflow_auto_suggestion_logs` 仍是只读归档；新写入不进那张表
（它的 `workflowInstanceId` 外键指向已归档的 `workflow_instances`）。

---

## 3. `metadata.source` 与 action 对应

`audit_logs` **没有** `source` 列。审计只追加，不加列、不回填历史行。
来源写在 `metadata.source`：

| 路径 | `action` | `metadata.source` | 写入点 |
| --- | --- | --- | --- |
| 蓝图迁移 | `blueprint.record.transition` | `blueprint` | `SemanticRuntimeService.transition` |
| 旧实例启动 | `workflow.instance.start` | `legacy-workflow` | `WorkflowsController.startWorkflow`（引擎返回后追加） |
| 旧实例迁移 | `workflow.instance.transition` | `legacy-workflow` | `WorkflowInstancesController.executeTransition`（引擎返回后追加） |

双跑期**不强行统一** `action`：历史读接口只认 `blueprint.record.transition`。
两条 `action` 的对应关系登记在 `inventory.md`。

**收敛完成后只留** `action = blueprint.record.transition` 且 `metadata.source = blueprint`。
旧 `workflow.instance.*` 停止写入；旧 `workflow_history` 表只读归档。
