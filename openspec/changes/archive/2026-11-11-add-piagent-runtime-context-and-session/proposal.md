# Change: PiAgent Runtime 上下文、多轮会话与 SSE（P3a）

> 执行顺序：**4 / 8**
> 依赖：变更 3（Release/activation 已提供 `releaseId`）
> 参考：`docs/reference/05-piagent.md`、`07-adoption-and-checks.md` §P3

## Why

现有 Chat 只有“一句话 → 规则意图 → 工具 → Interaction Plan”的单轮路径：
没有持久会话、没有 Context Envelope、没有 SSE、没有预算与知识检索，
也没有把 `releaseId` / `skillVersion` / `knowledgeVersion` 绑定到每轮回答。

PiAgent 的第一阶段只做**只读答疑 + 查数**，写入继续沿用现有确认令牌。
本变更的目标不是“让模型更自由”，而是让模型在**平台编译的最小上下文**里工作，
且所有事实仍只来自工具结果。

## What Changes

- **ADDED** `libs/agent-kernel`：Context Envelope 编译、预算、SSE 事件类型、不可信数据包裹、纯协议逻辑
- **ADDED** 会话表：`agent_conversations`、`agent_turns`、`agent_tool_calls`
- **ADDED** `POST /agent/chat`（SSE）、会话历史、取消当前 turn、`/agent/health`
- **ADDED** 多轮会话（Redis 缓冲 + PG 持久化）
- **ADDED** LLM 适配器挂在既有 `IntentParser` 端口后（L0 规则优先；L1/L2 可选）
- **ADDED** Context Envelope：用户/组织/应用/`releaseId`/权限/屏幕上下文/知识/工具子集/预算
- **ADDED** 预算强制执行：工具调用数、token、墙钟时间
- **ADDED** 不可信数据 nonce 包裹（反馈原文、上传内容、工具外部结果）
- **ADDED** 每轮审计：`traceId`、上下文哈希、工具调用、`releaseId`、`skillVersion`、`knowledgeVersion`
- **MODIFIED** `ChatOrchestrator` 扩展为 Tool Loop；写工具仍绝不由编排器直接 invoke

**BREAKING**：无。保留 `POST /chat/message` 作为兼容入口；新能力走 `/agent/*`。

## Impact

- Affected specs: `piagent-runtime`（新增）
- Affected code:
  - `libs/agent-kernel/**`
  - `backend/src/chat/**`、`backend/src/agent-tools/**`
  - `backend/src/agent-sessions/**`（新模块）
  - `backend/src/migrations/*CreateAgentSessions*`
  - `shared-schemas`（Context Envelope、SSE 事件类型）
  - `speckit` PiAgent 侧栏（SSE 客户端）
  - `contracts/tools.json`、`AGENT-TOOLS.md`（补 `pi_*` 只读工具时）
  - `DOMAIN.md`、`FLOWS.md`、`DECISIONS.md`

## Out of Scope

- 不做 Builder Agent（变更 7）
- 不做知识库与评测（变更 6）
- 不做跨租户运营查询
- 不让模型生成 SQL、HTML 或任意 URL
- 不新增 `interaction-plan` block/action；导航先用 `facts`
