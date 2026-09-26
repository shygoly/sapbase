# Change: Add Minimal Auto-Parts ERP Template

## Why

上一个 change（`add-deliverable-blueprint`，已归档）让**包能被授权、能交付、能在别处装载**。
但它没有回答一个更要紧的问题：

> **这个包能让一个 ERP 真的跑起来吗？**

实测答案是**不能**：

```text
装载后，没有任何东西在数据写入时执行模板
  · 没有"按模板写实体实例"的入口（backend/src/blueprint 只有 package/compile/load）
  · 没有规则执行器（rules-expression 只做词法校验与引用抽取，**有意不求值**）
  · 全平台只有 1 个原子（available-inventory）
```

也就是说：模板现在能编译、能签名、能装载，然后……**什么都不发生**。
这正是"能表达"与"能生成一个真东西"之间的距离 ——
而这段距离只有真做一次才会显形（插件那条线上已经撞过一次同类问题）。

本变更用**最小汽配 ERP** 做第一件真东西：它小到能一次做完，
但足够真实到会逼出协议与运行时的缺口。

## What Changes

- **ADDED**: `templates/auto-parts-min/` —— 模板（五个层文件 + `blueprint.json`）：
  物料 `Part`（含 BOM 行关系）、供应商 `Supplier`、客户 `Customer`、
  销售订单 `SalesOrder`（`draft → confirmed → shipped → closed`）、库存 `StockItem`
- **ADDED**: **最小语义运行时** `backend/src/semantic-runtime/`：
  - `POST /api/blueprints/:id/records/:entity` —— 写入实体实例前，按**已装载的模板**校验
    （字段存在性 / 类型 / 必填 + `rules.validation` 的**字面量**规则）
  - `GET /api/blueprints/:id/records/:entity` —— 读回
  - 存储用通用记录表 `blueprint_records`（`blueprintId / entity / tenantId / data`）
- **ADDED**: 生成入口 `POST /api/blueprints/:id/deliver` ——
  打包 → 编译盖章 → 写授权 → 签名，一条命令出**可交付制品**
- **ADDED**: 模板内容：3 条 validation 规则（数量为正 / 必填客户 / 价格非负）、
  1 条 approval **声明**（大额订单）、1 份 experience 策略（哪些信息重要、什么要确认）

## 范围裁决：这里的"最小"到底是什么

**是**：一个能装载、能被自己的规则拦、能调用原子算出可用库存的最小汽配 ERP。

**不是**（明确不做，避免"最小"变成"什么都要一点"）：

```text
总账 / 多币种 / 成本核算        不做（属会计那条线）
生产工单 / 排产 / MRP           不做（BOM 只做数据结构与校验）
审批执行器、记账执行器           不做（规则只声明 + 校验，不求值）
按语义生成物理表 / 迁移          不做（v1 用通用记录表承载实例）
UI                             不做（属 add-chat-first-erp 那条线）
新增 Rust 原子                  不做（复用 available-inventory，本变更的对象是"模板能跑"）
```

**验收判据（只有一条）**：

```text
租户 A 生成并签名 → 租户 B 装载 → 在 B 里跑通一条真实业务动作：
  写销售订单（合法通过；缺字段 / 类型错 / 违反 validation 各被拦一次）
  → 调 available-inventory 算可用量 → 断言数值
反例（都拒）：未授权租户装载、篡改包、违反规则的写入
```

## Impact

- 受影响规格：新增能力 `semantic-runtime`；`blueprint-delivery` 不变（本变更消费它）
- 受影响代码：`templates/`（新增）、`backend/src/semantic-runtime/`（新增）、
  `backend/src/migrations/`（新增一张 `blueprint_records` 表）、`blueprint.controller.ts`（加 deliver 入口）
- **不放松任何既有闸**：本变更是**新增一条入口**，不改动编译/装载/授权/原子执行的任何判据；
  写入路径的校验**只会更严**（未通过即拒，不落库）
- 风险：通用记录表让"实体实例"没有真正的列约束。对策见 decisions 第 1 条：
  **约束由模板校验提供**，而不是由数据库提供 —— 这是有意的取舍，且必须在协议里写清

## Decisions Made

1. **v1 用通用记录表（`blueprint_records`），不按语义生成物理表。**
   生成物理表需要 DDL 生成器 + 迁移策略 + 回滚语义（那是独立议题）。
   通用表能让本变更**一次做完**；代价是约束来自模板校验而非数据库 ——
   这个代价写进协议文本，而不是让读者以为有列约束。
2. **规则执行只做可确定性判定的那一半。**
   `validation` 的字面量比较（`greaterThan 0`、必填、类型）在写入时执行；
   `approval.when` 这类表达式**不求值**（与 `rules-expression` 的边界一致）。
   要执行审批，先做求值器 —— 那是下一个 change，不是顺手加的。
3. **模板放 `templates/`，与运行时包目录 `blueprints/` 分开。**
   前者是**源码**（可评审、可 diff、进仓库），后者是**产物**（`BLUEPRINT_PACKAGES_DIR`）。
   混在一起会让"模板改了但包没重打"变成常态。
4. **一个原子就够。** 汽配的最小真实动作是"下单要看可用量"，
   `available-inventory` 正好覆盖。新增 Rust 模块会引入构建/闸/复现链条，
   那是另一条线的工作量，与本变更要证明的事无关。

## Out of Scope

- 按语义生成物理表与迁移
- 审批 / 记账的**执行器**（本变更只到"声明 + 编译期校验"）
- 事件总线驱动的流程推进（`flows.json` 目前是 DAG 声明 + 编译期校验）
- 行业模板的第二个样本（先证明一个能跑，再谈批量）
- 前端（属 `add-chat-first-erp`）
