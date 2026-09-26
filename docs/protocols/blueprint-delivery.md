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

`validation[].rule` 是枚举（`required | greaterThan | lessThan | greaterOrEqual | lessOrEqual | minLength | maxLength | pattern | oneOf | unique`），
`value` 的类型按 rule 用 `allOf/if-then` 约束。
`greaterOrEqual` / `lessOrEqual` 是 change `add-minimal-autoparts-template` 的**加法式修订**（新增允许值，既有包不受影响，不放松任何行为判据）；它们与 `greaterThan` / `lessThan` 同组，`value` 必须是 number。
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
comparison  := additive (('>'|'>='|'<'|'<='|'=='|'!=') additive)?
additive    := multiplicative (('+'|'-') multiplicative)*
multiplicative := unary (('*'|'/') unary)*
unary       := '-' unary | primary
primary     := IDENT | NUMBER | STRING | '(' expr ')'
IDENT       := 字段名  |  Entity.field
NUMBER      := 数字（可带小数；负号走 unary）
STRING      := '...' 或 "..."
```

算术只出现在**比较操作数两侧**。顶层必须是布尔条件：
`quantity * unitPrice > 100000` 合法；`amount + 1` **仍非法**（不是条件）。
既有负例 `parseRestrictedExpression('amount + 1') === false` 继续钉住。

编译期入口 `parseRestrictedExpression` **只抽取标识符、不求值**。
求值属 runtime：`evaluateCondition` / `evaluateComputed`（§10），自写解释器，不用 `eval`。

计算字段用**另一套**入口 `parseComputedExpression`（§8.4）。两套共用同一套 token / 优先级，顶层类型不同。

**不许用相近条件静默顶替。** 一条规则的 `id` 与 `message` MUST 描述它**实际检查的东西**：
`id: so-high-value` 配 `when: unitPrice > 100000` 是**错的**——它读起来像"金额大就审批"，
实际只对"单价超过 10 万"生效，10000 件 × ¥10（合计 ¥100,000）不会触发。
这类"看着像检查、其实不检查"的条件比没有条件更危险：它让人以为已经被保护了。

抽取到的每个标识符：

- 无点：必须是 `approval[].entity` 的字段名
- `Entity.field`：实体必须存在，字段必须存在

### 2.3 平台已知审批角色

编译期对照这份静态目录（不查库——编译必须是确定性的）：

`owner` / `admin` / `member` / `gm` / `finance-manager` / `purchasing-manager` / `sales-manager`

`sales-manager` 是 change `add-minimal-autoparts-template` 的**加法式扩充**（未知角色仍拒）。
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

---

## 7. 模板 = 什么（源码 vs 产物）

change `add-minimal-autoparts-template` 把「包能交付」推进到「包能写入实体实例」。
这一节写清目录、约束从哪来、以及运行时**明确不执行**的部分。

### 7.1 源码与产物

| 目录 | 是什么 | 谁写 |
| --- | --- | --- |
| `templates/<id>/` | 模板**源码**（进仓库、可评审）。默认路径 `BLUEPRINT_TEMPLATES_DIR`，否则仓库根 `templates/` | 作者；`deliver` **绝不改这里** |
| `blueprints/` | 模板**产物**（`.erpkg`）。默认路径 `BLUEPRINT_PACKAGES_DIR` | `POST /:id/deliver` 一条命令产出 |

`:id` 在 `deliver` 上指向 `templates/<id>/`；产出的包 id 仍是 `<blueprint>-<version>`
（例如 `auto-parts-min-1.0.0`），因此既有的 `POST /:id/compile` / `GET /:id/manifest` / `POST /:id/load` 继续可用。

### 7.2 交付顺序（先盖章，再签名）

`design.md` 曾写「打包 → 盖章 → 写 license → **重新打包** → 签名」。重新打包会按目录重建清单，
把 `stampCompiled` 写进去的 `compiled` 抹掉，于是清单无法同时留下 `compiled.irDigest` 与 `signature`。

**唯一正确顺序**（写死在 `BlueprintService.deliver`，调用方不各自拼装）：

```text
1. 把 templates/<id>/ 复制到临时 staging（不改源码）
2. 在 staging 写 license.json（经 blueprint-license.schema.json 校验）
3. packBlueprint(staging, <packagesDir>/<blueprint>-<version>.erpkg)
4. compileBlueprint(unpackBlueprint(pkg), registry) → irDigest
5. stampCompiled(pkg, { irDigest, compiledAt })
6. signPackage(pkg, BLUEPRINT_LICENSE_PRIVATE_KEY)   ← 签名必须在盖章之后
```

先签后编会让签名失效——这是有意的：编译结果变了就该重签。
私钥来自 `BLUEPRINT_LICENSE_PRIVATE_KEY`；**未配置 → 抛错拒绝**（不能产出未签名制品）。

### 7.3 约束来自模板校验，不来自数据库

`blueprint_records` 是通用记录表：`data` 是 jsonb，**没有列约束**。
写入链（装载 → 实体已声明 → 字段名已知 → 类型匹配 → reference 存在 → `rules.validation` 字面量比较 → 落库）
在 API 里 fail-closed；**直连数据库写入不受这些约束**。
需要硬约束时走「按语义生成物理表」那条线（另立变更）。

未知字段一律拒（不忽略、不警告）。通用表放过未知字段，等于把校验变成抽查。

### 7.4 本运行时明确不执行

| 被声明 | 本运行时 |
| --- | --- |
| `rules.validation` | **执行**（字面量比较） |
| `approval.when` | **P2 求值**。写入后 / 迁移前按 §10 执行；命中且链未全批则建链或拒迁 |
| `accounting` 分录 | **P2 过账**。迁移成功进入新状态后按 `on === Entity.state` 生成分录；运行时借贷必须平衡 |
| `flows.json` 状态推进 | **P1 已执行**迁移；P2 在同一事务里叠审批闸与分录 |

写清「被声明 ≠ 被强制执行」，避免读文档的人以为审批/记账/流程已经在拦。

### 7.5 缺口实证（T0，为什么必须有语义运行时）

装载本身只证明「包合法、租户被授权、原子能绑定」。下列三项是实测，不是推测：

1. `backend/src/blueprint` **没有**记录写入入口（只有 package / compile / load / manifest）。
2. `rules-expression.ts` 对 `approval.when` **只抽取字段引用，不求值**。
3. `wasm-modules/build/manifest.json` **只有 1 个原子**：`available-inventory`（tier A，abiVersion 1）。

没有语义运行时，模板装载后没有可观察的业务行为——这就是本变更必须包含写入链的原因。

---

## 8. 语义层 P0 声明（表达力）

本节冻结 `semantic.json` 的新可选声明与编译期判据。形状在
[`schemas/blueprint-semantic.schema.json`](../../schemas/blueprint-semantic.schema.json)；
跨字段判据在 `backend/src/blueprint/compiler.ts`。`additionalProperties: false` 不放松。

### 8.1 金额：显式标记 + 裸 decimal 兼容

金额由作者用 `money: true` 声明，不靠猜字段名。

| 声明 | 编译期 |
| --- | --- |
| `{ "type": "decimal" }`（裸 decimal） | **合法**。缺省 `decimal(18,4)`、`rounding: "half-up"` |
| `{ "type": "decimal", "money": true, "precision", "scale", "rounding" }` | 合法；`precision` 1..38，`scale` 0..precision，`rounding` ∈ `half-up` \| `half-even` |
| `{ "type": "number", "money": true }` | **拒**，错误指明字段名（这就是「用 number 声明金额被拒」） |
| `precision` / `scale` / `rounding` 出现在非 decimal 上 | **拒** |
| `scale > precision`（缺省套用后也算） | **拒** |

只写 `precision` 时仍套用缺省 `scale=4`，因此 `precision < 4` 会被拒——必须显式写兼容的 `scale`。

定点运算在 `backend/src/blueprint/money.ts`：整数小单位，`add` / `sub` / `mul` / `compare` **不舍入**，`roundTo` 是唯一舍入点。不引入 decimal 库、不引入浮点。求值进模板运行时属 P2。

归档模板 `templates/auto-parts-min/` 里的裸 `decimal` 与 `number`（`creditDays` / `quantity` 等）继续合法。

### 8.2 枚举 / 唯一 / 关系基数 / 单位

- `type: "enum"` 时 `values` 必填、非空、无重复；`values` 出现在非 enum 上 → 拒。未在集合内的取值被拒是**运行时**行为（属 semantic-runtime / P2），本轮只做协议与编译期。
- `unique: true` 只允许标量（`text` / `number` / `decimal` / `boolean` / `date` / `datetime` / `i32` / `enum`）。`reference` 或计算字段上声明 → 拒（跨表唯一与派生值唯一不是同一件事）。
- 唯一索引由 `uniqueIndexDdl(semantic, blueprintId)` **按模板生成**（部分唯一索引，作用在 `blueprint_records`）。`findUniqueConflicts` **先报告冲突清单**，不直接建索引。**P1** 在装载/写入前幂等 `CREATE UNIQUE INDEX IF NOT EXISTS`（有冲突 → 拒写并报清单）。**P2** 再扩展非空约束，以及冲突时返回可定位错误的完整形态。
- `relations[].cardinality`：`one` \| `many`。`type === "manyToMany"` → **编译期拒**，要求声明显式中间实体、用两条 reference/many 关系表达。
- `uom: { base, packs: [{ name, factor }] }`：`base` 非空；`packs` 至少 1 项；`name` 唯一非空；`factor` 必须是正整数或 `{numerator, denominator}` 两个正整数（用有理数，禁止 0.333）。`0` / 负数 / 非整数 / 分母 0 → 拒。`uom` 只允许在 `number` / `decimal` / `i32` 上。换算运算属 P3（`autoparts-uom-convert`）。

### 8.3 主从结构

头实体 `children: ["SalesOrderLine"]`，行实体 `parent: { entity: "SalesOrder", field: "order" }`（`parent` 放在**实体**上）。

编译期双向一致（任一不过即拒，错误指明哪一侧）：

1. 头 `children[]` 里的每个名字都是已声明实体；
2. 该实体必须声明 `parent` 且 `parent.entity` 回指这个头；
3. 行的 `parent.entity` 是已声明实体，且该头的 `children[]` 包含本行实体；
4. `parent.field` 是本行实体上已声明的字段，且 `type === "reference"`、`reference === parent.entity`。

写入一张两行订单走 P1 单据运行时（见 §9）：头 + 行一次事务，任一行失败整单回滚。

### 8.4 计算字段与两套表达式

字段可选 `computed: { expr, dependsOn }`。本轮**不求值**（求值属 P2）。

编译期：

- `expr` 必须通过 `parseComputedExpression`（算术 `+ - * /`、数字、字段标识符、括号）；
- 抽出的每个标识符必须是**本实体**已声明字段；
- `dependsOn` 的每一项必须是本实体已声明字段；
- `dependsOn` 必须覆盖 `expr` 里抽出的全部标识符（漏了 → 拒：`dependsOn` 是环路判定的输入，漏一项环路检测就不完整）；
- 在 `dependsOn` 图上做确定性环检测，错误列出环上字段序列（如 `A → B → A`）。

**两套入口的分工（P2）**：

| 入口 | 用在 | 顶层 | 算术 |
| --- | --- | --- | --- |
| `parseRestrictedExpression` / `evaluateCondition` | `approval.when` | 必须是布尔条件 | 只在比较操作数两侧 |
| `parseComputedExpression` / `evaluateComputed` | `computed.expr` | 算术值 | `+ - * /` |

编译期仍只抽取、不求值。求值只在判定点发生（§10）。

---

## 9. 单据运行时（P1）

入口仍是 `SemanticRuntimeService`（`POST/GET /blueprints/:id/records/:entity`）。状态迁移与删除走同一服务，授权复用 `loadBlueprint`，审计复用 `AuditLogsService`。

### 9.1 写入载荷：头字段 + 保留键 `children`

```jsonc
POST /blueprints/:id/records/SalesOrder
{
  "customer": "<uuid>", "quantity": 3,
  "children": {
    "SalesOrderLine": [
      { "quantity": 1, "unitPrice": 20, "part": "<uuid>" }
    ]
  }
}
```

- 头实体 = 声明了 `children` 的实体。
- `children` 的键必须是该头声明过的行实体；未声明的键 → 拒（指明是哪个行实体）。
- 父引用字段由运行时注入（值 = 本次生成的头 id）。载荷里若出现该字段 → 拒，错误写明「父引用字段由运行时注入」。
- **没有 `children` 键 → 走既有的普通记录写入**（行为不变；归档 e2e 依赖这一点）。
- `children` / `state` / `version` / `id` / `createdAt` / `updatedAt` 是保留字：编译期拒绝对名字段。
- 本轮只支持一层（头 + 直接行）。行实体自己也声明了 `children` → 拒（「暂不支持多级单据」）。
- 头 + 行在同一个 `dataSource.transaction` 内：校验头 → 插入头 → 注入父引用并校验行（事务 Repository 必须能看见未提交的头）→ 插入行。任一步失败整单回滚。

### 9.2 单号

实体可选 `numbering: { field, prefix, dateFormat, width }`：

- `field` 必须是本实体已声明的 `type: "text"` 且 `unique: true`（否则 DB 兜底不存在）。
- `width` 1..12；`prefix` 非空；`dateFormat` ∈ `YYYYMMDD | YYYYMM | YYYY | none`（缺省 `YYYYMMDD`）。
- 无 `numbering` 的实体不生成单号（`auto-parts-min` 继续能写）。
- 调用方不得指定单号字段。
- 分配在**同一写入事务**内：`blueprint_doc_counters` 上 `INSERT ... ON CONFLICT DO UPDATE SET seq = seq + 1 RETURNING seq`。`period` 按 `dateFormat` 格式化当前日期（`none` → 空串）。单号 = `prefix + period + seq.padStart(width,'0')`。
- 单号字段的唯一索引在装载时应用（§9.6）。分配后若仍撞 `23505`，有界重试 5 次后放弃。

### 9.3 状态列、乐观锁、迁移

`blueprint_records` 加 `state varchar NULL` 与 `version integer NOT NULL DEFAULT 1`（DDL 用 `ADD COLUMN IF NOT EXISTS`，空库 CREATE 已含列 + ALTER 空跑，存量库 ALTER 生效）。

- 写入时总是写入该实体的初始状态。P1 之前的旧行 `state` 为 NULL → 读取/迁移时回落到初始状态。
- 实体没有 `states` → 不写 `state`，也不允许对它调迁移。

`POST /blueprints/:id/records/:entity/:recordId/transition` body `{ "to", "expectedVersion"? }`：

1. `loadBlueprint`（授权门）
2. 实体已声明、有 `states`；记录存在且属于该租户与本次蓝图版本
3. `to` 必须是已声明状态
4. 必须存在 `当前状态 → to`；否则拒，错误写明当前状态、目标状态、该实体允许的目标
5. 有 `expectedVersion` 时：`UPDATE ... SET state, version = version + 1 WHERE id AND version = expected` → 影响 0 行 ⇒ 409 并发修改
6. 审计写 `audit_logs`：谁 / 何时 / 从哪到哪 / 实体 / 记录 id。actor 取当前用户 id，缺省 `semantic-runtime`。

### 9.4 查询兼容规则（两种响应形状）

`GET /blueprints/:id/records/:entity` 可选查询参数：`page`（1 起）、`pageSize`（1..100）、`sort`（已声明字段或 `createdAt`）、`order`（`asc|desc`）、`state`（已声明状态）、`filter`（URL 编码的 JSON 对象，键必须是已声明字段）。

**为什么不是永远信封**：归档 e2e（`blueprint-delivery-template.e2e-spec.ts`）钉住了读端点的**裸数组**形状（`arrayContaining` / `.length`）。不带任何查询参数 → 仍返回裸数组；带了任一查询参数 → 返回

```json
{ "items": [...], "total": 30, "page": 2, "pageSize": 10, "sort": "number", "order": "desc" }
```

判据不过即拒、不静默忽略。分页在 SQL 里做（`LIMIT/OFFSET`），排序加 `id` tiebreaker。

### 9.5 删除与 `onDelete`

`DELETE /blueprints/:id/records/:entity/:recordId`。字段级可选 `onDelete: "restrict" | "setNull"`（只允许用在 `reference` 上；缺省 `restrict`）。

- `restrict`：被引用即拒，错误列出引用它的实例（实体 + 记录 id）。
- `setNull`：同事务把引用方该字段置空；置空后引用方仍须满足自己的校验，否则整件事拒。
- **`cascade` 本轮不做**：Schema 枚举不接受 `cascade`。递归级联删除需要删除顺序与环处理，属交付/治理（P5）。这是有意延后。

### 9.6 唯一索引装载时应用（P1 / P2 分工）

P1 只做单号兜底必需的那一半：`loadOrThrow` 之后幂等应用 P0 生成的唯一索引 DDL。先 `findUniqueConflicts`，有冲突 → 拒写并报清单；无冲突再 `CREATE UNIQUE INDEX IF NOT EXISTS`。

P2 再扩展：非空约束，以及「冲突时返回可定位的错误」的完整形态。

**索引谓词必须带 `blueprintId`**（`WHERE entity = 'X' AND "blueprintId" = '<bp>'`）。
`blueprint_records` 是多份蓝图共用的一张表：只按 `entity` 限定的话，A 蓝图的索引会去拦 B 蓝图的写入，
而报错里出现的是 **A 的索引名** —— B 的错误映射查不到 `(entity, field)`，"可定位的错误"就成了空话。
（非空 CHECK 同理，见 §10.5。）

> 升级注意：索引是**装载时派生**的产物，`CREATE UNIQUE INDEX IF NOT EXISTS` 不会替换同名旧索引。
> 从更早的构建升级时，需要一次性清掉旧索引（`DROP INDEX IF EXISTS` 所有 `ux_br_%`），
> 让下一次装载按新谓词重建。

### 9.7 并发控制范围（本轮做 / 不做）

- **做**：迁移上的乐观锁（`version` + `expectedVersion`）。
- **不做**：库存数量的并发占用（ATP 的前提）。留给 P3 或 P3 前置子变更，本轮不假装已经覆盖。

---

## 10. 判定执行（P2）

入口仍是 `SemanticRuntimeService`。审批、分录、非空约束与写入/迁移在**同一事务**；任一步不过即拒、不部分执行。

### 10.1 求值器与型别提升

`evaluateCondition(source, ctx)` / `evaluateComputed(source, ctx)` 是纯函数，复用同一套 token / 优先级，**不用 `eval` / `new Function`**。

金额用 `money.ts` 定点（bigint 小单位）：

| 运算 | 标度 |
| --- | --- |
| `decimal ± decimal` | 二者最大 |
| `decimal × decimal` | 二者之和（全精度，不舍入） |
| `decimal` 与 `i32` / 整数值 `number` | 整数按标度 0 参与，结果精确 |
| `decimal` 与非整数 `number` | **拒**（精度来源不明） |

比较对齐标度后比 bigint，**不做舍入**。
**唯一的舍入点**：把计算/合计值写入声明字段时，按该字段的 `scale` + `rounding` 舍入一次（`roundTo`）。中间不舍入。

`decimal` 取值形态：小数串 `^-?\d+(\.\d+)?$`（无损）**或**有限 JS number（向后兼容既有 e2e 的 `unitPrice: 20`）。二者都归一到 `FixedDecimal`（按字段 `scale`，缺省 4）。`validation` 对 decimal 字段用 `parseFixed` 精确比较，不再用 JS `>` / `<`。

### 10.2 `rollups`（实体级合计）

`computed.dependsOn` 只允许同实体字段，头无法表达"行金额合计"。实体可选：

```jsonc
"rollups": [{ "field": "totalAmount", "over": "SalesOrderLine", "of": "amount", "fn": "sum" }]
```

编译期：`field` 是本实体已声明字段；`over` 是本实体 `children` 里的行实体；`of` 是该行实体已声明字段；`fn ∈ sum|count|max|min`；`field` 为 decimal 时 `of` 也必须是 decimal；**禁止 `of` 指向另一层 rollup**（本轮只做一层）。

运行时在判定点（审批求值 / 记账取额）按当前单据的行**现算**（同事务查 `blueprint_records`），`sum` 用精确加法，最后按 `field` 的标度 + rounding 舍入一次。语义层摘要覆盖整份 `semantic.json`，改 rollups → `irDigest` 变。

### 10.3 审批链（不发明状态名）

表 `blueprint_approvals`：一行 = 链上一步。唯一约束 `(recordId, ruleId, stepIndex)`。

**"待审"不是 `states` 里的名字**（状态名是模板作者的）。待审 = 审批链存在 `pending` 步骤，并由读模型透出：

`GET /blueprints/:id/records/:entity/:recordId/approvals`
→ `{ approvals: [{ ruleId, status, steps: [{ index, role, status, actor, decidedAt }] }] }`

触发：

1. **写入**成功后、同事务：对该实体求值全部 `approval[]`。命中且链未建 → 建链（幂等）。
2. **迁移前**重算。命中且链未全批 → 拒（`approval-required`，带 `ruleId` 与当前待审 `role`），状态不变。

`POST .../approvals/:ruleId/approve` body `{ role }`：

- 只允许**当前待审步骤**的 `role`；不符 → **403**，写明期望角色与实际角色
- 最后一步批完 → 全链 `approved`，之后迁移放行
- 已全批 / 已拒 / 不存在 → 拒（幂等语义明确）

审计：`audit_logs.action = blueprint.record.approval`（ruleId / role / stepIndex / 结果 / actor）。
`steps[].role` 必须是平台已知角色（编译期已判）。

### 10.4 记账分录（运行时也判平衡）

表 `blueprint_journal_entries`：金额用 **`amountUnits` bigint + `scale` integer**（与 `money.ts` 同构），不用 numeric/float。唯一约束 `(recordId, ruleId, account, side)` 防重复过账。

迁移**成功进入**新状态后（同事务），取 `accounting` 中 `on === "<Entity>.<新状态>"` 的规则生成分录。

取额：`$entity.<field>` 从记录字段（含 computed/rollup）解析；字面量按 `parseFixed` 归一。引用不存在的字段 → 拒（编译期已判，运行时再兜一层）。

运行时借贷：对齐标度后 `sum(debit) === sum(credit)`，不等 → **拒整个迁移**（回滚，分录不落、状态不变）。错误给出两侧合计。

迁移返回体带本次分录。审计：`blueprint.record.accounting`。

### 10.5 非空约束与可定位错误

字段 `required: true` 且类型是标量（`text/number/decimal/i32/boolean/date/datetime/enum`）→ `blueprint_records` 上 CHECK：

`CHECK ("blueprintId" <> '<blueprintId>' OR entity <> '<Entity>' OR (data->>'field') IS NOT NULL)`

必须带 `blueprintId`：`blueprint_records` 是多蓝图共用表，不隔离就会把另一份模板（如 `auto-parts-min`）的同名实体误伤。

名字确定性派生 `nn_br_<hash>`，幂等。先报告既有违规清单，再建约束。

Postgres 错误码映射成带 `entity` / `field` / 值（能从 `detail` 取就取）的 `RecordWriteError`：

| 码 | 含义 |
| --- | --- |
| `23505` | 唯一，由约束/索引名反查 `(entity, field)` |
| `23514` | CHECK（非空），同样反查 |

P1/P2 分工：唯一索引 P1 已做；P2 补非空 + 完整可定位错误。应用层绕过也拦（直连 INSERT）。

---

## 11. 追溯与治理（P3 适配 / P4 批次反查与导入）

本节约定三条**宿主查询 / 写入入口**。它们走授权门（`loadBlueprint` / `loadOrThrow`）和租户过滤（`organizationId`），**不做成原子**。
写闸（六道字段判据、头行事务、唯一/非空约束）不因读路径或导入部分成功而放松。

### 11.1 批次是独立实体，不是 `SalesOrder` 的行

`Batch` 与 `SalesOrderLine` 不同：批次是库存/发货的载体，可能被拆到多张单。做成头的 `children` 会让"跨单批次"无法表达，也会让 P1 的父引用注入语义错位。

独立实体 + 必填 `order` 引用 = 反向查询是一次 join，不是父链遍历。
`batchNo` 声明 `unique: true`（蓝图隔离的唯一索引）。单状态 `shipped`（`initial` 且 `final`，无需 transitions）合法。

`GET /blueprints/:id/traceability/batch/:code`

1. 授权门：先 `loadOrThrow`（按租户）。
2. 语义：`Batch.data->>'batchNo' = :code` 的所有行（一个批次可对应多行）→ 每行再解析 `order` → `SalesOrder` → `customer` → `Customer`；并带出 `part` → `Part.partNo`（若缺失则返回 id 并注明）。
3. 返回：`{ found, batchNo, hits: [{ batchId, partId, partNo, quantity, shippedOn, orderId, orderNumber, customerId, customerName, notes }] }`。
4. **未知批次 → 200 + `found:false` + `hits:[]`**（这是查询结果，不是资源缺失，不 404）。
5. JSON 里没有的记录（悬空引用）→ 该字段给 `null` 并在 `notes` 写明追到哪一步断了，**不抛异常**。
6. **只读**：不写审计以外的任何东西。允许一条 `blueprint.traceability.batch` 审计。
7. 纯函数与 SQL 分离：`traceability.ts` 负责行→结果组装（可单测），service 负责查询。

召回 scenario：给定已发货批次号，结果必须含订单与客户，且能继续追溯到发货时间与数量。

### 11.2 主数据导入：逐行报错，部分成功是有意例外

`POST /blueprints/:id/import/:entity`

body：`{ csv?: string, rows?: object[], dryRun?: boolean }`。`csv` 与 `rows` **二选一**（都给或都不给 → 400）。**不用 multipart**。

本轮支持的实体：`Part` / `Customer` / `Supplier`。
- 模板未声明 → 400 `unknown-entity`
- 声明了 `children` 的头实体 → 400 `import-document-unsupported`（头行事务不该从 CSV 导入）
- 其它已声明实体 → 400 `import-entity-unsupported`

**CSV 解析器**（`import-rows.ts`，纯函数、无第三方依赖）：首行表头；支持双引号包裹、字段内逗号、`""` 转义、`\r\n` 与 `\n`；空行跳过；**行号 = 文件行号（表头是第 1 行）**。

**结构错误（整份拒，400）**：表头里有该实体未声明的列（报出列名清单）；表头为空/重复列名。这是"文件的形状"错了，不是某一行错了。

**逐行错误（部分成功，200）**：每行走既有写入链（字段存在 / 类型 / reference 存在 / validation）。失败的行收集为 `{ line, reason, field?, ruleId?, message }`，`reason` 用既有枚举名。

- **合法行必须落库**（MUST NOT 因一行失败而放弃整批）
- **非法行必须逐条出现在 `errors`**（MUST NOT 静默丢弃）
- **这是对"不部分写入"的唯一有意例外**：批次级原子性不适用（spec 明确要部分成功）。**单行内部仍然 fail-closed**（一行要么整行落库、要么不落）。

`dryRun: true` → 只校验不落库，`imported` 记 0，`validated` 记通过行数。

返回：`{ entity, source: "csv"|"json", imported, failed, validated?, errors, dryRun }`。

性能：模板只加载一次（`loadOrThrow` + `readTemplate` 各一次）；每行用自己的事务调 `document-writer`。不要每行都 `loadBlueprint`。

### 11.3 车辆适配：宿主查询，不做成原子

`Fitment` 是独立单状态实体（`active`，`initial` 且 `final`）。
`GET /blueprints/:id/fitment/parts?make=&model=&year=&position=`

命中规则（确定）：

| 条件 | 语义 |
| --- | --- |
| `make` / `model` | 精确，**大小写不敏感**（统一 `lower()` 比较） |
| `year` | `yearFrom <= year <= yearTo`（闭区间） |
| `position` | 请求给了则精确匹配；没给则不限 |

`yearFrom > yearTo` 的行**自然不匹配**（谓词不可满足），无需额外判据：倒置区间不会被命中。

参数：`make`/`model` 必填；`year` 必须是整数；`position` 给了就必须是模板声明的枚举值（`front/rear/left/right`）→ 否则 400 并指明。

返回：去重后的零件候选，按 `partNo` 排序（确定性）+ 命中依据 `{ fitmentId, yearFrom, yearTo, position }`。

**为什么不做成原子**（design §3.4）：适配要跨表检索（`Fitment` → `Part`）。塞进零能力沙箱只会造出一个受限 SQL 方言，等于把"零能力"这个最强的安全性质换成"半个数据库客户端"。ATP/价格/信用/换算/替代件是纯计算，才走 Wasm 原子。

授权门 + 租户隔离照旧。审计允许 `blueprint.fitment.query`。

---

## 12. 查询视图、默认值与模板升级（P4 / P5）

本节冻结四件事：三个**平台内置**视图的口径、字段 `default` 与读时 materialize、升级不打破非空约束、跨版本迁移与升级必须重签。

### 12.1 三个视图是平台内置，不是模板声明

它们是**跨实体聚合**。P0 的 `rollups` 只做「头 → 自己的行」；模板层没有聚合声明能力。把它们做成模板声明会把协议推向「模板里的 SQL」。所以三个固定口径写在平台，不写进 `semantic.json`。

| 入口 | 聚合 | 行形状 |
| --- | --- | --- |
| `GET /blueprints/:id/views/stock` | 按零件聚合 `StockItem` | `{ partId, partNo?, onHand: Σ quantity, reserved: Σ reserved, available: Σ(quantity − reserved), inTransit: Σ inTransit }` |
| `GET /blueprints/:id/views/in-transit` | 按零件聚合 | `{ partId, partNo?, inTransit: Σ inTransit }` |
| `GET /blueprints/:id/views/receivable` | 按客户聚合**已确认未结清**订单 | `{ customerId, customerName?, receivable }` |

**应收口径（必须按此实现）**：`应收 = Σ SalesOrder.totalAmount`，其中订单 `state ∈ {confirmed, shipped}`。`draft` 未确认、`closed` 已结清，都不计。
`totalAmount` 按当前模板的 rollup 定义求值（`sum` over `SalesOrderLine.amount`；`amount` 是 `quantity * unitPrice`）。用 Postgres `numeric` 做乘与加，**不要**假设头行 jsonb 已经落了 rollup 字段（rollup 是判定时物化，写入链不隐式回填）。

共同规则：

1. **授权门**：先 `loadOrThrow`（按租户）。
2. **租户过滤**：`organizationId` 必须进 WHERE。
3. **确定性排序**：库存 / 在途按 `partNo` 再按 `partId`；应收按 `customerName` 再按 `customerId`。
4. **金额**用 Postgres `numeric`（任意精度，不是浮点），返回**字符串**（与 jsonb 里的小数串一致）。禁止在 JS 里用 `number` 求和。
5. **空结果 → 200 + 空数组**（这是查询结果，不是资源缺失，不 404）。
6. 纯函数与 SQL 分离：`views.ts` 负责行 → 视图结果组装（可单测），service 负责查询。
7. 审计允许 `blueprint.view.stock` / `blueprint.view.in-transit` / `blueprint.view.receivable`。

旧行没有 `inTransit` 时，聚合按 0 计（`COALESCE`），与 §12.2 的 default 对齐。

### 12.2 `default`：声明式默认值，只影响读与升级路径

`schemas/blueprint-semantic.schema.json` 字段级可选 `default`。类型必须与 `type` 匹配（`allOf/if-then`）：

| `type` | `default` |
| --- | --- |
| `text` | string |
| `number` | number（有限） |
| `decimal` | 小数串或有限 number |
| `boolean` | bool |
| `i32` | integer |
| `date` | `YYYY-MM-DD` |
| `datetime` | 既有 ISO 格式 |
| `enum` | 必须是 `values` 里的一个 |

**编译期判据**（不过即拒，指明字段）：

- `default` 出现在 `reference` / `computed` 字段上 → 拒（引用没法给默认值；计算字段的默认值无意义）
- `default` 类型与 `type` 不符 → 拒
- `enum` 的 `default` 不在 `values` 里 → 拒

**读路径 materialize**：读（裸数组 / 分页信封 / 视图所用的记录 / 追溯所用的记录）返回时，若 `data` 缺少**当前模板**声明且带 `default` 的字段，则**填上默认值**。

- **不改数据库里的原始行** —— 只改返回的视图。
- **写回不做隐式回填**。理由：读时回填会让「读」变成写，且并发下会打架。
- **只补 `default`，不补 `required` 且无默认的字段**（那种仍然缺失，读出来就是缺）。
- **default 不许变成绕过必填**：写入路径仍然按模板校验。缺必填且无默认 → 照样拒；缺必填即使有默认，写入也不隐式填，照样拒。

### 12.3 升级不打破非空约束

P2 的 `required` → DB `CHECK (… IS NOT NULL)` 会在「升级加了一个新 required 字段」时炸：旧行没有那个字段 → 建约束先报违规清单 → 之后所有写入被拒。

**规则：带 `default` 的字段不生成非空 CHECK**（默认值就是升级路径；CHECK 对升级前的行不可满足）。`findNotNullConflicts` 也不把「缺字段但有 default」的行算作违规。

无 `default` 的 `required` 字段行为不变（仍然建 CHECK、仍然报违规清单）。

升级场景：旧行缺新字段 + 新字段 `required: true` + 有 `default` ⇒ 装载 / 写入不被拦。读时 materialize 给出默认值。

### 12.4 跨版本迁移

`list` 已经按 `blueprintId + entity + organizationId` 过滤，**不含版本**。`transition` 同样去掉 `blueprintVersion` 过滤（保留 `id + entity + blueprintId + organizationId`）。

理由：升级后旧单据不能变成只读。

迁移合法性**按当前模板**判定。若记录的当前 `state` **不在当前模板声明的状态里** → 拒，错误写明「该行处于旧模板状态 X，当前模板未声明」。不要静默放行，也不要猜成初始态。

### 12.5 升级必须重新签名

模板变更即 `irDigest` 变。签名覆盖去掉 `signature` 的 manifest 规范化 JSON，所以新包必须走 `deliver` 的「写 license → pack → compile → stampCompiled → signPackage」。

三条必须同时成立：

1. **旧签名对新内容无效**：用旧包的 `signature` 去验新 manifest → `verifyAgainstTrustRoots` 为 false。
2. **重签后可用**：`deliver` 新版本 → 新包能被 `loadBlueprint` 装载（授权 + 验签通过）。
3. **授权不能绕过**：`deliver` 的 `licenseInput` 必须显式给 `grantedTo`（省略 → 拒）。升级不是「自动继承旧授权」。

不新造密码学：复用 `license.ts` 的 Ed25519 与 `signPackage`。私钥仍是 `BLUEPRINT_LICENSE_PRIVATE_KEY`，缺失即拒。

## 13. 货币是类型的一部分（P5）

金额字段的货币是**静态声明**，不是运行时随便填的标签。`schemas/blueprint-semantic.schema.json` 字段级可选 `currency`（`^[A-Z]{3}$`）。

### 13.1 编译期：声明与不得混加

1. `money: true` 的字段必须声明 `currency`；否则拒，指明字段。
2. 非 money 字段声明 `currency` → 拒（金额才有货币）。
3. `money: true` 但仍用 `type: "number"` 的既有判据（P0）不变。

**不同货币不得相加**（三条，都指明是哪两处、哪两种货币）：

| 位置 | 判据 |
| --- | --- |
| `computed.expr` | 引用的 money 字段货币必须一致 |
| `rollups` | `of` 字段的货币必须等于目标 `field` 的货币 |
| `accounting` | 一条规则内所有 `$entity.<field>` 金额引用的货币必须一致 |

比较 / 校验规则与字面量比较不涉及跨币种，本轮不管。

### 13.2 运行时：视图按币种分组（真正可达的判据）

模板里跨币种相加会被编译期拦住。运行时的意义在于**聚合读**：

- `assembleReceivableView` 按 `(customerId, currency)` 分组，返回行带 `currency`；**绝不把两种货币合成一个数**。
- 库存 / 在途视图是数量（非金额），不加 currency 列。
- 写入时按字段声明把货币盖章到行数据（`__currency`），读路径剥掉，不污染字段集。旧行没有盖章时，视图回落到当前模板该金额字段的声明货币。

求值器另有一道**防御性**检查：金额带上声明货币后，`+` / `-` 混算 → `currency-mismatch`。**模板侧已被编译期拦住，这条是防御性的**，不是主要判据。直接对求值器单测。

### 13.3 原子无币种

`autoparts-credit` / `autoparts-atp` 等原子是 **i32 小单位、零能力、无币种**。同币种是宿主的责任：宿主在投影到原子输入之前必须保证输入同币种。原子不会判币种，读的人不要以为闸在 Wasm 里。

## 14. 字段级 / 单据级权限与数据范围边界（P5）

默认（无权限声明）行为不变；声明了才加严。

### 14.1 字段级 `permissions`

字段级可选 `permissions?: { read?: string, write?: string }`（点分权限，与契约的 permissions 同形状）。

- **读**：调用方缺少 `permissions.read` ⇒ 从返回的 `data` 里省略该字段，并把字段名放进 `omittedFields`（可观察，不静默）。没有 user / 没有 permissions ⇒ 视为空权限。
- **写**：payload 里出现缺少 `permissions.write` 的字段 → 拒（`forbidden-field`，指明字段）。未声明 `write` 的字段不受限。
- 读省略加在 `withResolvedState` 一处，对裸数组 / 分页信封 / 追溯同时生效。

### 14.2 单据级 `ownership`

实体级可选 `ownership?: { field: string, readAllPermission: string }`。

- `field` 必须是本实体已声明的 `type: "text"` 字段。
- 读列表（裸数组与分页信封）默认只返回 `ownership.field` 等于调用方 id（`user.id` 或 `user.userId`）的行；持有 `readAllPermission`（模板演示为 `sales.order.readall`，点分全小写，与契约 permissions 同形状）⇒ 不筛。
- **归属字段为空 / 缺失的行对所有人可见** —— 有意裁决：否则一升级就把历史的无主数据全藏起来（与 §12.2「旧数据仍可读」同一条原则）。
- `transition` / 追溯 / 视图不在本轮 ownership 范围内（按 id 或按聚合）。

### 14.3 数据范围：做到哪、故意不做哪

本轮把「数据范围」定义为**租户隔离**（既有的 `organizationId` 过滤）。入口：`records` 读、三个视图、追溯、适配查询、导入 —— 每个入口都有「他租不可见 / 不可写」的断言。

**部门 / 仓库级的细粒度数据范围本轮不做。** 理由：它需要可信的用户属性 / 声明模型（用户属于哪个部门 / 仓库）。若从请求参数取范围值，等于让调用方自己声明能看什么，那是安全漏洞而不是功能。所以宁可不做，也不做一个假的。

