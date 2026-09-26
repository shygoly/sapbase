# Design: 可交付的 Blueprint（生成器方向）

## 目标与验收判据

**目标**：让"某个行业的 ERP"成为一个**能被授权、能交付、能在别处运行**的制品。

**唯一验收判据**（不是演示）：

```text
在租户 A 导出并签名的包，在租户 B 用同一个 Runtime 装载并运行成功；
反过来：未授权的租户装载被拒、被篡改的包被拒、过期的授权被拒。
```

同时**不放松任何既有闸**：未覆盖文件仍拒编译、IR 摘要仍比对、装载仍 fail-closed。
本次是加严。

---

## 一、Blueprint 的分层（本变更后的完整形态）

```text
blueprint.json（作者元数据，不进包）
manifest.json（包内唯一权威：id / 版本 / runtime / 依赖 / 分层 / 逐文件哈希 / 授权 / 签名）
semantic.json      ✅ 已有   实体 / 字段 / 关系 / 状态 / 迁移
flows.json         ✅ 已有   流程（v1 约定为 DAG）
rules.json         🆕 本变更 校验 / 审批 / 记账
experience.json    🆕 本变更 经验策略（什么重要、要确认、能自动、何时触发交互面）
license.json       🆕 本变更 授权与签名（租户绑定 / 再销售 / 到期 / Ed25519 签名）
```

### 为什么是这五个，不是六个（BOM 去哪了）

v3 设计文档的 Blueprint 列了"BOM"。本变更**不把它做成层**：

- BOM 是 `Item` / `BOMLine` 这类**实体与关系** → 属于 `semantic.json`
- 单列成层，等于允许"BOM 绕过语义校验"（字段类型、引用完整性都不查它）
- 判据：**能被 `semantic.json` 表达的，不新开一层**。

同理，**Form 不再是层**（见 decisions 第 1 条）：交互由 `experience.json` + 意图即时生成。

### `experience.json` 是什么（不是表单）

它只回答四个问题，且**不含任何布局信息**：

| 字段 | 回答的问题 | 例子 |
| --- | --- | --- |
| `priority` | 哪些信息在人面前首先重要 | `["supplier", "amount", "deliveryDate"]` |
| `confirm` | 哪些动作必须人工确认 | `purchase-order.create` 当金额 > 50 万 |
| `automate` | 哪些动作可无人执行 | `inventory.recompute` |
| `surfaces` | 什么条件该生成一个临时交互面 | 触发词/实体状态 → `surface` 标识 |

**关键**：它描述"何时需要人介入"，**不描述界面长什么样**。界面是
`add-chat-first-erp` 里那份 `interaction-plan/v1` 的产物。
两份协议的分工：

```text
experience.json  →  平台的决策输入：这里需要人确认吗？什么最重要？
interaction-plan →  一次具体交互的输出：这次展示什么、能做什么
```

---

## 二、`rules.json`：三类规则，都可编译期判定

```jsonc
{
  "validation": [
    { "id": "po-amount-positive", "entity": "PurchaseOrder", "field": "amount",
      "rule": "greaterThan", "value": 0, "message": "金额必须为正" }
  ],
  "approval": [
    { "id": "high-value", "entity": "PurchaseOrder", "when": "amount > 500000",
      "steps": [{ "role": "finance-manager" }, { "role": "gm" }] }
  ],
  "accounting": [
    { "id": "po-received", "on": "PurchaseOrder.received",
      "entries": [
        { "account": "1401", "side": "debit",  "amount": "$entity.amount" },
        { "account": "2202", "side": "credit", "amount": "$entity.amount" }
      ] }
  ]
}
```

**编译期判据**（确定性，不靠人看）：

1. `validation[].entity` / `field` 必须在 `semantic.json` 里存在
2. `approval[].entity` 必须存在，`when` 里的字段引用必须存在
3. `approval[].steps[].role` 必须是平台已知角色
4. `accounting[].on` 必须是一个**已声明的事件**（`Entity.state`）
5. `accounting[].entries[].account` 非空；`side` 只能是 debit/credit；
   借贷**在同一 rule 内必须平衡**（可静态判断的部分：金额表达式相同则必须相等符号）

判据 5 的"平衡"只做能做的那一半：表达式是字面量时要求借贷相等；
是引用（`$entity.amount`）时要求左右引用同一表达式。**不做代数化简**——
那是另一个量级的东西，而"看起来像平衡检查其实不检查"比没有更糟。

---

## 三、`license.json` 与验签

```jsonc
{
  "license": "blueprint-license/v1",
  "grantedTo": ["org-1111"],          // 允许运行的租户；空数组 = 不限制（平台自用）
  "resell": false,                     // 能否被再销售
  "expiresAt": "2027-09-25T00:00:00Z", // 可选
  "issuer": "sapbase-platform",
  "signature": "base64(Ed25519(包内容摘要))"
}
```

### 验签链（顺序固定，任一不过即拒）

```text
1. 包完整性（逐文件哈希）           ← 已有
2. 编译（Schema/依赖/冲突/IR）       ← 已有，本变更多两层判据
3. 防漂移（irDigest 比对）           ← 已有
4. license.json 存在且形状合法       ← 本变更
5. 签名有效（Ed25519，公钥来自平台信任根）← 本变更
6. 授权匹配（租户在 grantedTo 内；未过期）← 本变更
7. 绑定原子实现                      ← 已有
```

**签名覆盖什么**：`manifest`（含逐文件哈希）的规范化 JSON。
这样"改任一文件 → 哈希变 → 签名失效"，且不需要对每个文件单独签名。

**为什么 Ed25519**：与 `wasm-modules` 里"签名算法 = Ed25519（留给控制面实现）"是同一选择，
不新造第二套密码学（元语不变量 12）。Node 内置 `crypto` 支持，无需新依赖。

### 开发模式例外（必须显式）

`BLUEPRINT_ALLOW_UNSIGNED=1`：

- 只豁免第 4–6 步（授权链），**不豁免**完整性、编译、防漂移
- 每次装载写审计 `blueprint.load.unsigned`
- 生产配置（`NODE_ENV=production`）下该开关**被忽略并报错**（不是"警告"）

---

## 四、交付验证怎么做（验收判据的落地）

```text
租户 A（卖家视角）
  1. 导出包（已有：module → 最小蓝图；本变更后可含 rules / experience）
  2. 写 license.json（grantedTo: [org-B]）
  3. 平台私钥签名 → 交付 .erpkg

租户 B（买家视角）
  4. 装载（同一个 Runtime，未改一行代码）
  5. 验签 → 授权匹配 → 编译 → 绑定 → 可执行

反例（必须都拒）
  6. 把 grantedTo 改成 org-C 但不重签 → 签名失效
  7. 用 org-C 装载原包 → 授权不匹配
  8. 过期授权 → 拒
```

证据形式：一条 e2e + 一份"跨租户装载"的可复现记录（命令与输出都在 tasks.md）。

---

## 五、风险与对策

| 风险 | 对策 |
| --- | --- |
| 签名让本地开发处处报错 | 显式豁免开关（dev only）+ 审计留痕 + 生产忽略该开关 |
| `rules.json` 的判据越写越像"半个解释器" | 判据清单写进协议文本，且**只做引用完整性与字面量平衡**；表达式求值属 runtime，不属编译期 |
| `experience.json` 退化成表单 | 协议里禁止布局字段（`layout` / `width` / `position` 一律非法，`additionalProperties: false`） |
| 授权做成"能绕过的东西" | 授权检查在**装载器**里（与 IR 防漂移同一层），不是在 API 层加个装饰器 |
| 让既有包失效 | 新层是**可选**的；没有 rules/experience 的包照旧能编译（但装不出"能卖的模板"） |

## 六、元语落点

| 元语维度 | 本变更的位置 |
| --- | --- |
| $\Phi$ Constraint / Policy / Behavior | `rules.json` 的 validation / approval / accounting |
| $\Sigma$ State | `flows.json`（已有）+ `approval.steps` 的角色链 |
| $\Gamma$ Capability | 规则与经验策略**引用**能力，但不定义能力（能力仍在原子契约里） |
| $\Tau$ Time / $V$ Version | `license.expiresAt`、`manifest.version`、`compiled.irDigest` |
| $C$ Context | `license.grantedTo`（租户绑定的判据来源） |
| **新增** | `Experience Policy`（经验策略）—— 交互的**决策输入**，与 Interaction Surface（输出）配对 |
