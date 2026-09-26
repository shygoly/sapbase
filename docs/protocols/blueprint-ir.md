# Blueprint IR 规范 v1

> 状态：**已冻结（v1）**
> 权威定义：[`schemas/blueprint-ir.schema.json`](../../schemas/blueprint-ir.schema.json)（结构形态）
> 相关：[设计文档](../ERP_Space_Platform_设计方案_v3.md) §5.3 / §7、[项目元语](../META_LANGUAGE.md) §3

## 1. IR 是什么、不是什么

IR 是**编译器的输出、Runtime 的输入**。

- **是**：一份可枚举、可校验、可 diff 的执行计划描述 —— 声明了"这份蓝图有哪些对象、在什么事件上做什么"。
- **不是**：可执行代码。IR 里没有原子实现、没有业务数据、没有 SQL。

两种形态必须**等价**：

```text
blueprint.ir.json   结构化形态 —— Runtime 加载用（权威）
blueprint.ir.txt    文本形态   —— 审计、代码评审、diff 用
```

等价性由**往返测试**保证：`toText(parseText(x)) === toText(x)`。

## 2. 文本形态语法（v1）

文本形态是顶层语句的线性序列。行首无缩进为顶层语句，缩进两空格为从属动作。
IR **覆盖五层**：semantic（entity 行 + 内容摘要）、flows（on 行）、dependencies（depends 行）、
以及可选的 rules / experience 摘要行。没有后两层文件的包，对应行缺省。
semantic 摘要覆盖字段的类型 / 精度 / 唯一性 / 计算式等内容 —— 改这些而不改字段计数时，`irDigest` 也必须变。

### 2.1 头部

```text
blueprint auto-parts-erp@2026.1.0
runtime >=1.0.0 <2.0.0
```

### 2.2 实体

```text
entity SalesOrder { fields: 6, states: draft -> submitted -> approved -> closed }
```

- `fields` 为字段**计数**（不列出字段名：IR 是执行计划摘要，不是完整 Schema；完整定义在包内 `semantic.json`）
- `states` 用 ` -> ` 连接，顺序即状态声明顺序
- 无状态的对象写作 `states: -`

### 2.3 事件与动作

```text
on SalesOrder.submitted:
  check CreditLimit using atomic:available-inventory@^1.0.0
  require approval PURCHASE_HIGH_VALUE when total > 100000
  post accounting SALES_INVOICE_POSTED
```

三种动作（与结构形态的 `kind` 一一对应）：

| 文本 | 结构 `kind` | 必填字段 |
| --- | --- | --- |
| `check <rule> using atomic:<atomicType>@<range>` | `check` | `atomic` |
| `require approval <ruleId>` | `require-approval` | `rule` |
| `post accounting <entryId>` | `post-accounting` | `entry` |

可选后缀 `when <表达式>` 对应结构里的 `when`。

### 2.4 依赖

```text
depends available-inventory@1.0.0
depends inventory-core@2.0.0
```

记录**编译时实际解析到的版本**（不是范围）—— 加载时据此判断依赖漂移。

### 2.5 规则与经验策略摘要（可选）

```text
rules count=3 digest=sha256:<64hex>
experience count=4 digest=sha256:<64hex>
```

- `count` 是该层条目总数；`digest` 是该层规范化 JSON 的 sha256
- **不要只放 count**：改一个 `value` 时 count 不变，digest 必须变，否则防漂移漏判
- 只加可选字段，按 §5 仍属 `blueprint-ir/v1`，不新建 v2

### 2.6 语义层内容摘要（可选）

```text
semantic count=5 digest=sha256:<64hex>
```

- `count` 是实体数；`digest` 是对 `semantic.json` 规范化 JSON 的 sha256
- **不要只靠 entity 行的字段计数**：改一个字段的 `type` / `unique` / `precision` / `computed.expr` 时，字段数可能不变，digest 必须变
- 只加可选字段，按 §5 仍属 `blueprint-ir/v1`，不新建 v2
- 没有 `semantic.json` 的包对应行缺省（v1 编译器实际始终带这一层，因为该文件是编译入口）

## 3. 结构形态（权威）

见 `schemas/blueprint-ir.schema.json`。要点：

- `ir` 固定为 `"blueprint-ir/v1"`（版本化入口，便于将来并存）
- `events[].actions[].kind` 决定必填字段（`check` → `atomic`、`require-approval` → `rule`、`post-accounting` → `entry`），由 Schema 的 `allOf/if-then` 强制
- `dependencies[]` 是**解析后**的引用字符串
- `summary` 是派生信息（对象数/事件数/文件数），不参与等价性判断
- `semantic` / `rules` / `experience` 是可选层摘要（`{ count, digest }`）；缺省等于该层不在包内。`semantic` 现在覆盖语义层**内容**，不只是实体行上的字段计数

## 4. 与其它协议的关系

| 协议 | 关系 |
| --- | --- |
| Blueprint Package | IR 由包编译而来；IR 摘要写入编译记录，加载时比对以防漂移 |
| Blueprint Delivery | `rules.json` / `experience.json` 的确定性摘要写入本协议，使改一行业务定义必变 `irDigest` |
| Atomic Contract | IR 里的 `atomic:<type>@<range>` 由 `AtomicRegistryService.resolve` 解析 |
| Runtime SDK Contract | Runtime 只接受通过校验的 IR；不收包内的原始 JSON |

## 5. 变更流程

IR 是对外协议，**破坏性变更必须新增版本**（`blueprint-ir/v2`），而不是原地改 v1：

```text
兼容性判据
  · 新增可选字段           → 兼容，可留在 v1
  · 新增必填字段 / 改语义   → 破坏，需 v2 并共存一个版本周期
```
