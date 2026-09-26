# Change: Add Deliverable Blueprint（从 SaaS ERP 到 ERP 生成器）

## Why

本仓库现在是一个**多租户 SaaS 形态的、可配置 ERP**：一套代码、一个库
（`DB_NAME=sapbasic`，无 per-tenant schema）、12 个 `TenantAwareEntity`、
Stripe 订阅（`SubscriptionsController` + `Organization.stripe*`）；
前端 35 个固定页面里只有 6 个走 schema 运行时渲染。

而"生成器"要回答的是另一个问题：

> **能不能把"某个行业的 ERP"当成一个包交给别人，他那边不改代码就能跑起来？**

现状（实测）：

```text
包的读写与完整性   ✅ .erpkg（逐文件哈希 + 分层 + 依赖）
编译与加载         ✅ 语义 → 依赖闭包 → 冲突检测 → IR → 可执行计划
可执行             ✅ 原子运行时（零能力 Wasm）+ 插件沙箱
──────────────────────────────────────────────────
业务定义完整吗     ❌ 只有 semantic.json / flows.json
                      —— 规则、审批、记账、交互策略都没地方写
能被授权吗         ❌ 无签名、无租户绑定、无到期/再销售约束
                      —— 包可以被任意复制、任意运行
```

所以"能跑"通了，"**能交付并控住授权**"没通。这两件事不通，包就只是
"我们内部的一份配置"，不是可以卖给客户或行业伙伴的**制品**。

## What Changes

- **ADDED**: `schemas/blueprint-rules.schema.json` —— 规则层：
  `validation`（字段/跨字段校验）、`approval`（审批条件与路径）、`accounting`（记账分录）
- **ADDED**: `schemas/blueprint-experience.schema.json` —— **Experience Policy**：
  什么信息重要（priority）、什么必须确认（confirm）、什么可自动化（automate）、
  什么该触发一个交互面（surface 触发条件）
- **ADDED**: `schemas/blueprint-license.schema.json` —— 授权与签名：
  绑定的租户、可否再销售、有效期、`signature`（Ed25519）
- **MODIFIED**: 编译器 —— 覆盖两个新层（**未覆盖的文件仍然拒绝**），并新增判据：
  规则引用的实体/字段/状态必须存在；experience 引用的实体/动作必须存在
- **MODIFIED**: IR —— 携带规则与经验策略的摘要（`irDigest` 因此覆盖这两层，
  任何一层改动都会被防漂移检查发现）
- **ADDED**: 授权校验链 —— 装载时先验签（Ed25519）再验授权（租户绑定/到期/再销售），
  任一不过即拒（fail-closed，不回退到"先跑起来"）
- **ADDED**: 交付验证 —— 在**另一个租户**上用同一个 Runtime 装载同一个包，
  不改一行代码（这是"生成器"的验收判据，不是演示）

## Impact

- 受影响规格：`blueprint-package`（新增两层文件 + 授权）、`blueprint-compiler`
  （新增两层判据）、新增能力 `blueprint-delivery`（授权与交付）
- 受影响代码：`schemas/`、`docs/protocols/blueprint-ir.md`、
  `backend/src/blueprint/{compiler,loader,blueprint-validator}.ts`、
  新增 `backend/src/blueprint/license.ts`
- **不放松任何既有闸**：未覆盖的文件仍然拒编译；IR 摘要仍然比对；装载仍然 fail-closed。
  本次是**加严**（多两层判据、多一道授权门）
- 风险：把"授权"做进装载器会让**本地开发变麻烦**（每个包都要签名）。
  对策见 decisions 第 4 条：开发模式用一个**显式的**未签名豁免开关，
  且该开关在审计里留痕、在生产配置里被拒绝

## Decisions Made

1. **不补 `forms.json`，补 `experience.json`。**
   《设计方案 v3》里的 Blueprint 有"表单层"，但那是**页面前提**下的产物：
   与 `add-chat-first-erp` 一起看，交互应该由意图与经验策略**即时生成**，
   而不是预先冻结成表单。所以本变更补的是"**经验策略**"这一层：
   它描述"什么重要、什么要确认、什么能自动"，而**不由它决定长什么样**。
   —— 协议层数因此不增反降（Form 不会成为协议的一部分）。
2. **BOM 不是一层。** BOM（物料清单）是 `Item` / `BOMLine` 这类**实体与关系**，
   属于 `semantic.json`，不是新的协议层。
   把它单列成层会让协议膨胀，且会让"BOM 可以绕过语义校验"这种坏事变成可能。
   （v3 设计文档里的"BOM"栏位在此收敛。）
3. **先做签名与授权绑定，不做加密。**
   加密（Protected 层 Capsule）的强度目标（防二次销售）**依赖授权模型先存在** ——
   没有"谁被授权"的定义，"防谁"就无从谈起。所以本变更做
   `license.json` + Ed25519 验签 + 租户绑定/到期/再销售检查；
   加密与密钥分发留给下一个变更（v3 协议 5 的后半）。
4. **未签名豁免必须显式且可查。**
   `BLUEPRINT_ALLOW_UNSIGNED=1` 只允许用于开发；装载时写审计
   （`blueprint.load.unsigned`），且生产配置里必须为未设置。
   静默接受未签名包 = 授权门形同虚设。
5. **验收判据是"换个租户不改代码能跑"，不是"我们自己的库能跑"。**
   同库同租户跑通只证明"代码没坏"；跨租户装载才证明"包是制品"。

## Out of Scope

- **市场与结算**（上架、定价、分成、水印）：属商业形态，本变更只做"能被授权"
- **Protected 层加密与密钥分发**：依赖授权模型，下一个变更
- **客户本地/离线运行时**（含本地 LLM）：属运行时分发，另立变更
- **把 35 个固定页面拆掉**：那是 `add-chat-first-erp` 的路线目标；本变更不碰前端
- **行业模板的实际内容**（汽配/医疗器械…）：本变更只保证"能表达、能交付、能授权"
