# Design: Chat-First ERP（Formless ERP）

## 目标与边界

**目标**：把 ERP 的交互单位从「页面/表单」换成「**意图 + 临时交互面**」。

**三条边界**（写死在协议里，不是靠提示词约束）：

1. 智能体**不拥有事实**：数据只从 runtime 来（原子/注册表/审计），智能体不缓存业务真相。
2. 智能体**不拥有规则**：权限、审批、账务、状态迁移仍由平台判定。
3. 智能体**不能自己确认**：写操作需要平台签发的一次性确认令牌。

```text
                Human Intent（chat / voice / OCR / 邮件 —— 本变更只做 chat）
                          ↓
        ┌────────────── Chat Orchestrator（backend/src/chat）──────────────┐
        │  IntentParser（v1 确定性；LLM 是可替换适配器）                    │
        │  ToolSelector（只从 contracts/tools.json 里选）                  │
        └───────────────────────────┬─────────────────────────────────────┘
                                    ↓  工具调用（带权限 + 审计）
        ┌──────────────────── Agent Tool Registry ────────────────────────┐
        │ 契约校验 → 权限 all-of（复用 missingPermissions）→ 审计 → 执行     │
        │ 写操作额外要求：一次性 confirmation token                         │
        └───────────────────────────┬─────────────────────────────────────┘
                                    ↓
   Semantic / Blueprint / Atomic / Plugin / Ledger（**事实与规则都在这一层**）
                                    ↓
        Interaction Plan（结构化）→ Local Renderer → 临时交互面（用完即消失）
```

---

## 一、工具契约（`contracts/tools.json`）

形状直接借鉴 `~/projects/guangfa/validation/contracts/tools.json`，并按本项目调整：

| 字段 | 含义 | 为什么必须有 |
| --- | --- | --- |
| `name` / `description` | 工具标识与用途 | 智能体选择工具的唯一依据 |
| `parameters` | JSON Schema | 参数形状可校验（智能体不能传幻觉字段） |
| `permission` | 权限点 | 复用既有权限系统；**缺权限即拒** |
| `write` | 是否改数据 | 决定要不要确认令牌 |
| `confirmation` | 写操作确认策略 | `none` / `required`（v1 写操作一律 required） |
| `timeoutMs` | 超时 | 工具不能挂死会话 |
| `untrustedResult` | 结果不可信标记 | 结果里有外部文本时必须标注（防注入） |
| `sensitiveArgs` | 敏感参数名 | 审计里要脱敏（复用我们刚加严的脱敏清单） |
| `agentInvocable` / `allowedAgents` | 谁能调 | 不是所有工具都该给智能体 |

首批工具（**只暴露已有能力，不新造功能**）：

```text
erp_blueprint_list        读   列蓝图包（看业务定义有哪些）
erp_blueprint_manifest    读   读某个包的清单（版本/依赖/分层）
erp_blueprint_compile     写?  编译蓝图（不改业务数据，但会产生编译记录 → v1 按读处理）
erp_atomic_invoke         读/写 跑原子（calculation/query 是读；v1 只放 calculation/query）
erp_module_list           读   列模块注册表
erp_module_export         写   导出最小蓝图包（产生文件 → 需要确认）
```

> 判据：**工具面是白名单**。智能体说"我要删除订单"，平台只会回答"没有这个工具" ——
> 不是"拒绝了你的请求"。这与插件沙箱那条线是同一个原则：**未声明即不存在**。

---

## 二、Interaction Plan（协议的核心）

智能体**不生成 HTML**，只生成结构化计划：

```jsonc
{
  "plan": "interaction-plan/v1",
  "surface": "purchase-order-draft",      // 临时交互面的标识（不是页面路由）
  "title": "给宁波华兴下 50 万铜材采购单",
  "blocks": [
    { "kind": "facts",    "items": [{ "label": "供应商", "value": "宁波华兴" }] },
    { "kind": "lines",    "items": [{ "label": "铜材", "quantity": 50, "unit": "吨" }] },
    { "kind": "anomaly",  "severity": "warn", "message": "本次价格比上次高 8.7%" },
    { "kind": "trace",    "tools": ["erp_atomic_invoke:available-inventory"] }
  ],
  "actions": [
    { "kind": "confirm", "id": "confirm", "label": "确认下单", "tool": "erp_purchase_order_create", "requiresConfirmation": true },
    { "kind": "edit",    "id": "edit-price", "label": "改价格", "fields": ["price"] },
    { "kind": "cancel",  "id": "cancel", "label": "算了" }
  ],
  "needsConfirmation": true
}
```

三条硬约束：

1. **block / action 的 `kind` 是封闭枚举**。渲染器遇到未知 `kind` MUST 拒绝渲染整个 plan
   （而不是"跳过不认识的部分"）—— 跳过等于让智能体悄悄决定哪些内容不展示。
2. **每个 action 必须绑定一个工具**（`cancel` 除外）：界面上的按钮不是"随便一个回调"，
   而是"某个契约工具的入口"。没有工具的动作做不了事。
3. **`trace` 是必填语义**：plan 要能说出"我用了哪些工具得到这些事实"（可审计、可复现）。

---

## 三、会话编排（v1 确定性，LLM 是可替换适配器）

```ts
interface IntentParser {
  parse(input: { message: string; context: ChatContext }): Promise<Intent>
}
```

- v1 实现 `RuleBasedIntentParser`：按工具契约里的触发词/参数映射把话变成结构化意图
  （例如"下 X 的采购单" → `erp_purchase_order_draft`）；**能测、能复现**。
- LLM 实现（kimi / openai，配置来自既有 `ai-models` 注册表）放在同一接缝后面，
  它的输出**同样**要过工具契约与权限 —— 这是"让 AI 变聪明但不放松边界"的关键。
- 为什么先做确定性：先证明**边界成立**，再让它聪明。反过来会得到
  "看起来聪明、没人敢用"的东西。

---

## 四、前端：chat 优先 + 唯一渲染器

- `speckit/src/features/chat/`：会话流（用户消息 / 助手消息 / **交互面卡片**）
- `speckit/src/core/interaction/`：**Plan 渲染器** —— 只认 `interaction-plan.schema.json`，
  按 `kind` 分派到既有 UI 原子（复用 `core/ui`，不新建设计语言）
- 原有的页面模型（`core/page-model`）**不删**：它退化为"plan 渲染器的一个 block 类型"，
  用于那些确实需要完整页面形态的场景（向后兼容，不是路线目标）

---

## 五、风险与对策

| 风险 | 对策 |
| --- | --- |
| 智能体绕过规则直接改数据 | 工具面是白名单契约 + 权限 all-of + 写操作确认令牌；智能体**没有**第二个入口 |
| 提示注入（工具结果里带"忽略上述指令"） | 结果里含外部文本的工具标 `untrustedResult`，编排器对它降级为"数据而非指令"；审计留原始引用 |
| 智能体生成渲染器不认识的东西 | 未知 `kind` → 拒绝渲染整个 plan（fail-closed），并在审计里记下未知 kind |
| 会话变慢（参考工程里的"100ms"诉求） | v1 不做性能承诺；协议先定，本地/边缘推理另立变更 |
| 两套真源（复制到 `projects/chaterp` 后分叉） | 本变更在同一分支上做，按可抽取方式划分模块；真要独立时是"搬走" |

## 六、与 META_LANGUAGE 的落点

| 元语维度 | chat-first 里的位置 |
| --- | --- |
| $E$ Entity / $R$ Relation | 蓝图 `semantic.json`（智能体通过 `blueprint.*` 工具读） |
| $\Phi$ Rule / $\Sigma$ State | 蓝图 `flows.json` + 编译器的冲突判据（智能体**不判**） |
| $\Gamma$ Capability | 原子契约（`erp_atomic_invoke`）+ 插件能力（`plugin.invoke`） |
| $\Lambda$ Event | 工具调用的审计事件（`chat.tool.invoked` / `chat.plan.emitted`） |
| $\Tau$ Time / $V$ Version | 蓝图版本与编译记录（`compiled.irDigest`） |
| $C$ Context | `ChatContext`（组织/用户/当前业务对象）→ 权限判定的输入之一 |

**新增的元语概念只有一个**：`Interaction Surface`（临时交互面）。
它不是页面、不是表单，而是"一次意图的可视化投影"，**用完即消失**。
