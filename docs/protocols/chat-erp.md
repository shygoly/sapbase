# Chat-First ERP（Formless ERP）判据

> 版本：v1
> 日期：2026-09-25
> 定位：**chat-first 的唯一判据文本**。编排器、渲染器、工具面都只做本文件里的判定。
> 相关：`schemas/agent-tool.schema.json`、`schemas/interaction-plan.schema.json`、
> `docs/META_LANGUAGE.md`（不变量）。

---

## 0. 产品定义（一句话）

> **Formless ERP**：没有固定表单，只有业务语义、业务状态与业务动作；
> 交互界面由运行时按当前意图**即时生成**，用完即消失。

固定下来的只有：`Semantic / Rule / State / Workflow / Atomic / Ledger / Data / Permission / Audit`。
`Form / Page / Menu / Dialog` 全部降级为运行时的**临时产物**。

---

## 1. 三条边界（写死在协议里，不靠提示词）

| # | 边界 | 落地方式 |
| --- | --- | --- |
| 1 | 智能体**不拥有事实** | 数据只从工具结果来；计划必须带 `trace.tools`（说不出依据的计划非法） |
| 2 | 智能体**不拥有规则** | 权限/审批/账务/状态迁移仍由平台判定；工具调用过权限 all-of |
| 3 | 智能体**不能自己确认** | 写操作需要平台签发的一次性确认令牌；编排器无权签发 |

> 为什么这三条要写进协议而不是提示词：提示词是**请求**，协议是**边界**。
> 模型换一版、提示被注入一句，请求就可能失效；边界不会。

---

## 2. 工具面：白名单，未声明即不存在

智能体可调用的工具 MUST 来自 `contracts/tools.json`。这意味着：

- 用户说"把订单删了"，而契约里没有删除工具 → 平台回答**"没有这个能力"**，
  不是"拒绝了你的请求"。差别很重要：前者智能体无法自行编造替代路径，后者它会去试别的。
- 每个工具声明：`parameters`（JSON Schema）/ `permission` / `write` / `confirmation` /
  `timeoutMs` / `untrustedResult` / `sensitiveArgs` / `agentInvocable`。
- `write: true` 而 `confirmation: 'none'` 是**非法契约**（校验器直接拒）——
  那等于一条无人确认的写通道。

### 执行链（顺序固定）

```text
契约查得到？ → 形状合法？ → 权限 all-of 满足？ → （写操作）令牌有效？
   → 执行 → 审计（成功与失败都写）
```

任一步不过即拒，**不部分执行**、不回退到"换个工具试试"。

---

## 3. Interaction Plan：结构化计划，不是 HTML

智能体**不生成 HTML**。它生成 `interaction-plan/v1`，渲染器确定性执行。

```jsonc
{
  "plan": "interaction-plan/v1",
  "surface": "purchase-order-draft",     // 临时交互面标识（不是路由）
  "title": "给宁波华兴下 50 万铜材采购单",
  "blocks": [
    { "kind": "facts",   "items": [{ "label": "供应商", "value": "宁波华兴", "source": "erp_module_list" }] },
    { "kind": "lines",   "items": [{ "label": "铜材", "quantity": 50, "unit": "吨" }] },
    { "kind": "anomaly", "severity": "warn", "message": "本次价格比上次高 8.7%" }
  ],
  "actions": [
    { "kind": "confirm", "id": "confirm", "label": "确认下单", "tool": "erp_purchase_order_create" },
    { "kind": "cancel",  "id": "cancel",  "label": "算了" }
  ],
  "trace": { "tools": ["erp_atomic_invoke:available-inventory"], "intent": "下采购单" },
  "needsConfirmation": true
}
```

### 三条硬约束

1. **封闭枚举**：`blocks[].kind` ∈ {`facts`, `lines`, `anomaly`, `table`}；
   `actions[].kind` ∈ {`confirm`, `edit`, `cancel`}。
   渲染器遇到未知值 MUST **拒绝渲染整份计划**，MUST NOT 跳过未知部分继续渲染 ——
   跳过等于让智能体悄悄决定"哪些内容不展示"。
2. **动作必须绑定工具**（`cancel` 除外）：界面上的按钮不是"随便一个回调"，
   而是某个契约工具的入口。没有工具的动作做不了事。
3. **`trace.tools` 非空**：计划必须能说出事实来自哪些工具调用；每个调用都能在审计里查到。

### `needsConfirmation` 必须与动作一致

含 `confirm` 动作 → 必须为 `true`；不含 → 必须为 `false`。
渲染器据此决定要不要强调确认；不一致会让它按错的信号渲染。

---

## 4. 明确不判什么

- **不判业务正确性**："这个采购价合理吗"是 Rule/Policy 的事，不是编排器的事。
- **不判智能体的措辞**：文案质量不是判据；只判结构与边界。
- **不判 `untrustedResult` 内容的语义**：标注了来源不可信即可，平台不解析其意图
  （解析外部文本的意图本身就是新的注入面）。
- **不做性能承诺**：v1 只定协议与边界；"本地 100ms 决策"属后续变更。
- **不删除既有页面模型**：`core/page-model` 退化为 plan 渲染器的一个 block 类型，
  向后兼容；它不再是路线目标，但也不需要先拆掉才能往前走。

---

## 5. 一条元语级的新增

本协议给元语加的唯一新概念是 **Interaction Surface（临时交互面）**：

> 它不是页面、不是表单，而是**一次意图的可视化投影**；确认或取消后即消失，
> 不进入任何导航结构。

判据：任何"需要被记住位置、能被收藏、能通过 URL 直接到达"的东西**不是** Interaction Surface
—— 那是页面。两者可以并存，但不能混为一谈。
