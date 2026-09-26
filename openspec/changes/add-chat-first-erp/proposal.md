# Change: Add Chat-First ERP（Formless ERP）

## Why

当前 ERP 的**一等公民是页面**：`speckit/src/core/page-model` 驱动固定页面，
`features/` 里是按业务分的固定界面。用户要办事，先得知道"这件事在哪个菜单下"。

而这条线上真正可靠的部分（原子执行、Blueprint 编译/加载、插件沙箱、审计）**都没有页面**：
它们只认「语义 + 能力 + 权限 + 审计」。

```text
今天：人适应软件                     目标：软件实时适应人的当前意图
菜单 → 页面 → 表单 → 填 → 提交        说一句话 → 计划 → 确认 → 执行
```

本变更把 ERP 改成 **chat 智能体为主**：交互单位不再是 Form/Page/Menu，
而是**一次意图与一个临时交互面**（Interaction Surface）。

一句话概括产品定义：

> **Formless ERP**：没有固定表单，只有业务语义、状态与动作；界面由运行时按当前意图即时生成。

## 参考实现（`~/projects/guangfa/validation`）

那个验证工程的**工具契约**（`contracts/tools.json`）正是我们要的形状：每个工具声明
`parameters`（JSON Schema）/ `permission` / `write` / `timeoutMs` / `sensitiveArgs` /
`agentInvocable` / `allowedAgents`。14 个工具里有 6 个是写操作，每个都带独立权限点。

它证明了一件关键的事：**给智能体的工具面可以是协议，而不是提示词**。
本变更把这条移植过来，并与本项目已有的能力模型（原子契约 / 插件清单 / 审计）对齐。

## What Changes

- **ADDED**: `schemas/agent-tool.schema.json` —— 工具契约：参数形状、权限点、是否写、
  超时、敏感参数、是否允许智能体调用。**智能体只能用契约里的工具**，不能凭空做事
- **ADDED**: `schemas/interaction-plan.schema.json` —— **Interaction Plan**：
  运行时产出的结构化交互计划（blocks + actions + warnings + 是否需要确认）。
  **它不是 HTML，也不是"动态表单"**：渲染器只认这份结构
- **ADDED**: `docs/protocols/chat-erp.md` —— 判据文本：智能体不拥有事实 / 写操作必须确认 /
  工具只能来自契约 / 未知 block 类型必须拒（fail-closed）
- **ADDED**: `contracts/tools.json` —— 本仓库的工具契约（首批暴露已有能力：
  查蓝图、跑原子计算、列模块、导出蓝图…）
- **ADDED**: `backend/src/agent-tools/` —— 契约加载 + 校验 + 权限（复用
  `missingPermissions`）+ 审计（复用 `audit_logs`）+ 写操作确认令牌
- **ADDED**: `backend/src/chat/` —— 会话编排：意图 → 选工具 → 生成 Interaction Plan；
  **v1 的编排是确定性的**（LLM 只是可替换的适配器，见 decisions）
- **ADDED**: `speckit/src/features/chat/` —— chat 优先界面 + **Interaction Plan 渲染器**
  （唯一的 UI 原语；没有固定表单/页面）
- **MODIFIED**: 前端入口从"页面菜单"改为"会话 + 临时交互面"

## Impact

- 受影响规格：新增能力 `chat-erp`；不修改原子/蓝图/插件三条线的判据（它们已经是判定的落点）
- 受影响代码：`backend/src/`（新增 agent-tools / chat）、`speckit/src/features/chat/`、
  `schemas/`、`contracts/`
- **对外契约不变**：智能体调用原子仍走既有 REST 与权限校验；本变更只是**多了一层入口**，
  不是"绕过规则的新通道"
- 风险：**让 AI 直接操作 ERP 的可靠性风险**。对策写在 decisions 与 `chat-erp.md`：
  可用工具是白名单契约、写操作要确认令牌、事实与规则仍归 runtime

## 与既有资产的关系（**不重写，只接线**）

| 已有 | 在 chat-first 里的角色 |
| --- | --- |
| 原子契约 + 零能力 Wasm 运行时 | 智能体唯一能"算"的地方（`atomic.invoke` 工具） |
| Blueprint 包 / 编译器 / 加载器 | 智能体唯一能"看业务定义"的地方（`blueprint.*` 工具） |
| 插件沙箱 + 能力中介 | 智能体的第三方能力来源（`plugin.invoke` 工具） |
| `audit_logs` | 智能体每一次工具调用的落点（谁、何时、为什么、结果） |
| `ai-models` 注册表 | LLM 适配器的真源（本变更不新造模型配置） |

## Decisions Made

1. **先做在同一个仓库、同一个分支上**（`codex/chaterp`），不复制一份到
   `projects/chaterp`。理由：复制会立刻产生**第二份真源**（原子判据、权限判定、审计出口），
   而 `docs/META_LANGUAGE.md` 的不变量 12 明确要求"一份判定逻辑只写一次"。
   但结构上**按可抽取的方式划分**：工具契约是文件、编排是独立模块、前端是一个 feature ——
   真要独立成项目时是"搬走"而不是"重写"。
2. **v1 的编排是确定性的**：`意图 → 工具选择 → Interaction Plan` 走一条可测的确定性路径，
   LLM 只是 `IntentParser` 这个接缝后面的可替换实现。理由：先证明"边界是对的"，
   再让它变聪明；反过来会得到"看起来聪明但没人敢用"的东西。
3. **Interaction Plan ≠ HTML**。智能体产出结构化计划，渲染器确定性执行 ——
   智能体可以快速变化，而 UI Runtime 保持确定性（这也是参考工程的气质）。
4. **写操作必须有确认令牌**：Plan 里的 write 动作先"提案"，用户确认后由平台签发一次性令牌，
   执行时校验。**智能体不能自己确认**。

## Out of Scope

- 语音 / OCR / 邮件入口（本变更只做 chat；其余入口共用同一份 Interaction Plan 协议）
- 前端插件（UI 侧插件沙箱）与 Experience Policy 的完整形态
- 把 JEV 做成"本地 100ms 决策层"的性能工程：本变更只定**协议与边界**，
  本地推理/边缘部署另立变更
- 语义层的图/向量检索
