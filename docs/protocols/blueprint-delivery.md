# Blueprint 交付协议 v1

> 状态：**已冻结（v1）**
> 权威形状：
> [`schemas/blueprint-rules.schema.json`](../../schemas/blueprint-rules.schema.json)、
> [`schemas/blueprint-experience.schema.json`](../../schemas/blueprint-experience.schema.json)、
> [`schemas/blueprint-license.schema.json`](../../schemas/blueprint-license.schema.json)
> 相关：[IR](./blueprint-ir.md)、[项目元语](../META_LANGUAGE.md) §3.8、
> OpenSpec change `add-deliverable-blueprint`

本文件回答：**一份行业 ERP 怎样成为能被授权、能交付、能在别处运行的制品**。
实现只做这里写下的判定；想加判据，先改本文件（元语不变量 10）。

---

## 1. 分层（五个，不是六个）

```text
blueprint.json     作者元数据，不进包
manifest.json      包内唯一权威：id / 版本 / runtime / 依赖 / 分层 / 逐文件哈希 / 签名
semantic.json      实体 / 字段 / 关系 / 状态 / 迁移
flows.json         流程（v1 约定为 DAG）
rules.json         校验 / 审批 / 记账                         🆕 本协议
experience.json    经验策略（何时需要人介入）                    🆕 本协议
license.json       授权声明（租户 / 再销售 / 到期）              🆕 本协议
```

**BOM 不做层。** BOM 是 `Item` / `BOMLine` 这类实体与关系，属于 `semantic.json`。
单列成层等于允许它绕过语义校验。

**Form 不做层。** 交互由 `experience.json`（决策输入）+ `interaction-plan/v1`（一次交互的输出）配对；
再开 Form 层会与 chat-first 的即时生成冲突。

新层都是**可选的**：没有 `rules.json` / `experience.json` 的包照旧能编译。
没有 `license.json` 的包**不能**作为可交付制品装载（见 §5），除非走显式开发豁免。

未覆盖的文件仍然拒绝编译——这条不放松。

---

## 2. `rules.json`：三类规则，都可编译期判定

```jsonc
{
  "rules": "blueprint-rules/v1",
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

`validation[].rule` 是枚举（`required | greaterThan | lessThan | minLength | maxLength | pattern | oneOf | unique`），
`value` 的类型按 rule 用 `allOf/if-then` 约束。
`expression` / `eval` / `script` / `lambda` / `fn` **有意非法**（`additionalProperties: false` + 显式 `not`）。

### 2.1 编译期判据

| # | 判什么 | 失败时 |
| --- | --- | --- |
| 1 | `validation[].entity` / `field` 必须在 `semantic.json` 里存在 | `CompileError`，指明规则 id 与引用 |
| 2 | `approval[].entity` 必须存在；`when` 里抽出的每个标识符必须是该实体的字段，或 `Entity.field` 且实体存在 | 同上 |
| 3 | `approval[].steps[].role` 必须是平台已知角色（见 §2.3） | 同上 |
| 4 | `accounting[].on` 必须是 `flows.json` 展开后的已声明事件 `Entity.state`（`buildEvents` 那批 `on`） | 同上 |
| 5 | `accounting[].entries[].account` 非空；`side ∈ debit\|credit`；借贷平衡只做能做的那一半（§2.4） | 明细必须给出两侧的具体值/表达式 |

另：`semantic.transitions[].rule` 必须能在 `validation[].id` 里解析到；
包内没有 `rules.json`、或 id 对不上，**仍然拒绝**（闸只加严，不放松）。

### 2.2 `approval[].when` 受限表达式（只抽取，不求值）

语法（编译期）：

```text
expr        := or
or          := and ('||' and)*
and         := comparison ('&&' comparison)*
comparison  := primary (('>'|'>='|'<'|'<='|'=='|'!=') primary)?
primary     := IDENT | NUMBER | STRING | '(' expr ')'
IDENT       := 字段名  |  Entity.field
NUMBER      := 可选负号 + 数字（可带小数）
STRING      := '...' 或 "..."
```

只允许：字段标识符、数字/字符串字面量、比较运算符、布尔连接、括号。
**绝不实现求值**——表达式求值属 runtime，不属编译期。语法不合法 → `CompileError`。

抽取到的每个标识符：

- 无点：必须是 `approval[].entity` 的字段名
- `Entity.field`：实体必须存在，字段必须存在

### 2.3 平台已知审批角色

编译期对照这份静态目录（不查库——编译必须是确定性的）：

`owner` / `admin` / `member` / `gm` / `finance-manager` / `purchasing-manager`

不在目录里 → 冲突。要加角色，先改本文件再改编译器（一份判定）。

### 2.4 记账平衡（不做代数化简）

对同一条 `accounting` 规则：

| 两侧金额形态 | 判定 |
| --- | --- |
| 都是字面量数字 | 借方合计必须等于贷方合计 |
| 都是引用 | 借方表达式字符串的多重集合必须等于贷方（同一字面量，不化简） |
| 一侧字面量一侧引用 | **拒**（不可静态判定） |

错信息必须给出两侧的具体值/表达式，不许只写"不平衡"。
`$entity.amount` 与 `100` 即使"看起来该相等"也不判过——那是猜测。

---

## 3. `experience.json`：经验策略，不是表单

```jsonc
{
  "experience": "blueprint-experience/v1",
  "priority": [ { "entity": "PurchaseOrder", "fields": ["supplier", "amount", "deliveryDate"] } ],
  "confirm":  [ { "action": "PurchaseOrder.submitted",
                  "when": { "field": "PurchaseOrder.amount", "op": "greaterThan", "value": 500000 } } ],
  "automate": [ { "action": "available-inventory" } ],
  "surfaces": [ { "id": "purchase-order.approval-needed",
                  "when": { "entity": "PurchaseOrder", "state": "submitted" } } ]
}
```

`design.md` 里 `priority: ["supplier","amount"]` 是示意。协议必须让字段引用**可解析到实体**，
因此用 `{entity, fields[]}`。同样，`inventory.recompute` 是示意动作名；协议要求动作引用可解析（§3.1）。

分工：

```text
experience.json   →  平台的决策输入：这里需要人确认吗？什么最重要？
interaction-plan  →  一次具体交互的输出：这次展示什么、能做什么
```

**布局字段一律非法**：`layout` / `width` / `position` / `component` / `style` / `x` / `y` / `height` / `css` / `class` / `render`。
Schema 用 `additionalProperties: false` **加上**显式 `not`，让拒绝是有意的、可自解释的。

### 3.1 动作引用解析规则

`confirm[].action` 与 `automate[].action` 必须满足以下**之一**，否则 `CompileError`：

1. 等于 `flows.json` 声明的某个事件 `<Entity>.<state>`（即编译器 `buildEvents` 生成的 `on`）
2. 等于 manifest 依赖里已声明的某个原子类型（`dependencies[].atomic`）

`priority[].entity` / `fields[]`、`confirm[].when.field`、`surfaces[].when.entity/state`
必须存在于 `semantic.json`。`surfaces[].id` 必须匹配
`^[a-z][a-z0-9]*(-[a-z0-9]+)*(\.[a-z][a-z0-9]*(-[a-z0-9]+)*)*$`
（段内 kebab-case，如 `purchase-order.approval-needed`）。

---

## 4. IR 覆盖五层（防漂移的实质）

`manifest.files` 的哈希只能证明"文件没被改过"，**证明不了"编译产物跟得上内容"**。
所以结构化 IR 为 `rules` / `experience` 各带一份可选摘要（只加可选字段，仍属 `blueprint-ir/v1`）：

```jsonc
"rules":      { "count": 4, "digest": "sha256:<64hex>" },
"experience": { "count": 3, "digest": "sha256:<64hex>" }
```

- `count`：该层条目总数（validation + approval + accounting，或 priority + confirm + automate + surfaces）
- `digest`：对该层 JSON 的**规范化文本**（键按字典序递归排序、`JSON.stringify` 无空格）做 sha256

改 `rules.json` / `experience.json` 的任何一行（含某个 `value` 的数值），
重新编译得到的 `irDigest` **必变**。没有这两层的包，这两个字段缺省。

文本 IR 同步加行：`rules count=N digest=sha256:...` / `experience count=N digest=sha256:...`。
`parseIrText(toIrText(ir))` 往返等价。

---

## 5. 授权与验签

### 5.1 签名放哪里（避免自指）

- `license.json` = **授权声明文件**（包内文件，其 sha256 进 `manifest.files`）
- **权威签名在 `manifest.signature`**（`manifest.json` 自身不在 `files` 里，因此无循环）
- 签名覆盖对象 = `manifest` 去掉 `signature` 字段后的规范化 JSON（键排序、无空格）
- 于是：改任一被哈希文件 → `files` 哈希变 → manifest 变 → 签名失效；
  只改 `license.json` 而不更新 `files` → 先被包完整性拦下
- `license.json` 允许可选 `signature`（便于单文件阅读）；若存在且 ≠ `manifest.signature` → **拒**

**先编译盖章，再签名。** `compiled`（`irDigest` / `compiledAt`）在签名覆盖范围内，
所以 `stampCompiled` 之后签名才有效；先签后编会让签名失效 —— 这是**有意的**：
编译结果变了就该重签，而不是让一份"签过的包"悄悄换掉编译产物。

算法：Ed25519（Node `node:crypto` 内置）。与 `wasm-modules` 的签名选择同一套，
不新造第二套密码学（元语不变量 12）。

### 5.2 信任根

- 公钥：环境变量 `BLUEPRINT_LICENSE_PUBLIC_KEYS`，值为 PEM 数组的 JSON，支持多把（轮换）
- **未配置 → 验签失败**（fail-closed），不静默通过
- 私钥只在平台侧用于签名，来源 `BLUEPRINT_LICENSE_PRIVATE_KEY`；任何私钥都不得写进仓库或测试快照
- 测试用 `generateKeyPairSync('ed25519')` 现场生成

### 5.3 装载链顺序（固定，任一不过即拒，无部分加载）

```text
1. 包完整性（逐文件哈希 / 清单一致性）
2. 编译（逐文件 Schema → 依赖闭包 → 冲突检测 → IR）
3. 防漂移（manifest.compiled.irDigest 比对）
4. license.json 存在且形状合法
5. 验签（Ed25519，公钥来自信任根）
6. 授权匹配（tenantId ∈ grantedTo，空数组=放行；expiresAt 未过期）
7. 绑定原子实现
```

`grantedTo` 非空而调用方未提供 `tenantId` → 拒（无租户上下文不能证明被授权）。
`expiresAt` 已过 → `license-expired`。租户不在范围内 → `unauthorized`。

### 5.4 `resell` 不做装载门

`resell` 是声明：装载器读取、写入审计、放进返回值。
本协议**不**把它做成装载拒绝条件——装载时没有"这笔交易是否属于再销售"的上下文。
把它写成门，等于用缺上下文的信息做确定性判决，比没有更糟。

**那它在哪里被强制？** 在**订单 / 市场**那条线上 —— 那里才有"这笔交易是不是再销售"的上下文
（谁卖给谁、走的是哪个商品、订单里是否声明了再销售权）。
在此之前，平台**不声称** `resell` 被强制执行：它是**合同条款 + 审计证据**，不是运行时门。

写这段的理由：一个字段如果不写清"谁在哪一层强制它"，读文档的人会默认它是闸；
而默认它是闸、实际没人拦，比明说"这里不拦"危险得多 —— 前者会让人以为已经被保护了。

### 5.5 开发豁免（必须显式且可查）

`BLUEPRINT_ALLOW_UNSIGNED=1`（或 `'true'`；其它值不算）：

- **只豁免第 4–6 步**（license 形状 → 验签 → 授权匹配）
- 完整性 / 编译 / 防漂移**照旧生效**
- 豁免生效时产出审计记录 `blueprint.load.unsigned`
- `NODE_ENV === 'production'` 且该开关为真 → **抛错拒绝**（`unsigned-exemption-in-production`），不是 warn

生产必须拒的理由：未签名豁免一旦能在生产生效，授权链就从"闸"变成"开关"，
攻击者（或一次错误的部署配置）可以装载任意包。报错迫使配置被改掉，警告做不到这一点。

---

## 6. 与其它协议的关系

| 协议 | 关系 |
| --- | --- |
| Blueprint Package | 本协议的三份文件进包；签名落在 `manifest.signature` |
| Blueprint IR | 新两层的确定性摘要写入 IR，供防漂移比对 |
| Atomic Contract | `experience` / `flows` 的动作可引用已声明原子类型 |
| Interaction Surface | `experience.json` 是决策输入；交互面是一次输出 |
| License / Encryption | 本协议落地授权声明与 Ed25519 验签；加密仍属后续 |
