## 1. Agent Kernel 纯逻辑

- [x] 1.1 新建 `libs/agent-kernel`（`@sap/agent-kernel`），tags `["type:lib","scope:agent-kernel","layer:agent","runtime:node"]`
- [x] 1.2 定义 `ContextEnvelope` 类型与 `compileContextEnvelope()`：按权限过滤工具、裁剪屏幕字段、注入 `releaseId` 与预算
- [x] 1.3 定义 SSE 事件类型：`turn.start`、`text.delta`、`plan`、`tool.start`、`tool.result`、`turn.end`、`error`
- [x] 1.4 实现 `BudgetGuard`：工具调用数、token、截止时间；超限返回结构化“未完成”
- [x] 1.5 实现 `wrapUntrustedData()`：nonce 包裹 + 结束标记校验
- [x] 1.6 实现 `resolveToolSubset()`：按 `grantedPermissions` 过滤，默认 top-8，完整 Schema 在执行时校验
- [x] 1.7 为上述纯逻辑写单测（含无权限工具不可见、预算超限、nonce 不匹配不算结束）

## 2. 会话与审计表

- [x] 2.1 新建 DDL：`agent_conversations`（org、app、user、releaseId、createdAt、lastTurnAt）
- [x] 2.2 新建 DDL：`agent_turns`（conversationId、releaseId、modelId、promptHash、contextHash、tokensIn/out、latencyMs、status）
- [x] 2.3 新建 DDL：`agent_tool_calls`（turnId、tool、argsDigest、permissionOk、confirmationId、status、errorCode、latencyMs）
- [x] 2.4 全部新表带 `organizationId`（`agent_tool_calls` 通过 `turnId` 继承亦可，但必须能 join 回 org）；时间用 `timestamptz`
- [x] 2.5 新建 migration 与 `backend/src/agent-sessions/*.entity.ts`
- [x] 2.6 更新 `contracts/schema-manifest.json` 与 `DOMAIN.md`

## 3. 会话服务与 SSE

- [x] 3.1 新建 `backend/src/agent-sessions/agent-sessions.module.ts` / `service.ts` / `controller.ts`
- [x] 3.2 `POST /agent/chat`：接收 `{ conversationId?, message, screenContext? }`，返回 SSE
- [x] 3.3 SSE 按固定顺序发事件：`turn.start` → `text.delta` / `plan` → `tool.start` / `tool.result` → `turn.end`
- [x] 3.4 `GET /agent/conversations/:id` 分页返回会话历史
- [x] 3.5 `POST /agent/conversations/:id/cancel` 取消当前 turn；取消写审计
- [x] 3.6 `GET /agent/health` 健康检查
- [ ] 3.7 Redis 缓冲最近 N 轮与进行中的 turn；Redis 丢失可从 PG 重建
- [ ] 3.8 前端 PiAgent 侧栏接 SSE；未知事件忽略但记录，不崩

## 4. 上下文编译接入

- [x] 4.1 从 JWT/会话解析 `user/org`；从 `X-App-Id` + activation 解析 `app/releaseId`
- [x] 4.2 屏幕上下文只取 route/entity/recordId/selectedIds；敏感字段脱敏
- [x] 4.3 工具子集按权限过滤；无权限工具不放进 Envelope
- [x] 4.4 预算写进 Envelope，并由 `BudgetGuard` 强制执行
- [x] 4.5 计算 `contextHash` 并写入 `agent_turns`；审计可复现“当时模型看到了什么”

## 5. 意图与模型路由

- [x] 5.1 保留 `RuleBasedIntentParser` 作为 L0 快路径
- [ ] 5.2 新建 `LlmIntentPlanner` 实现 `IntentParser` 端口：只从传入 catalog 选工具，不生成 SQL
- [ ] 5.3 模型不可用/超时：降级到 L0 + 搜索/表单，明确告知“智能助手暂不可用”
- [ ] 5.4 模型版本写入 `agent_turns.modelId`；换模型视为 Agent 变更，后续评测覆盖
- [ ] 5.5 `ChatOrchestrator` 扩展为 Tool Loop（计划 → 调用 → 观察 → 收敛），写工具仍只生成 plan

## 6. 工具与写确认

- [x] 6.1 保持 `AgentToolRegistry` 为唯一执行入口；不得新增绕过 registry 的通道
- [x] 6.2 只读阶段：仅开放 `write=false` 工具；写工具继续走现有 plan + confirmation token
- [ ] 6.3 写执行失败不自动换工具；同一 `Idempotency-Key` 且令牌未消费才允许重试
- [ ] 6.4 工具结果 `untrustedResult=true` 时用 nonce 包裹后再给模型
- [x] 6.5 无权限/无能力时如实回答，不尝试替代路径

## 7. 失败、审计与验收

- [ ] 7.1 成功与失败都写审计；失败带 `errorCode`；敏感参数脱敏
- [x] 7.2 每轮记录 `releaseId`、`skillVersion`、`knowledgeVersion`（后两者本变更先写 `null`/占位）
- [x] 7.3 单测：无权限工具不可见；预算超限返回未完成；nonce 不匹配；模型超时降级
- [ ] 7.4 E2E：一句话 → 只读工具 → SSE 事件 → 会话历史可查 → 审计有 turn/tool 记录
- [ ] 7.5 回归：现有 `POST /chat/message` 仍通过原测试
- [ ] 7.6 更新 `FLOWS.md`（若新增 cron/长任务）与 `DECISIONS.md`（D-3 工具面）


## ??????

- ????agent-kernel?Context Envelope????nonce ?????/??/????SSE ??????????????
- ????LLM IntentPlanner?Redis ????? SSE ???tool_calls ??????? E2E?
