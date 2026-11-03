## Context

现有代码：

- `backend/src/chat/chat.controller.ts`：单轮 HTTP 入口
- `RuleBasedIntentParser`：确定性 L0 意图解析
- `CatalogToolSelector`：按意图选工具
- `ChatOrchestrator`：写工具只生成 plan，不直接 invoke
- `AgentToolRegistry`：契约/参数/权限/确认/审计
- `ConfirmationTokenService`：一次性写确认令牌

这些是 PiAgent 的地基，**不重写**。本变更在其外围补上下文、会话、流式与预算。

## Goals / Non-Goals

- Goals
  - 每个 turn 有可复现的 Context Envelope
  - LLM 只从同一份工具 catalog 选择工具，不绕过 registry
  - 多轮会话与取消可审计
  - 预算超限时返回“未完成”，而不是继续调用
  - 未声明能力明确回答“没有这个能力”
- Non-Goals
  - 不把权限写进提示词
  - 不让模型看全量数据库
  - 不做知识发布与评测

## Decisions

- Decision: LLM 适配器实现现有 `IntentParser` 端口，不替换编排器。
  - 理由：即使模型输出不稳定，权限、确认、审计仍由既有网关执行。
  - 流程：L0 规则命中即返回；未命中再走 L1/L2 模型；模型只能从 catalog 选工具。
- Decision: 新建 `libs/agent-kernel` 承载纯逻辑，`backend` 只做适配器。
  - `agent-kernel` 不 import `app-*` / `infra-*`，只依赖协议类型与端口。
- Decision: Context Envelope 由平台编译，模型不自行“找上下文”。
  - 工具子集按权限过滤；无权限的工具不出现在包内。
  - 知识/技能按当前 `releaseId` 绑定；`latest` 引用被禁止。
- Decision: SSE 事件固定为 `turn.start`、`text.delta`、`plan`、`tool.start`、`tool.result`、`turn.end`、`error`。
  - 新增事件类型必须先改 `docs/protocols/chat-erp.md` 与本文。
- Decision: 会话正文与工具参数按敏感策略脱敏；上下文包只存哈希，不存密钥。
- Decision: 写操作仍走 `POST /agent/confirmations` 与 `/consume`，本变更不新增第二条写通道。

## Context Envelope（最小包）

包含：

- `turnId`
- `user`: id / displayName / roles / locale
- `org`: id / name
- `app`: appKey / installationId / `releaseId` / releaseVersion / channel
- `permissions`: 当前用户有效权限
- `screen`: route / entity / recordId / selectedIds（只取必要字段）
- `conversation`: summary / recentTurns
- `knowledge`: 已发布且可见的知识摘要（变更 6 接入）
- `tools`: 按权限过滤并裁剪后的工具子集（默认 top-8）
- `budget`: maxToolCalls / maxTokens / deadlineMs
- `policy`: tone / disallow（`raw_sql`、`html`、未批准 URL）

不包含：密钥、内部 URL、其他租户信息、未脱敏个人数据。

## Budget

默认 Runtime：8 次工具调用 / 30s / 12k tokens。
超限行为：返回已完成部分 + 明确“未完成”，不假装完成。

## Failure Semantics

| 场景 | 行为 |
|---|---|
| 模型超时/不可用 | 降级到 L0 规则 / 搜索 / 表单，并明确告知 |
| 工具 `DENIED` | 说明缺哪个权限，不换工具绕过 |
| 工具 `NOT_FOUND` | 说“当前版本没有这个能力/找不到” |
| 工具 `CONFLICT` | 说明当前状态，不重复提交 |
| 预算耗尽 | 返回已完成部分 + 未完成项 |

## Risks / Trade-offs

- 风险：LLM 选错工具 → 只允许从 catalog 选，且评测后续覆盖。
- 风险：上下文包过大 → 工具 top-8 + 屏幕字段裁剪 + 会话摘要。
- 风险：SSE 长连接占用 → 单进程 v1 可接受；拆分条件见参考包 §3.1。
- 风险：会话表增长 → 保留期与归档策略；Redis 只做缓冲，不存真相。

## Migration Plan

1. 先建 `agent-kernel` 与 Envelope 类型，不改现有单轮入口。
2. 新增 `/agent/chat`，内部调用既有 ChatOrchestrator。
3. 加会话持久化与 SSE 事件。
4. 再接 LLM 适配器（可配置关闭，默认 L0）。
5. 回退：关闭 `/agent/*` 路由，保留 `/chat/message`。

## Open Questions

- L1/L2 模型使用 `ai-models` 注册表里的哪个默认模型？
  - 本变更只接端口与配置，不锁定供应商；默认关闭 LLM，先跑 L0。
- 会话保留多久？
  - 默认 7 天（与参考包 `ConversationMemory` 一致），在配置中可调。
