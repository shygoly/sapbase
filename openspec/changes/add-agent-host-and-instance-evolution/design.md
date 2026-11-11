# Design: Agent Host 层与实例级自迭代

## Context

交付形态确定为**一客户一实例**：每个 ERP 部署是一个独立信任域，自己迭代、自己发布。
因此不存在"共享网关内的敌对多租户"这一约束；OpenClaw 的「一个网关 = 一个受信任操作者边界」
正好与实例边界重合，`openclaw fleet`（每租户一个 cell）在本产品里不需要。

已有资产（不要重做）：

| 资产 | 位置 | 角色 |
|---|---|---|
| 工具契约与白名单 | `contracts/tools.json` + `AGENT-TOOLS.md` | 唯一工具真源 |
| 执行链 | `apps/api/src/agent-tools/agent-tool.registry.ts` | 契约 → 参数 → 权限 → 确认 → 执行 → 审计 |
| 确认令牌 | `confirmation-token.service.ts` | 写操作一次性、带参数摘要、TTL |
| 双 profile 协议 | `docs/protocols/piagent.md` | runtime / builder 的边界 |
| 进化闭环 | `docs/protocols/agent-evolution.md` + `agent-eval` / `agent-feedback` | A0–A3、G0–G6 |
| 发布与激活 | `releases` / `release-automation` | 不可变 release、灰度、回滚 |

缺少的是宿主层契约与实例演进约束。

## Goals / Non-Goals

### Goals

- 让外部宿主（OpenClaw）或内嵌宿主可以替换，而**不改变授权与审计语义**。
- 让同一份工具契约同时服务开发时 harness 与运行时宿主。
- 让"实例自己迭代"有明确范围、默认自主等级与回退路径。
- 让实例演进能回流，避免二十个客户二十套蓝图、平台无法升级。

### Non-Goals

- 让宿主成为策略引擎或事实源。
- 让实例内 agent 修改平台代码（那是平台层 PiAgent + OpenSpec 的职责）。
- 一次把 A2 白名单扩大。
- 支持共享网关的敌对多租户。

## Core Decisions

### Decision 1: Host 只是宿主，策略点唯一

宿主（OpenClaw / 内嵌）负责：通道、会话生命周期、沙箱、记忆、限流、执行隔离。
ERP 的 `AgentToolRegistry` 负责：工具是否存在、参数是否合法、权限是否满足、确认令牌是否有效、审计。

```text
Host ──MCP──▶ Tool Gateway（唯一 PEP）──▶ 用例 ──▶ PG
  │                   │
  └── 只拿到"已授权的结果"，不得回写策略
```

拒绝的替代方案：把 `allowedAgents`、`confirmation` 下放给宿主配置。那会产生两份真源，
两边不一致时无法判定谁对；且宿主的插件生态（skills）不受我们的发布流程约束。

### Decision 2: MCP 是唯一工具传输

`contracts/tools.json` 投影为 MCP server（stdio / streamable-HTTP），宿主只是 MCP 客户端。
投影必须携带：name、JSON Schema、`readOnlyHint`/`destructiveHint`、超时、`confirmation` 映射、
`allowedAgents`。

**投影不新增契约字段**：所需信息在现有契约里已齐备（`write` → readOnly/destructive 提示，
`confirmation` / `timeoutMs` / `untrustedResult` / `sensitiveArgs` / `allowedAgents` → `_meta`）。
生成物为 `contracts/mcp-tools.json`，由 `project-mcp-tools.mjs` 生成、`check-agent-tools.mjs` 对拍漂移。

理由：

- 开发时（PiAgent）与运行时（OpenClaw）可以消费同一份工具面，不需要两套适配器。
- MCP 已是事实标准，宿主生态（OpenClaw 内置 MCP 客户端、Claude Agent SDK 等）直接可用。
- 工具 schema 仍然只有一处真源，`check-agent-tools.mjs` 继续对拍。

风险：MCP 的注解（`readOnlyHint`）只是提示，**不能**当作授权依据；授权仍以网关判定为准。

内嵌通道（Web SSE）同样经 MCP：`AgentToolMcpBridge` 在进程内起 server + client，
`AGENT_TOOL_TRANSPORT=mcp` 启用、默认 `direct`（行为与改造前一致）。
**调用上下文按引用传递**：organizationId / 权限 / 确认令牌不进 `arguments`，
而是由客户端登记、服务端按 `_meta.contextId` 一次性取出——模型即使伪造同名字段也无效。

### Decision 3: 一实例一宿主，不做 cell 编排

一个部署单元 = 一个 ERP 后端 + 一个宿主进程（可选）+ PG/Redis。
宿主崩溃时退回 Web 内嵌通道（SSE），不因宿主故障停摆。

### Decision 4: 实例演进只到蓝图层

| 允许在实例内变更 | 不允许 |
|---|---|
| 字段、表单、列表视图、校验消息 | 平台代码、内核模块 |
| 流程/状态机（蓝图 `flows.json`） | 迁移与表结构 |
| 权限映射、菜单 | 工具契约（`tools.json`） |
| 知识条目、帮助文案 | 评测集与闸门（G0–G6） |

理由：代码级变更需要跑 `check-all`、`tsc`、e2e、签名与发布流水线；把它下放到实例等于放弃可验证性。
实例内 agent 产出的是**蓝图包**，由平台的编译/校验/发布链处理。

### Decision 5: 回流优先于分叉

```text
实例变更 → 人批 → 生效 → 观察 N 周无回退
        → 脱敏（去客户数据）→ 平台评审 → 模板/规则包 → 下个平台版本
```

模板只包含结构与文案，不含业务数据。实例仍可拒绝接收模板（本地人批）。

### Decision 6: 交付形态 standalone 优先

同一份 release 支持 standalone / dedicated / shared，但本变更只承诺 standalone 的完整闭环；
共享 SaaS 作为后续选项，不为其引入额外隔离机制。

## Security & Compliance

依据国家互联网应急中心 2026-03-12 风险提示与工信部 NVDB「六要六不要」：

| 要求 | 落地 |
|---|---|
| 独立网段、与生产隔离 | 宿主单独网络命名空间，只暴露回环 MCP 端口 |
| 最小权限 | 容器非 root；不挂载宿主目录；无 shell 工具 |
| 插件供应链 | skills 白名单 + 签名校验；禁止运行时自动安装 |
| 提示词注入 | 外部内容包裹为 untrusted；turn taint；写操作一律确认令牌 |
| 密钥 | 不落环境变量明文；走平台 secrets |
| 审计 | 每次工具调用（成功/失败）落 `audit_logs`，宿主侧日志只作补充 |

## Migration

1. 先用内嵌宿主（现有 Web SSE）跑通 MCP 投影，确认工具面等价。
2. 单客户试点接入 OpenClaw 宿主，只开只读工具 + 一个写工具。
3. 跑通 builder 的起草→校验→预览→人批→灰度→回滚。
4. 再引入回流模板与 `platformVersion` 冲突检测。
