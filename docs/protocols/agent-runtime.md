# Agent Runtime Contract v1（冻结）

> 权威形状：[`schemas/agent-runtime.schema.json`](../../schemas/agent-runtime.schema.json)
> 正负例：[`fixtures/schemas/agent-runtime/`](../../fixtures/schemas/agent-runtime/)
> 实现：`apps/api/src/agent-sessions/agent-runtime.service.ts`

## 1. 记录

| 记录 | 关键字段 | 不变量 |
| --- | --- | --- |
| `agent_definitions` | key/version/name/role/policy/toolScopes/status | 同组织 key+version 唯一；`draft→published→retired` |
| `agent_instances` | appKey/appInstallationId/userId/definitionId/profile/status | 只允许 published definition；app 安装必须 active |
| `agent_conversations` | appKey/userId/releaseId/agentInstanceId | 可空 `agentInstanceId` 兼容旧会话 |
| `agent_runs` | status/input/output/error/budget/usage | 状态迁移只由服务端白名单裁决 |
| `agent_steps` | runId/seq/type/status/payload | `(runId, seq)` 唯一，seq 单调递增 |
| `agent_waits` | runId/kind/status/resolution | `waiting_user/external` 由 wait/resume 驱动 |

## 2. 状态机

```text
queued → running → waiting_user|waiting_external → queued → running
                 ↘ completed | failed | cancelled
queued → cancelled | failed
waiting_* → queued | cancelled | failed
completed/failed/cancelled 为终态
```

模型、客户端与工具都不能直接写 `completed`；只能调用服务端 transition/wait/resume/
complete/cancel。非法迁移返回 409。

## 3. 事件与重放

- 每次迁移写一条 `agent_steps`，`seq` 从 1 递增。
- `GET /api/agent/runtime/runs/:id/events?after=<seq>` 返回 `seq > after` 的有序事件。
- 断线重连不重放旧事件，不复制 run 状态；`agent_steps` 是唯一事件真源。
- 取消 run 时 pending wait 置 `cancelled`；事件仍可重放。

## 4. 预算

```json
{ "maxToolCalls": 8, "maxTokens": 12000, "deadlineMs": 30000 }
```

- 预算由服务端生成，调用方不能放大。
- 超限抛 `BUDGET_EXCEEDED:toolCalls|tokens|deadline`，不继续执行。
- 环境变量：`AGENT_MAX_TOOL_CALLS` / `AGENT_MAX_TOKENS` / `AGENT_DEADLINE_MS`。

## 5. 兼容

- 旧 `/api/chat/message` 与无 `X-App-Id` 的 tenant-only 调用保持兼容，但带弃用 header；
  见 [`api-deprecation.md`](./api-deprecation.md)。
- 新能力只对带应用上下文的 Agent Runtime 入口开放。
