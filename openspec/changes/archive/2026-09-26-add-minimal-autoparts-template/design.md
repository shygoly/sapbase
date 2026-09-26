# Design: 最小汽配 ERP 模板与语义运行时

## 目标

用**一个能一次做完、但足够真实**的行业模板，把"包能交付"推进到"**包能让 ERP 跑起来**"。

两条边界先写死：

1. 本变更**只新增入口**，不改动编译 / 装载 / 授权 / 原子执行的任何判据。
2. 写入路径的校验**只会更严**：不过即拒，不落库（fail-closed）。

---

## 一、模板：`templates/auto-parts-min/`

```text
templates/auto-parts-min/
├── blueprint.json     作者元数据（id / 版本 / runtime / 依赖 available-inventory）
├── semantic.json      五个实体
├── flows.json         销售订单的状态推进
├── rules.json         3 条 validation + 1 条 approval 声明
└── experience.json    经验策略
```

### 语义（五个实体，刻意不做多）

| 实体 | 关键字段 | 状态机 |
| --- | --- | --- |
| `Part` | `partNo`(text, 必填) / `name` / `unitCost`(decimal) | `active`(初始) → `obsolete`(终) |
| `Supplier` | `name` / `creditDays`(number) | `active` → `blocked` |
| `Customer` | `name` / `creditLimit`(number) | `active` → `suspended`(终) |
| `SalesOrder` | `quantity`(number) / `unitPrice`(decimal) / `customer`(reference→Customer) / `part`(reference→Part) | `draft`(初始) → `confirmed` → `shipped` → `closed`(终) |
| `StockItem` | `quantity`(i32) / `reserved`(i32) / `part`(reference→Part) | `in-stock` → `depleted` |

**BOM 不做实体。** 物料清单是 `Part` 上的**自引用关系**（`bomLines` → `Part`），
理由与协议层一致：能被语义表达的，就不新开一层/一类。

### 规则（只写可判定的）

```jsonc
// validation：写入时**真的执行**（字面量比较）
{ "id": "so-qty-positive",  "entity": "SalesOrder", "field": "quantity",  "rule": "greaterThan", "value": 0 }
{ "id": "so-price-nonneg",  "entity": "SalesOrder", "field": "unitPrice", "rule": "greaterOrEqual", "value": 0 }
{ "id": "part-no-required", "entity": "Part",       "field": "partNo",    "rule": "required" }

// approval：**只声明，不执行**（要执行得先有求值器）
{ "id": "so-high-value", "entity": "SalesOrder", "when": "quantity * unitPrice > 100000",
  "steps": [{ "role": "sales-manager" }] }
```

### 经验策略

```jsonc
{ "priority": ["customer", "part", "quantity", "unitPrice"],
  "confirm":  [{ "action": "SalesOrder.confirm", "when": "quantity * unitPrice > 100000" }],
  "automate": [{ "action": "StockItem.recompute" }],
  "surfaces": [{ "trigger": "SalesOrder.draft", "surface": "sales-order-review" }] }
```

它描述"什么重要、什么要确认"，**不含任何布局字段**（`layout` 等一律非法，见前一变更的判据）。

---

## 二、最小语义运行时

```text
POST /api/blueprints/:id/records/:entity    写实体实例（**写入前按模板校验**）
GET  /api/blueprints/:id/records/:entity    读回（可按字段过滤）
```

### 写入链（顺序固定，任一不过即拒）

```text
1. 装载模板（复用 loadBlueprint：完整性 → 编译 → 防漂移 → 授权 → 绑定）
2. 实体在模板里声明了吗？            → 否：unknown-entity
3. 字段名都在语义里？多余的拒        → 否：unknown-field（**不忽略未知字段**）
4. 类型匹配？（text/number/decimal/i32/reference）
5. reference 指向的实体实例存在吗？  → 否：dangling-reference
6. rules.validation 通过？（该实体的全部规则）
7. 落库
```

**关键取舍：未知字段一律拒。** 通用记录表没有列约束，
如果连"多余的字段"都放过，模板校验就成了"抽查"，
而抽查出来的 ERP 与没有校验的 ERP 在出错时长得一样。

### 存储：`blueprint_records`

| 列 | 说明 |
| --- | --- |
| `id` | uuid |
| `blueprintId` / `blueprintVersion` | 这条实例由哪份模板约束（模板换版本后旧数据归属可查） |
| `entity` | 实体名 |
| `organizationId` | 租户（沿用既有租户隔离） |
| `data` | jsonb（字段值） |
| `createdAt` / `updatedAt` | 既有约定 |

**没有列约束，只有索引**（`(blueprintId, entity, organizationId)`）。
代价写进协议：**约束来自模板校验，不来自数据库** —— 直连数据库写入不受约束。

---

## 三、生成与交付：`POST /api/blueprints/:id/deliver`

一条命令把"模板目录"变成"可交付制品"：

```text
打包（packBlueprint）→ 编译盖章（stampCompiled）→ 写授权 license.json
  → 重新打包（哈希覆盖新文件）→ 签名（signPackage）
```

顺序不能颠倒：`compiled` 在签名覆盖范围内（见 `blueprint-delivery.md` §5.1），
所以**先盖章、再签名**。实现里把这条顺序写成一个方法，避免调用方各自拼装。

---

## 四、验收怎么跑（判据的形态）

```text
租户 A：模板 → deliver（授权 grantedTo:[B]）→ 得到 .erpkg
租户 B：装载 .erpkg
  · 写一条合法 SalesOrder          → 成功，能读回
  · 写缺 partNo 的 Part            → 被 part-no-required 拦
  · 写 quantity=0 的 SalesOrder    → 被 so-qty-positive 拦
  · 写一个未知字段                 → 被 unknown-field 拦
  · 调 available-inventory（HTTP） → 断言可用量数值与绑定哈希
反例：租户 C 装载（未授权）、篡改包（签名失效）、违反规则的写入 —— 都拒
```

**为什么强调"各被拦一次"**：只有"合法通过"证明不了校验在工作 ——
许可一切的校验器与没有校验器，在唯一一次成功上完全一样。

---

## 五、风险与对策

| 风险 | 对策 |
| --- | --- |
| 通用记录表让约束形同虚设（可绕过 API 直接写库） | 协议里写明"约束来自模板校验，不来自数据库"；需要硬约束时走"按语义生成物理表"那条线（另立变更） |
| 规则执行蔓延成半个解释器 | 只执行 `validation` 的字面量比较；`approval.when` 明确不求值 |
| 模板与产物混淆（改了模板忘了重打包） | 目录分离（`templates/` vs 产物目录）+ `deliver` 一条命令重打包 |
| 最小模板退化成"什么都做一点" | proposal 里写了"不做"清单；每个不做项都指明了归属的那条线 |
| 本变更悄悄放松既有闸 | 验收里包含"前一变更的三个反例"（未授权/篡改/过期）继续被拒 |

## 六、元语落点

| 元语维度 | 本变更的位置 |
| --- | --- |
| $E$ Entity / $R$ Relation | `semantic.json` 的五个实体 + `Part` 自引用 BOM 关系 |
| $O$ Object（实例） | `blueprint_records`（**这是本变更补上的空缺**：此前只有定义，没有实例） |
| $\Phi$ Constraint | `rules.validation` 在写入时执行（第一次真的"拦"） |
| $\Sigma$ State | `flows.json` 的状态推进（声明 + 编译期校验） |
| $\Gamma$ Capability | `available-inventory` 原子 |
| $C$ Context | `organizationId` + 模板授权 `grantedTo` |
