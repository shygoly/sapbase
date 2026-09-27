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

- [x] `contracts/tools.json`：首批工具（蓝图 list/manifest/compile、原子 invoke、模块 list/export）
- [x] `backend/src/agent-tools/`：契约加载与校验（形状 + 权限点存在性）
- [x] 调用链：契约 → 权限 all-of（复用 `missingPermissions`）→ 审计（复用 `audit_logs`）→ 执行
- [x] 写操作：`confirmation` 为 required 时，无令牌即拒；令牌由平台在用户确认后签发（一次性、绑定工具与参数摘要）
- [x] jest：越权被拒并写明缺哪条权限；写工具无令牌被拒；成功调用落审计；未知工具 → 明确错误

> **C2 证据（2026-09-27）**：`npm run build --workspace backend` → nest build 0 error。
> `npx jest src/agent-tools --runInBand` → **3 passed / 20 passed**（未知工具「没有这个能力」且不审计；越权写出 `tool:blueprint:read`；写工具无令牌/摘要不匹配/已消费拒；成功调用恰好一条 `chat.tool.invoked`）。
> `npm run test --workspace backend` → **Test Suites: 99 passed, 99 total / Tests: 837 passed, 837 total**。
> `rebuild-database --db=sapbase_rebuild` → `已重建 sapbase_rebuild：40 张表`。
> `verify-from-zero --db=sapbase_rebuild` → `✅ 从零重建成功：实体与库无结构差异`。
> `DO_NOT_TRACK=1 POSTHOG_DISABLED=1 openspec validate add-chat-first-erp --strict` → `Change 'add-chat-first-erp' is valid`。
>
> **复核修正（同日）**：`erp_blueprint_compile` 原本暴露了 `stamp`，而 `stamp: true` 会把 IR 摘要
> **写回包内清单** —— 那是 `write: false` 契约下的一条无人确认的写通道（正是 §2 要禁掉的那种）。
> 已从契约参数表里**移除** `stamp`，并在调用点硬编码 `{ stamp: false }`：让能力不存在，
> 而不是"传了也不生效"（执行约定 3）。补回归用例
> `erp_blueprint_compile 声明为读（write=false）时，stamp 这条写通道必须不存在`。
> 复核后重跑：`jest src/agent-tools` → 3 套件 / 20 例；全量单测 **99 套件 / 837 例**；
> `verify-from-zero` → 零结构差异，新表 `agent_confirmation_tokens` 已计入（39 张实体表）。

## Phase C2.5: 授权路径与工具面 e2e（C2 收口）

> 为什么插在这里：C2 让工具面复用既有权限系统（`missingPermissions`），但**既有权限系统
> 根本授予不了权限** —— `users.permissions` 列存在、JWT 也读它，可是 users 的 DTO 不收这个
> 字段，于是没有任何 API 路径能给一个用户 `tool:*`。工具面再对，也没人能真正调用它。
> 另外"令牌一次性"目前只有单测里的 SQL 文本级证明，缺真库证明。两件事都得在 C3 之前关掉，
> 否则 C5 的端到端无从谈起。

- [x] 授权路径：`CreateUserDto` / `UpdateUserDto` 接受可选 `permissions: string[]`（校验 + 文档），
      让既有的 Admin/Manager 守卫写路径能授予权限点（含 `tool:*`）
- [x] 授权路径的证据：真库往返（simple-array 往返一致）+ 非法取值被拒的负例
- [x] `backend/test/agent-tools.e2e-spec.ts`：真 Postgres 跑工具面 —— 未知工具 / 越权（写明缺哪条）/
      写工具无令牌 / **令牌真库一次性消费（二次消费必拒）** / 参数摘要不匹配 / 过期 / 成功落审计
- [x] 新表 DDL 的第三处消费：e2e `beforeAll` 幂等应用；并把该 spec 加进 `ci.yml` 的 e2e 清单

> **C2.5 证据（2026-09-27）**：`npm run build --workspace backend` → nest build 0 error。
> `npm run test --workspace backend` → **Test Suites: 99 passed, 99 total / Tests: 838 passed, 838 total**
> （838 = 本轮的 837 + 复核补的 1 条「非空 `user.permissions` 原样进 JWT payload」：
> 授予之后工具面读的是 JWT 里的 permissions，这一段是「授予 → 能调用工具」之间的桥，
> 而原有用例只覆盖「字段缺失 → `[]`」的回退路径）。
> `rebuild-database --db=sapbase_rebuild` → `已重建 sapbase_rebuild：40 张表`。
> `verify-from-zero --db=sapbase_rebuild` → `✅ 从零重建成功：实体与库无结构差异（另有 3 处默认值写法差异）`。
> `DB_NAME=sapbase_rebuild jest test/agent-tools.e2e-spec.ts` → **12 passed / 12 total**
> （契约 6 工具；未知工具 404 且不审计；越权写出 `tool:module:export`；无令牌不落文件；
> confirm 后库行 `consumedAt IS NULL`；invoke 后 `consumedAt` 非空且二次 403；摘要不匹配 / 过期 403；
> 成功恰好一条 `chat.tool.invoked`/`success`；失败带 `reason`；PUT `permissions` simple-array 往返
> `tool:module:read,tool:module:export`；字符串/`[123]` → 400）。
> 相邻回归 `notifications-inbox` + `outbox`：套件绿（空库 deliver 缺原子契约，沿用既有 skip）。
> `DO_NOT_TRACK=1 POSTHOG_DISABLED=1 openspec validate add-chat-first-erp --strict` → `Change 'add-chat-first-erp' is valid`。
> C5 编排 e2e **未勾**：本轮不做 IntentParser / Plan / 确认编排。

## Phase C3: 编排

- [x] `backend/src/chat/`：`IntentParser` 接缝 + v1 确定性实现 + `ToolSelector`（只从契约里选）
- [x] Plan 生成器：工具结果 → blocks（`facts`/`lines`/`anomaly`/`table` —— 以冻结 schema 的封闭枚举为准；
      `trace` 是顶层字段，不是 block 类型），写操作 → actions（`confirm`/`edit`/`cancel`）
- [x] 拒绝路径：意图匹配不到工具 → 明确回复"没有这个能力"（而不是让 LLM 编一个）
- [x] jest：一句话 → 工具序列 → plan 合法；匹配不到 → 明确拒绝
- [x] `POST /chat/message`：会话入口（把编排结果交给 C4/C5；没有它，前端与端到端无从调用）

> **C3 证据（2026-09-27）**：`npm run build --workspace backend` → nest build 0 error。
> `cd backend && npx jest src/chat --runInBand` → **6 passed / 60 passed**
> （含 C1 的 25 例协议校验；本轮新增：规则表对真契约、指向不存在工具加载即抛、
> 10 条中文说法映射、抽不到 id → null、读计划过 `validateInteractionPlan`、
> 写计划不执行且 `confirm`+args+`needsConfirmation: true`、空蓝图列表仍合法、
> 未知工具名抛错、编排一句话 → plan、匹配不到 → refusal「没有这个能力」、
> 越权上抛 `ForbiddenException`、写工具 `invoke` 0 次）。
> `npm run test --workspace backend` → **Test Suites: 104 passed, 104 total / Tests: 870 passed, 870 total**
> （838 基线 + 本轮 32 例；只增不减）。
> `rebuild-database --db=sapbase_rebuild` → `已重建 sapbase_rebuild：40 张表`。
> `verify-from-zero --db=sapbase_rebuild` → `✅ 从零重建成功：实体与库无结构差异（另有 3 处默认值写法差异）`。
> `DO_NOT_TRACK=1 POSTHOG_DISABLED=1 openspec validate add-chat-first-erp --strict` → `Change 'add-chat-first-erp' is valid`。
> C4 前端 / C5 编排 e2e **未勾**：本轮不做渲染器与真 HTTP 确认链；LLM 适配器只留 `INTENT_PARSER` 接缝。
>
> **复核修正（同日）**：冻结契约里的 `agentInvocable` 与 `allowedAgents`，原先**谁都没判** ——
> `agentInvocable: false` 声明了也照样被编排器选中；`allowedAgents` 更是判不了（v1 没有"智能体身份"
> 这个概念）。两者都会给契约作者一种"我已经限制了谁不能调"的**假安全感**。现已：
> `CatalogToolSelector.select()` 尊重 `agentInvocable === false`（编排器就是智能体那道门，
> LLM 适配器提出的意图也要从这里过）；契约加载对 `allowedAgents` **fail-closed**
> （判不了的字段不接受声明）。补 `tool-selector.spec.ts`（4 例）+ 加载负例 1 例。
> 复核后重跑（最终状态）：`jest src/chat` → **7 套件 / 64 例**；
> 全量单测 → **105 套件 / 875 例**；`nest build` 0 error；`verify-from-zero` 零结构差异。

> **C3 的两条硬约束（写代码前先认下来）**：
> 1. **拒绝不是 plan**。`interaction-plan.schema.json` 的 `trace.tools` 是 `minItems: 1`，
>    所以"没有这个能力"**不可能**表达成合法的 `interaction-plan/v1`。编排结果是判别联合
>    （plan | refusal），拒绝时**不**过 `validateInteractionPlan`，也**不**编一个工具出来。
> 2. **触发词不能进工具契约**。`agent-tool.schema.json` 是 `additionalProperties: false` 且已冻结，
>    所以 v1 的确定性规则表放在编排器里，且**加载时校验每条规则的目标工具 ∈ 契约**
>    —— 规则是候选，契约是裁决（这才是"ToolSelector 只从契约里选"）。
>
> 另：`actions` 也是 `minItems: 1`，所以**读**工具的计划也要带一个动作（`cancel`），
> `needsConfirmation: false`；**写**工具的计划带 `confirm`（绑工具 + args），`needsConfirmation: true`。

## Phase C4: 前端

- [x] `speckit/src/features/chat/`：会话流 + 交互面卡片（无固定表单/页面）
- [x] `speckit/src/core/interaction/`：Plan 渲染器（按 kind 分派到既有 UI 原子）
- [x] 未知 kind → 拒绝渲染整个 plan 并提示（fail-closed）

> **C4 证据（2026-09-27）**：`npm run build --workspace speckit` → **exit 0**，
> 构建产物含 `/[locale]/dashboard/chat` 路由。
> · 会话流 `features/chat/` 调 `POST /api/chat/message`：`kind:'refusal'` 只出助手文本（不渲染卡片）；
> `kind:'plan'` 出 `PlanRenderer` 卡片。
> · 渲染器 `core/interaction/plan-renderer.tsx`：`facts`→键值、`lines`→table、`anomaly`→Alert
> （按 severity 定语气）、`table`→table；动作 `confirm`/`edit`/`cancel` 分派到既有 UI 原子。
> · **fail-closed**：渲染前先过纯函数 `decidePlanRenderable(plan)`；`ok:false` 时**只**渲染拒绝提示，
> 不画任何 block（渲染过程中再遇未知块同样整份拒绝，双重保险）。
> · 判定与渲染分离：`core/interaction/plan-decision.ts` **零 React/DOM/网络依赖**，
> 便于独立复核（speckit 没有测试运行器，本轮不新增依赖）。复核方用
> `npx tsc … --outDir /tmp/c4check` + `node` 亲自跑了 5 类输入，真实输出：
> 合法 plan → `{"ok":true}`；未知 block `html` → `ok:false` 且 reason 说出封闭枚举
> `facts / lines / anomaly / table`；未知 action `delete` → `ok:false`（枚举
> `confirm / edit / cancel`）；`confirm` 缺 `tool` → `ok:false`；`blocks` 非数组 → `ok:false`。
> · 写动作：`agentToolsApi.confirmThenInvoke` 先 `confirm` 拿令牌再 `invoke`；
> `invoke()` **强制要求非空 `confirmationToken`**，没有令牌直接抛错 —— 客户端也堵住了
> "无令牌调写工具"这条路。
> · **临时交互面**：`core/interaction/surface.ts` 显式 `navigable: false` / `href: null` /
> `lifetime: session-only`；确认或取消后从会话流里移除。**没有** `/chat/[surface]` 路由，
> 交互面不可收藏、不可直接到达。会话页本身在导航里（否则人找不到入口），
> 但交互面不在——这两条约束不冲突。
> · 未改 `core/page-model`（按 design 向后兼容保留）；未新增 npm 依赖；未碰 `backend/`。
> · i18n 文案按既有约定补齐 8 个语言文件。
>
> **复核修正（同日）**：`design.md` 的 plan 示例有两处与冻结 schema 不符 ——
> block 里写了 `"kind": "trace"`（`trace` 其实是**顶层**字段，block 的封闭枚举是
> `facts/lines/anomaly/table`），`confirm` 动作上写了 schema 里不存在的 `requiresConfirmation`。
> 已按 `schemas/interaction-plan.schema.json` 改正，并补上示例里缺的顶层 `trace`
> （schema 的 `required` 里有它）。修正后的示例已用 `JSON.parse` 校验：
> 7 个必填字段齐、block 四种 kind、action 三种 kind 全在封闭枚举内。

## Phase C5: 端到端

- [x] e2e：一句话 → 工具调用 → plan → 确认令牌 → 写操作 → 审计可查
- [x] e2e：越权/未声明能力 → 明确拒绝且留痕
- [x] 文档：`docs/META_LANGUAGE.md` 补 `Interaction Surface` 这一条元语（§3.9 或并入 §3.5.1）

> **C5 证据（2026-09-27）**：`backend/test/chat-first-erp.e2e-spec.ts`（真 Postgres，最小
> TestingModule 装 `AgentToolsModule` + `ChatModule`）。
> `DB_NAME=sapbase_rebuild jest --verbose test/chat-first-erp.e2e-spec.ts` → **5 passed / 5 total**：
> · 读路径：「列出模块」→ `kind=plan`、plan 过 `validateInteractionPlan {valid:true}`、
> `trace.tools` 非空、`needsConfirmation=false`；
> · 写路径：「把模块 X 导出为最小蓝图包」→ `kind=plan`、`needsConfirmation=true`、
> `confirm.tool=erp_module_export` 且**导出目录仍为空**（未执行）→ `confirm` 200 且库行
> `consumedAt IS NULL` → `invoke` 200、目录出现产物、库行 `consumedAt` 非空 →
> **同一 token 再 invoke 403** → `audit_logs` 里恰好 1 条 `chat.tool.invoked`/`success`，
> `metadata.tool=erp_module_export`、`argsDigest` 64 位；
> · 未声明能力：「把订单删了」→ `kind=refusal`、文案含「没有这个能力」、**审计行数不增**；
> · 越权：缺 `tool:module:export` → confirm 后 invoke 403、错误写明该权限点、0 条成功审计；
> · 无令牌 → 403 且孤立目录仍为空。
> 导出落盘只走 `mkdtempSync` 临时目录（`BLUEPRINT_EXPORT_DIR` / `BLUEPRINT_PACKAGES_DIR`），
> `afterAll` 清理，**没有写进仓库**。
> 该 spec 已追加进 `ci.yml` 的 e2e 清单（末尾一行，未重排）。
> `docs/META_LANGUAGE.md`：新增 `### 3.9 Interaction Surface（临时交互面）`
> （§3.8.1 之后、§4 之前，未重编号），版本 1.12 → 1.13，§8 追加一行，真源指向
> `docs/protocols/chat-erp.md`。
> 复核方实测：`nest build` 0 error；全量单测 108 套件 / 896 例；`verify-from-zero` 零结构差异；
> `openspec validate add-chat-first-erp --strict` 通过。
>
> **复核发现（与本变更无关的既有问题，另行处理）**：整条 e2e 清单按顺序跑时，
> `traceability-import` 的两条批次追溯用例各卡 60s 超时；**重建库后单独跑该 spec 7/7 全绿**。
> 该 spec 用 guard 替身、不走登录、不读 User，与本轮任何改动都无交集 —— 是**顺序/数据量敏感**
> 的既有问题，之前因为它走 `deliver` 失败 skip 而没暴露。
> 另有 `document-runtime` / `currency-permissions` / `outbox` 三条在从零空库上走既有 skip
> （缺 `available-inventory` active 契约）。
