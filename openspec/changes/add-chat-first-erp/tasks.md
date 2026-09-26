# Implementation Tasks

## 里程碑与验收门

| 里程碑 | 范围 | 验收门（命令 + 期望） |
| --- | --- | --- |
| **C0** 参考与基线 | 盘点参考工程与本仓库可复用资产 | design.md 的对照表落地；`openspec validate --strict` 通过 |
| **C1** 协议冻结 | 工具契约 + Interaction Plan + 判据文本 | 两个 Schema 各有正例与 5 类负例；未知 `kind` 被拒 |
| **C2** 工具面 | `contracts/tools.json` + 注册表（权限/审计/确认令牌） | jest：越权工具被拒、写工具无令牌被拒、成功调用落审计 |
| **C3** 编排 | IntentParser（确定性）+ ToolSelector + Plan 生成 | jest：一句话 → 正确的工具序列 → plan 结构合法 |
| **C4** 前端 | chat 界面 + Plan 渲染器 | 类型检查通过；未知 kind 时渲染器拒绝并提示 |
| **C5** 端到端 | 一句话 → 工具 → plan → 确认 → 写操作 → 审计 | e2e：真实 HTTP；审计里能查到这次操作 |

### 执行约定

1. 每完成一项：勾选 + 附证据（命令 + 结果），不写"应该可以"。
2. **协议先行**：C1 未完成不进 C2/C3（元语不变量 10）。
3. **边界优先于政策**：能"让能力不存在"的地方不要用"提示词禁止"。
4. fail-closed：未知工具 / 未知 block kind / 缺权限 / 缺确认令牌，一律拒且不部分执行。
5. 不新造第二份判定：权限判定复用 `missingPermissions`，审计复用 `audit_logs`，
   模型配置复用 `ai-models`。
6. 每个里程碑结束跑一次全量回归（单元 + e2e + wasm-modules + tsc）。

## Phase C0: 参考与基线

- [x] 记录参考工程 `~/projects/guangfa/validation` 的工具契约做法与差异（design.md §1；
      14 个工具里 6 个是写操作，每个带独立权限点 —— 证明"工具面可以是协议而不是提示词"）
- [x] 盘点本仓库可直接作为工具的能力端点（原子 invoke / 蓝图 list·manifest·compile /
      模块 list·export / 插件 invoke），逐项确认权限点（C2 落地）

## Phase C1: 协议冻结

- [x] `schemas/agent-tool.schema.json`：name/description/parameters/permission/write/
      confirmation/timeoutMs/untrustedResult/sensitiveArgs/agentInvocable，`additionalProperties: false`
- [x] `schemas/interaction-plan.schema.json`：surface/title/blocks/actions/trace/needsConfirmation；
      `blocks[].kind`（facts/lines/anomaly/table）与 `actions[].kind`（confirm/edit/cancel）为**封闭枚举**
- [x] `docs/protocols/chat-erp.md`：三条边界、白名单工具面、plan 的三条硬约束、不判什么、
      以及新增的那一条元语（Interaction Surface）
- [x] 校验器 `chat-protocol-validator.ts` + 负例 **25 项**：未知 block/action kind（含**精确诊断**：
      说出"合法的是哪四个"，而不是"不匹配 oneOf"）、confirm 未绑工具、缺 trace、写操作不要确认、
      读操作要求确认、重名工具、空工具面、未知契约版本

> **C1 证据（2026-09-25）**：`jest src/chat` → **25 passed**。

## Phase C2: 工具面

- [ ] `contracts/tools.json`：首批工具（蓝图 list/manifest/compile、原子 invoke、模块 list/export）
- [ ] `backend/src/agent-tools/`：契约加载与校验（形状 + 权限点存在性）
- [ ] 调用链：契约 → 权限 all-of（复用 `missingPermissions`）→ 审计（复用 `audit_logs`）→ 执行
- [ ] 写操作：`confirmation` 为 required 时，无令牌即拒；令牌由平台在用户确认后签发（一次性、绑定工具与参数摘要）
- [ ] jest：越权被拒并写明缺哪条权限；写工具无令牌被拒；成功调用落审计；未知工具 → 明确错误

## Phase C3: 编排

- [ ] `backend/src/chat/`：`IntentParser` 接缝 + v1 确定性实现 + `ToolSelector`（只从契约里选）
- [ ] Plan 生成器：工具结果 → blocks（facts/lines/anomaly/trace），写操作 → actions（confirm/edit/cancel）
- [ ] 拒绝路径：意图匹配不到工具 → 明确回复"没有这个能力"（而不是让 LLM 编一个）
- [ ] jest：一句话 → 工具序列 → plan 合法；匹配不到 → 明确拒绝

## Phase C4: 前端

- [ ] `speckit/src/features/chat/`：会话流 + 交互面卡片（无固定表单/页面）
- [ ] `speckit/src/core/interaction/`：Plan 渲染器（按 kind 分派到既有 UI 原子）
- [ ] 未知 kind → 拒绝渲染整个 plan 并提示（fail-closed）

## Phase C5: 端到端

- [ ] e2e：一句话 → 工具调用 → plan → 确认令牌 → 写操作 → 审计可查
- [ ] e2e：越权/未声明能力 → 明确拒绝且留痕
- [ ] 文档：`docs/META_LANGUAGE.md` 补 `Interaction Surface` 这一条元语（§3.9 或并入 §3.5.1）
