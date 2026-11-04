# Change: 增加 Agent Host 层与实例级自迭代闭环

## Why

PiAgent 的内核部分已经落地：双 profile 协议（`docs/protocols/piagent.md`）、工具网关与确认令牌
（`contracts/tools.json` + `AgentToolRegistry`）、知识/评测（`add-agent-knowledge-and-eval`）、
A1/A2 治理与发布生命周期（`add-builder-governance-loop` / `add-a2-release-automation`）。
缺的是两件事：

1. **宿主层没有定义**。外部 agent 宿主（如 OpenClaw）或内嵌宿主提供通道、会话、沙箱、记忆，
   但它们与本平台谁拥有工具白名单、确认令牌、审计裁决权，目前没有契约。不写清楚，就会出现
   **第二条策略路径**——违反元语「不造第二条路径」。
2. **「一客户一实例、各自迭代」没有闭环**。产品形态从共享 SaaS 转为**单实例自迭代 ERP**
   （2026-11 澄清：SaaS 不是必须），但实例内的变更范围、自主等级、跨实例回流与分叉护栏尚未定义。

本变更只补这两层，不重做已落地的运行时内核。

## What Changes

- **ADDED** `agent-host`（新能力）：宿主适配层契约。
  - 宿主只提供通道、会话、沙箱、记忆与执行隔离；**MUST NOT** 拥有工具白名单、确认令牌、
    审计的最终裁决权。
  - 工具面**只经 MCP** 暴露：`contracts/tools.json` 投影为 MCP server，宿主是 MCP 客户端。
  - 同一实例内承载 `piagent-runtime` 与 `piagent-builder` 两个 profile，工具面按 profile 收窄。
  - 来自网络/通道的外部内容 MUST 标记为 untrusted，不得进入可信记忆或当前 release 的知识面。
  - 宿主不可用时，Web 内嵌通道 MUST 仍可用（降级而非停摆）。
- **ADDED** `instance-evolution`（新能力）：单实例自迭代闭环。
  - 实例层变更范围**只到蓝图层**（字段/表单/流程/规则/权限映射/知识），**MUST NOT** 改平台代码。
  - 默认自主等级 **A1**（起草 + 校验 + 预览，人批准发布）；A2 仍按白名单与策略服务执行。
  - 每次实例变更 MUST 绑定 `platformVersion` 与 `evolutionScope`，用于平台升级时的冲突检测。
  - 验证过的实例变更 MAY 脱敏后回流为平台模板；回流 MUST 经人工审批，且不得携带客户数据。

## Impact

- 新增能力：`agent-host`、`instance-evolution`
- 受影响的现有实现（实现阶段）：
  - `backend/src/agent-tools`（MCP 投影、profile 收窄）
  - `backend/src/agent-sessions`、`backend/src/agent-knowledge`（untrusted 边界）
  - `backend/src/releases`、`backend/src/blueprint`（`platformVersion` / 回流）
  - `contracts/tools.json`（投影元数据：传输、超时、是否可经宿主暴露）
  - 部署清单（每实例一个宿主单元、独立网段、最小权限）
- 依赖：本变更假设 `refactor-ai-native-business-app-platform` 的 `agent-runtime` 落地
  （会话/运行/工具调用/预算/审计）。在该变更合并前，本变更只能实现宿主侧与蓝图侧。
- 非目标：
  - 共享网关内的敌对多租户隔离（一实例一宿主，不存在该场景）
  - A3（结构自动发布）
  - 让 agent 执行 shell、直连数据库或修改生产配置
