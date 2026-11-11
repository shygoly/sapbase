# Agent Host Deployment Baseline

Agent Host 是可选的外置/内嵌执行宿主（如 OpenClaw）。它只提供通道、会话、沙箱、记忆与
执行隔离；策略与裁决仍在平台侧。

## 1. 进程与健康

- 每个实例一个宿主单元；宿主进程与 API 进程分离。
- `GET /api/agent-host/health` 返回：
  - `mode`：`embedded` / `mcp`
  - `healthy` / `toolsCount` / `lastError`
  - `fallback=web-sse`
- MCP 探测失败时只降级 Web SSE，不停止业务；恢复后重新探测。
- 启动时校验宿主 allowlist ⊆ 网关授权集（工具必须已注册，profile 必须在
  `allowedAgents` 内）；不满足拒绝启动。

## 2. 沙箱基线

| 项 | 要求 |
|---|---|
| 用户 | 非 root；只读根文件系统 + 独立可写临时目录 |
| shell | 无通用 shell；禁止 `sh -c` / `child_process` / worker |
| 网络 | 仅回环 MCP 端口；禁止出站公网与宿主内网 |
| 文件 | 只挂载允许的目录；allowlist 之外拒绝 |
| 进程 | 独立命名空间；禁止 ptrace / 挂载 / 原始套接字 |
| 凭证 | 不注入模型/数据库生产密钥；只通过平台引用按需换取 |

## 3. MCP 工具面

- 宿主只读 `contracts/mcp-tools.json`，不手写第二份清单。
- 传输：MCP client → 平台 MCP server → `AgentToolRegistry`（同一网关）。
- 上下文（org/user/permissions/confirmation）通过 `_meta.contextId` 按引用传递，
  模型参数不能覆盖。
- 写工具仍必须确认令牌；宿主无绕过路径。

## 4. Skills

- 运行时只允许 `AGENT_SKILL_ALLOWLIST` 中的 skill。
- digest 必须是 `sha256:<64 hex>`；注册只创建 draft。
- 禁止运行时自动安装/激活；激活走人工发布。

## 5. Untrusted 内容

- 通道/网页/文档等外部内容进入对话时写入 `agent_turns.tainted/taintSource`。
- 外部文本只作为数据，不进入可信知识；知识写入前校验来源。
- 工具结果带 source/nonce 边界，审计参数脱敏。

## 6. 部署检查清单

- [ ] 宿主容器非 root，无 shell，网络仅回环 MCP。
- [ ] `AGENT_TOOL_TRANSPORT=mcp`，`AGENT_HOST_PROFILE` 明确（runtime/builder）。
- [ ] `GET /api/agent-host/health` healthy 或明确 fallback。
- [ ] `contracts/mcp-tools.json` 由契约生成，CI 三方对拍通过。
- [ ] `AGENT_SKILL_ALLOWLIST` 已配置，digest 校验生效。
- [ ] 宿主不可用时 Web SSE 可用。
