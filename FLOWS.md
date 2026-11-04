# FLOWS.md — 调度总表与业务线步骤链

> **机器可校验的业务流程契约**。每条业务线的步骤链以 `yaml flow` 围栏块声明，
> producer/consumer 配对防止“产生对象无人消费”或“消费对象无人产生”的死边。
> 调度总表与代码侧 registry `jobKey` + 装饰器 `name` 三向对拍，
> 校验由 `node scripts/meta/check-meta-docs.mjs` 强制。
> 改 cron / 改业务线步骤链时必须同步本文件并通过校验。
> 文中相对路径除特别说明外均相对仓库根。

---

## 调度总表

与 `apps/api/src/monitor/scheduled-job.registry.ts` 的 `jobKey` 和
各 job service 的 `@Cron(..., { name: ... })` 三向对拍。新增/改名 cron 必须三处同步。

| jobKey | 触发时点 | 入口 | 作用 |
|---|---|---|---|
| `semantic.suggest_transitions` | `0 2 * * *`（每日 02:00） | `apps/api/src/semantic-runtime/suggestion-cron.ts#run` | 为每个组织写入 Blueprint 状态迁移建议日志 |
| `release.guardrail_check` | `30 * * * *`（每小时 :30） | `apps/api/src/release-automation/release-automation-jobs.service.ts#guardrailCheck` | 扫描 A2 策略并记录护栏检查 |
| `release.review_due` | `0 9 * * *`（每日 09:00） | `apps/api/src/release-automation/release-automation-jobs.service.ts#reviewDue` | 24h 未复核的 A2 策略自动降回 A1 |

**错峰约定**：日任务集中在 02:00–04:00；新增 job 必须在本表、registry、装饰器三处同步。

---

## 业务线步骤链

每条链以 `yaml flow` 围栏块声明，字段：

- `id`（唯一，`FLOW-<AREA>-<NN>`）
- `name`、`trigger`（cron jobKey 或事件）
- `steps[]`：每步 `actor`（path#symbol）+ `produces`（创建/更新的对象）+ `consumes`（引用的前置对象）
- `dead_edge_check`：列出 producer→consumer 配对，校验器据此防死边

### 1. 夜间 Blueprint 迁移建议

```yaml flow
id: FLOW-SEMANTIC-01
name: 夜间 Blueprint 迁移建议
trigger: semantic.suggest_transitions
steps:
  - actor: apps/api/src/semantic-runtime/suggestion-cron.ts#run
    produces: [blueprint_suggestion_logs]
    consumes: [blueprint_records, workflow_definitions]
```

**说明**：本 job 只写建议日志，不改变任何业务记录状态；写状态必须由人确认后走正常迁移接口。

---

## 附录：cron 命名空间约定

- `<domain>.<action>` 格式：`semantic.` / `order.` / `release.` / `agent.` / `sys.`
- 新增 cron 必须三处同步：本表 + registry + 对应 job service 的装饰器
- 推送类错峰；日任务集中在低峰
- 每个 job 必须：可重入、幂等、有超时、失败可见、可手动重放
