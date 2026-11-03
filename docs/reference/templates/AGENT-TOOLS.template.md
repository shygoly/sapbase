# AGENT-TOOLS.md — 智能体工具面

> 机器真源是 `contracts/tools.json`（形状见 `schemas/agent-tool.schema.json`）。
> 本文件是人读索引，必须与 `tools.json` 完全一致；`node scripts/check-agent-tools.mjs` 做集合对拍。
> 规则：未声明的工具在运行时不存在；写工具必须 `confirmation: required`；权限由平台 all-of 判定。

---

## 工具表

| 工具 | 权限 | 写 | 确认 | 超时(ms) | 不可信结果 | 敏感参数 | 允许的智能体 | 处理器 |
|---|---|---|---|---|---|---|---|---|
| `erp_order_get` | `tool:order:read` | 否 | none | 5000 | 否 | - | `piagent-runtime` | `libs/agent-tools/src/lib/order.ts#getOrder` |
| `erp_order_create` | `tool:order:write` | 是 | required | 5000 | 否 | `contactPhone` | `piagent-runtime` | `libs/agent-tools/src/lib/order.ts#createOrder` |
| `pi_help_search` | `tool:help:read` | 否 | none | 3000 | 否 | - | `piagent-runtime`, `piagent-builder` | `libs/agent-tools/src/lib/help.ts#search` |
| `builder_feedback_list` | `tool:builder:read` | 否 | none | 5000 | 是 | `contentMasked` | `piagent-builder` | `libs/agent-tools/src/lib/builder.ts#listFeedback` |
| `builder_proposal_create` | `tool:builder:write` | 是 | required | 10000 | 否 | - | `piagent-builder` | `libs/agent-tools/src/lib/builder.ts#createProposal` |
| `builder_release_preview` | `tool:builder:validate` | 否 | none | 20000 | 否 | - | `piagent-builder` | `libs/agent-tools/src/lib/builder.ts#preview` |

---

## 能力矩阵

| 能力 | `piagent-runtime` | `piagent-builder` |
|---|---|---|
| 业务答疑 | ✅ | ✅ |
| 查业务数据 | ✅（按权限/租户） | ✅（只读） |
| 新建/修改业务数据 | ✅（确认令牌） | ⛔ |
| 读取反馈/指标 | ⛔ | ✅ |
| 起草变更提议 | ⛔ | ✅ |
| 校验/编译/预览 | ⛔ | ✅ |
| 批准/发布/激活 | ⛔ | ⛔（平台只允许人） |
| 修改知识/规则 | ⛔ | ✅（只能提议） |

矩阵不是提示词，是 `allowedAgents` + 权限点 + 服务端校验。

---

## 执行链

```text
契约查得到？
  → 参数形状合法？
  → 权限 all-of 满足？
  →（写操作）确认令牌有效？
  → 执行
  → 审计（成功与失败都写）
```

任一步不过即拒，**不部分执行、不回退到“换个工具试试”**。

---

## 错误码

| code | 含义 | 智能体应对 |
|---|---|---|
| `DENIED` | 无权限 | 如实说明，不换工具绕过 |
| `INVALID_ARGS` | 参数不合契约 | 按提示修正后重试一次 |
| `NOT_FOUND` | 对象/工具不存在 | 说明“没有这个能力/找不到” |
| `CONFLICT` | 状态不允许 | 说明当前状态，不强行重试 |
| `TIMEOUT` | 超时 | 可稍后重试一次 |
| `UNAVAILABLE` | 后端暂不可用 | 可稍后重试一次 |
| `INTERNAL` | 平台错误 | 不重试，提示联系管理员 |

---

## 新增工具检查清单

- [ ] `tools.json` 加了条目，`agent-tool.schema.json` 校验通过。
- [ ] `AGENT-TOOLS.md` 表格行与 `tools.json` 一致。
- [ ] 写工具 `confirmation: required`；读工具默认 `none`，敏感读可 `required`。
- [ ] `permission` 是 `tool:<domain>:<action>`，且已在权限种子/角色里分配。
- [ ] `allowedAgents` 显式，不用 `*`。
- [ ] `untrustedResult` 正确标注；结果会 nonce 包裹。
- [ ] `sensitiveArgs` 覆盖手机号/证件/姓名等。
- [ ] 处理器存在，错误码映射完整。
- [ ] 有单测：未授权、参数错、确认令牌缺失/过期/重放。
