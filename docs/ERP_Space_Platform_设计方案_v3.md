# ERP Space Platform 平台设计方案 v3.0（融合落地版）

> 版本：3.0
> 来源：融合《ERP_Space_Platform_设计方案》（v1，总体架构与语义底座）与《ERP Space Platform 设计方案 2.0》（v2，协议、编译器、运行时、许可市场与 LLM 编排）
> 落地基座：本仓库 `sapbase`（`speckit` 前端运行时 + NestJS 后端 + `shared-schemas`）
> 定位：从"可配置 ERP"升级为 **ERP 协议、编译器、运行时与许可市场**

---

## 0. 文档说明

### 0.1 三个版本的关系

| 版本 | 内容焦点 | v3 的处理 |
| --- | --- | --- |
| v1 | 总体架构、语义元模型、原子能力、九空间、Blueprint 概念 | **全部保留为骨架**，补齐协议与执行细节 |
| v2 | 五协议、Blueprint Package、Capsule、许可与水印、Space Orchestrator、Context Compiler、Design Studio | **全部保留为升级层**，去重、消解冲突、按落地顺序重排 |
| v3（本文） | 融合后的单一权威设计 + 与本仓库现状的对齐与差距分析 | 新增「与 sapbase 现状的对齐」「差距分析」「路线图与仓库映射」三节 |

v1 与 v2 不是两个方案，而是同一方案的两个阶段：v1 定义了"ERP 是 Blueprint + Runtime"，v2 定义了"Blueprint 怎么编译、怎么授权、怎么被 LLM 生成"。v3 把它们压成一条可执行的链路，并回答"在本仓库里，先做什么"。

### 0.2 冲突消解记录

| 议题 | v1 主张 | v2 主张 | v3 决策 |
| --- | --- | --- | --- |
| 元模型 Ω | $\langle E,O,R,\Phi\rangle$ | $\langle E,O,R,\Phi,\Sigma,\Lambda,\Gamma,\Tau,V,C\rangle$ | 采用十元组，但划分为**四个必需维度（E/O/R/Φ）+ 六个渐进维度**，防止协议膨胀 |
| 客户能否导出 Blueprint | 可导出 | 分层导出，受 License 限制 | 分层导出；默认 `export=true`（业务层）、`resell=false`（再销售层） |
| 模板能否被二次转卖 | 未讨论 | 默认禁止，靠 Capsule + 许可约束 | 默认禁止，允许卖家显式开通再销售许可并参与分成 |
| Runtime 是否包含 LLM | 未讨论 | 明确分离：生产 Runtime 不含 Jev | 采纳；运行时 AI 只以 **Agent Host** 形式可选存在 |
| 上下文裁剪由谁决定 | 未讨论 | 由 Context Compiler 决定，而非 LLM | 采纳，作为硬性架构约束 |
| 安全假设 | "不假设客户绝对无法逆向" | 同 | 采纳为原则：不承诺绝对安全，用"加密容器 + WASM + 许可/水印/法律"三层防线 |
| 空间划分 | 九空间 | 九空间 + Compile Space + License Space | 采纳 11 空间，但**明确其为叙事/组织层**，与执行引擎的划分不混用 |

### 0.3 建议阅读路径

| 读者 | 建议章节 |
| --- | --- |
| 决策者 / 投资人 | 1、2、15、16、17 |
| 架构师 | 3、4、5、6、7、14 |
| 后端工程师 | 4、5、6、14、15 |
| 前端工程师 | 6.2（Form Engine）、7、8.3（Delta 与 Patch DSL）、14 |
| 平台/生态负责人 | 11、12、13、15 |

---

## 1. 一页速览

**一句话定义**

> 不是让客户购买一个 ERP，而是让客户购买、设计和组合一个 ERP Blueprint，再由统一的 ERP Runtime 把 Blueprint 编译成可运行的企业系统。

**升级版定义**

> ERP Space Platform 不是 ERP，而是 ERP 的协议、编译器、运行时和许可市场。客户购买的是 Blueprint + License，平台控制执行内核。客户拥有业务定义，平台保护核心实现，行业专家交易知识资产。

**四条不可跨越的边界**

```text
协议边界    元模型 / 原子契约 / 包格式 / 运行时契约 / 许可协议
编译边界    Blueprint 必须经过 Validator + Compiler，禁止 eval 式直译
执行边界    Runtime 只执行被验证、签名、许可的 Blueprint
授权边界    模板文件 ≠ 可运行模板，必须 License + Key + Runtime + 绑定
```

**五个必须先冻结的协议（Phase 0）**

```text
1. ERP Meta Model              业务对象、字段、关系、状态、事件、能力、上下文、版本
2. Atomic Contract             原子的输入、输出、前置后置条件、副作用、幂等、权限、实现封装
3. Blueprint Package           语义 / 流程 / 规则 / 表单 / BOM / 审批 / 记账 / 分层 / 签名
4. Runtime SDK Contract        Blueprint 如何被本地 Runtime 加载、验证、编译、执行
5. License / Encryption Protocol  模板如何加密、授权、绑定客户并防止二次销售
```

**三种运行形态**

```text
Cloud Control Plane  设计、编译、交易、授权（含 Jev 编排）
Local Runtime        只执行 Blueprint（不含 Jev，确定性、可审计）
Design / Debug       本地设计或调试（含 Jev，进程隔离，Design License ≠ Runtime License）
```

**与仓库现状的一句话差距**

本仓库已经具备 Blueprint 的"下半身"（前端 Schema 运行时、Patch DSL、页面/表单/集合运行时、模块注册表、工作流引擎、AI 模块定义流程），缺少"上半身"（Atomic Contract、Blueprint Compiler、包与签名、License/Capsule、Marketplace 交易）。详见第 14 节。

---

## 2. 产品定义、角色与边界

### 2.1 定义

平台的核心产品不是某一个采购、库存或财务模块，而是一个能够把行业业务知识编译成 ERP 蓝图，并由统一 Runtime 执行的 **ERP 操作空间**。

```text
业务对象 + 关系 + 能力 + 规则 + 流程 + 计算 + UI
        ↓
     Blueprint（可交易、可组合、可版本化）
        ↓
     Compile（验证 → IR → 执行计划）
        ↓
     Runtime（本地执行，数据主权留在客户侧）
```

### 2.2 角色

| 角色 | 提供什么 | 获得什么 |
| --- | --- | --- |
| 平台方 | 元语底座、编译器、运行时、许可与市场 | 内核 IP、交易抽成 |
| 行业开发者 / 专家 | 行业 Blueprint、模块、原子、连接器 | 模板与模块销售收入 |
| ISV / 咨询公司 | 实施、定制、方案组合 | 服务收入 + 方案分成 |
| 客户 | 需求与业务知识 | 可迁移的业务定义、本地数据主权 |
| 认证机构 | 功能/安全/性能/合规/许可认证 | 认证服务收入 |
| 模型供应商 | 设计时大模型（L2 层） | 推理服务收入 |

### 2.3 做什么 / 不做什么

| 做 | 不做 |
| --- | --- |
| 定义 ERP 的协议与编译链 | 把 ERP 做成一堆写死的业务模块 |
| 提供可交易的 Blueprint 生态 | 免费开放核心执行内核源码 |
| 让客户拥有并可迁移业务定义 | 绑定客户的业务数据到平台云 |
| 让 LLM 生成结构化 Delta | 让 LLM 直接生成可执行代码或最终文件 |
| 让生产运行时确定性、可审计 | 让生产运行时依赖 LLM 才能工作 |

---

## 3. 总体架构

### 3.1 融合架构图

```text
                         ERP Space Platform
┌────────────────────────────────────────────────────────────────────┐
│                          Cloud Control Plane                       │
│  Meta Studio                                                       │
│  ├ Semantic Designer   ├ Flow Designer    ├ Form Designer          │
│  ├ Rule Designer       ├ BOM Designer     ├ Approval Designer      │
│  └ Accounting Designer                                             │
│                                                                    │
│  Space Orchestrator                                                │
│  ├ Intent Parser       ├ Space Router     ├ Task Graph Planner      │
│  ├ Delta Generator     ├ Delta Validator  ├ Delta Repairer          │
│  └ Space Merger                                                    │
│                                                                    │
│  Context Compiler      Blueprint Compiler   Jev-like LLM (L2)       │
│  Registry              Certification        Marketplace            │
│  License Server        Watermark Service                           │
├────────────────────────────────────────────────────────────────────┤
│                          Experience Space                          │
│  表单 / 工作台 / Dashboard / 移动端 / 门户 / 打印模板               │
├────────────────────────────────────────────────────────────────────┤
│                           Design Space                             │
│  流程设计 / 表单设计 / 规则设计 / 语义设计 / BOM / 审批 / 记账       │
├────────────────────────────────────────────────────────────────────┤
│                     Workflow & Blueprint Space                     │
│  Blueprint / Flow / Rule / Approval / Accounting / BOM              │
├────────────────────────────────────────────────────────────────────┤
│                          Semantic Space                            │
│  业务对象 / 字段 / 状态 / 关系 / 事件 / 能力 / 数据语义              │
├────────────────────────────────────────────────────────────────────┤
│                            Meta Kernel                             │
│  元模型 / 类型系统 / Schema / ID / Version / Policy / ACL           │
├────────────────────────────────────────────────────────────────────┤
│                         Execution Kernel                           │
│  Atomic / Compute / Rule / Workflow / Accounting / Form / Event     │
├────────────────────────────────────────────────────────────────────┤
│                        Local SDK Runtime                           │
│  Loader / Verifier / Compiler / Scheduler / Transaction / EventStore│
│  Query / Connector / Cache / Security / License / Telemetry         │
├────────────────────────────────────────────────────────────────────┤
│                     Marketplace & Value Space                      │
│  行业模板 / 原子组件 / 模块 / 方案 / 交易 / 授权 / 分成              │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 五个面（职责边界）

| 面 | 职责 | 默认位置 | 数据主权 |
| --- | --- | --- | --- |
| 控制面 | 设计、编译、交易、授权、认证、编排 | 平台云 | 仅元数据 |
| 执行面 | 加载、验证、编译、执行 Blueprint | 客户本地 | 业务数据 |
| 数据面 | 业务数据、审计、事件存储 | 客户本地（默认） | 客户 |
| 信任面 | 签名、加密、审计、水印、License | 双层 | 双签 |
| 价值面 | Blueprint / Atomic / Module / Solution 的交易与分成 | 平台云 | 交易数据 |

### 3.3 分层可见性（平台对客户的暴露面）

| 层 | 客户可见 | 客户可改 | 可导出 | 说明 |
| --- | --- | --- | --- | --- |
| Public Layer | 是 | 是 | 是 | 语义、表单、基础流程 |
| Config Layer | 是 | 是 | 部分 | 阈值、字段映射、参数 |
| Protected Layer | 否 | 否 | 否 | 核心规则、专有算法、特殊原子组合 |
| Kernel Layer | 否 | 否 | 否 | Native/WASM 执行内核 |

---

## 4. 元语底座：ERP Semantic Kernel

### 4.1 元模型

v1 的四元组扩展为十元组：

$$
\Omega=\langle E,O,R,\Phi,\Sigma,\Lambda,\Gamma,\Tau,V,C\rangle
$$

| 符号 | 含义 | 必需性 | 说明 |
| --- | --- | --- | --- |
| $E$ | Entity | 必需 | 业务实体：Customer、PurchaseOrder |
| $O$ | Object | 必需 | 实体实例：PO20260924、WH01 |
| $R$ | Relation | 必需 | 对象关系：belongsTo、hasMany |
| $\Phi$ | Constraint / Policy / Behavior | 必需 | 必填、唯一、库存约束、信用额度、会计规则 |
| $\Sigma$ | State | 渐进 | 状态机：draft、submitted、approved |
| $\Lambda$ | Event | 渐进 | 领域事件：OrderSubmitted、InvoicePosted |
| $\Gamma$ | Capability | 渐进 | 能力：submit、approve、receive |
| $\Tau$ | Time | 渐进 | 生效时间、有效期、生命周期 |
| $V$ | Version | 渐进 | 语义版本、兼容性、迁移 |
| $C$ | Context | 渐进 | 租户、组织、权限、设备、区域 |

> 设计约束：E/O/R/Φ 是 Blueprint 的**必填**部分；其余六个维度允许先缺省，后续按需补齐。这样协议不会因为追求完备而无法冻结。

### 4.2 语义对象骨架

```json
{
  "id": "PurchaseOrder",
  "version": "1.0.0",
  "lifecycle": "active",
  "visibility": "public",
  "fields": [],
  "relations": [
    { "to": "Supplier", "type": "belongsTo" },
    { "to": "PurchaseOrderLine", "type": "hasMany" }
  ],
  "states": ["draft", "submitted", "approved", "received", "closed"],
  "events": [],
  "capabilities": ["submit", "approve", "receive", "close"],
  "policies": [],
  "migrations": []
}
```

由此，"采购订单"不再只是一张数据库表，而是一个**可版本化、可迁移、可组合**的语义对象。

### 4.3 与仓库现状的对齐

| 平台概念 | 仓库现状 | 差距 |
| --- | --- | --- |
| Entity / Object | `speckit/src/core/schema/types.ts` 的 `ObjectSchema` | 缺 `states/events/capabilities/policies/lifecycle` |
| Field | `FieldDefinition`（含 validation、permissions） | 基本可用，缺条件显隐与联动表达式 |
| Relation | `Relation`（one-to-one / one-to-many / many-to-many） | 缺关系级策略与级联语义 |
| State | `backend/src/workflows/workflow-definition.entity.ts`、`speckit` Patch DSL 的 `state` scope | 状态机在后端，前端语义对象只有引用，未统一到元模型 |
| Version | `ObjectSchema.version`、`speckit/src/core/patch/version-control.ts` | 只有字符串版本，缺兼容性与迁移定义 |

---

## 5. 五个核心协议

在开始大量开发采购、库存、财务 UI 之前，先冻结这五个协议。协议稳定后，ERP 开发就从"不断写业务代码"转变为"语义建模 + 原子组合 + 规则配置 + Blueprint 编译"。

### 5.1 协议一：ERP Meta Model

**目的**：定义业务对象、字段、关系、状态、事件、能力、上下文、版本。

**冻结标准**

```text
- 每个语义对象必须有 id / version / fields
- 字段类型集合封闭（新增类型需走 Profile）
- 关系必须可被解析为图（用于 Compiler 的依赖闭包）
- 状态与事件必须是命名空间内的显式标识
- 所有对象可被权限过滤（visibility + ACL）
```

**当前状态**：部分存在于 `speckit/src/core/schema`，需要抽到 `schemas/` 与 `shared-schemas` 共享层。

### 5.2 协议二：Atomic Contract

**目的**：定义原子能力的输入、输出、前置/后置条件、副作用、事务、幂等、权限、错误与实现封装。

原子分类：

```text
Command Atomic        创建、提交、审批、预留
Query Atomic          查询库存、查询信用
Calculation Atomic    计税、成本、MRP
Effect Atomic         写库存、写凭证、发消息
Integration Atomic    调用外部系统
Audit Atomic          写审计、签名、水印
```

契约骨架：

```json
{
  "atomic": "ReserveInventory",
  "version": "1.2.0",
  "kind": "command",
  "input": {
    "warehouse": "string",
    "material": "string",
    "quantity": "decimal",
    "requestId": "string"
  },
  "output": { "reservationId": "string", "reservedQuantity": "decimal" },
  "preconditions": ["inventory.available >= quantity"],
  "postconditions": ["inventory.reserved += quantity"],
  "sideEffects": ["InventoryReserved"],
  "idempotency": "requestId",
  "transaction": "local",
  "permissions": ["inventory.reserve"],
  "errors": ["INSUFFICIENT_INVENTORY", "WAREHOUSE_LOCKED"],
  "audit": true,
  "implementation": {
    "type": "wasm",
    "hash": "sha256:...",
    "encrypted": true
  }
}
```

客户可见的是原子名称、参数、前后置条件；不可见的是实现。这是平台保护核心 IP 的第一道边界。

```json
{
  "atomic": "ReserveInventory",
  "params": {
    "warehouse": "$order.warehouse",
    "material": "$line.material",
    "quantity": "$line.quantity"
  }
}
```

**冻结标准**

```text
- 所有 Command Atomic 必须支持 requestId 幂等
- 所有 Atomic 必须声明 permissions 与 errors
- 所有失败流程必须能定位到补偿原子
- 实现体不得以可读源码形式分发（WASM/Native 封装）
```

### 5.3 协议三：Blueprint Package

**目的**：定义完整 ERP 的语义、流程、规则、表单、BOM、审批、记账、分层与签名。

$$
Blueprint=\langle Semantic, Atomic, Flow, Rule, Form, BOM, Approval, Accounting, Policy \rangle
$$

包结构：

```text
blueprint.erpkg
├── manifest.json
├── semantic.json
├── forms.json
├── flows.json
├── rules.public.json
├── bom.json
├── approval.json
├── accounting.json
├── connectors.json
├── config/
│   └── thresholds.json
├── protected/
│   ├── rules.enc
│   ├── flows.enc
│   ├── proprietary_atoms.enc
│   └── algorithms.enc
├── signature.sig
└── license.json
```

manifest 骨架：

```json
{
  "blueprint": "auto-parts-erp",
  "version": "2026.1",
  "runtime": ">=1.0 <2.0",
  "dependencies": [
    { "atomic": "ReserveInventory", "version": "^1.2" },
    { "module": "inventory-core", "version": "^2.0" }
  ],
  "layers": {
    "public": ["semantic.json", "forms.json"],
    "configurable": ["config/thresholds.json"],
    "protected": ["protected/rules.enc", "protected/flows.enc"]
  },
  "license": { "required": true, "server": "https://license.erp-space.io" }
}
```

### 5.4 协议四：Runtime SDK Contract

**目的**：定义 Blueprint 如何被本地 Runtime 编译和执行。

```text
Blueprint Package
   ↓
Loader        加载 Blueprint 包
Verifier      验证签名、License、依赖、哈希
Compiler      将 IR 编译为执行计划
Scheduler     调度原子、流程、事件
Transaction   本地事务、Saga、Outbox
Event Store   事件溯源、审计
Query         查询、投影、缓存
Connector     外部系统连接
Security      ACL、加密、沙箱
License       授权、租约、离线验证
Telemetry     日志、指标、追踪
   ↓
Customer ERP
```

**冻结标准**

```text
- Runtime 不得接受未通过 Verifier 的 Blueprint
- Runtime 不得包含 LLM 推理依赖（生产形态）
- 所有执行必须产生可审计事件
- 一切执行计划必须可由 IR 复现
```

### 5.5 协议五：License / Encryption Protocol

**目的**：定义行业模板如何加密、授权、绑定客户并防止二次销售。

核心等式：

```text
Template File
  + License
  + Key
  + Runtime
  + Device / Tenant Binding
  = Runnable ERP
```

License 骨架：

```json
{
  "licenseId": "LIC-2026-0001",
  "templateId": "auto-parts-erp",
  "sellerId": "SELLER-001",
  "buyerId": "BUYER-001",
  "tenantId": "TENANT-001",
  "deviceFingerprint": "sha256:...",
  "allowedRuntime": ">=1.0 <2.0",
  "expiration": "2027-12-31",
  "permissions": { "run": true, "modify": true, "export": false, "resell": false },
  "offline": { "enabled": true, "gracePeriodDays": 30 },
  "signature": "ed25519:..."
}
```

---

## 6. 执行内核：Local SDK Runtime

### 6.1 八个引擎

| 引擎 | 回答的问题 | 职责 | 仓库现状 |
| --- | --- | --- | --- |
| Atomic Engine | 做什么 | 执行最小业务能力，封装实现 | 无（仅 Service/CRUD） |
| Compute Kernel | 怎么算 | 公式、聚合、税、成本、MRP、定价、分摊 | 无统一层，逻辑散落 |
| Rule Engine | 是否允许 | 校验、业务、策略、权限、计算、状态、会计、合规规则 | 部分（workflow guard、stateflow schema） |
| Workflow Engine | 按什么顺序 | 状态机、DAG、事件流、人工/自动任务、补偿、超时 | 已有（transition-engine、history、auto-transition） |
| Accounting Engine | 记什么账 | 业务单据 → 会计事件 → 分录 → 总账 → 报表 | 无 |
| Form Engine | 怎么呈现 | 表单 Schema 化、布局、联动、校验、打印 | 部分（`FormRuntime`、`CollectionRuntime`） |
| Event Engine | 发生了什么 | 领域事件、订阅、Outbox、事件溯源 | 无（仅有 audit-logs） |
| Query Engine | 怎么查 | 查询、投影、缓存、物化视图 | 部分（后端查询 + cache） |

### 6.2 引擎要点

**Compute Kernel**：计算能力必须统一，不能散落在行业模板代码里。

```text
销售金额   = Σ(数量 × 单价 × (1 - 折扣率))
可用库存   = 现有库存 - 已预留库存 + 在途库存
净需求     = 毛需求 - 当前库存 - 在途库存 + 安全库存
```

**Rule Engine** 必须支持：优先级、冲突检测、决策表、可解释性、版本化、沙箱执行。

```json
{
  "rule": "PO_APPROVAL_REQUIRED",
  "when": { "field": "totalAmount", "operator": ">", "value": 100000 },
  "then": { "action": "requireApproval", "workflow": "PURCHASE_HIGH_VALUE" }
}
```

**Workflow Engine** 必须支持：人工任务、自动任务、补偿事务、超时、并行网关、事件触发。

```text
销售订单 → 提交 → 信用检查 → 审批 → 释放库存 → 发货 → 开票 → 收款 → 会计记账
              ↓ 不通过
            驳回
```

**Form Engine**：ERP 的可配置能力最终大量落到表单，因此表单必须完全 Schema 化，前端因此成为统一的 ERP UI Runtime，而不是针对每个客户独立开发页面。

**Accounting Engine**：会计是平台一级引擎，不是财务模块里的硬编码。

```text
业务单据 → 会计事件 → 记账规则 → 会计分录 → 总账 → 报表

销售出库：借 主营业务成本 / 贷 库存商品
销售开票：借 应收账款 / 贷 主营业务收入 / 贷 应交税费
```

必须支持：复式记账、多币种、多会计准则、税务、期间关闭、冲销、审计、不可变凭证（只冲销不修改）。

### 6.3 一致性模型

```text
本地强一致         ACID 事务
跨模块最终一致     Saga + Outbox
审计不可变         事件溯源
会计不可变         凭证只冲销，不修改
幂等               所有 Command Atomic 必须支持 requestId
补偿               所有失败流程必须定义补偿原子
```

### 6.4 扩展沙箱

```text
- 第三方插件只能以 WASM 运行
- 资源限制：CPU、内存、时间、网络
- 权限声明：插件必须声明所需原子与权限
- 市场认证：未认证插件不能访问核心原子
```

### 6.5 执行链：禁止 eval 式直译

```text
推荐：Blueprint JSON → Blueprint Compiler → IR → Runtime → Native/WASM Atomic Module
禁止：JSON → JavaScript eval()
```

原因不是性能，而是**可验证性**：只有经过符号验证与 IR 编译的 Blueprint，才能保证权限、会计平衡、状态合法性与可审计性。

---

## 7. Blueprint Package 与编译链

### 7.1 编译链

```text
Blueprint JSON
   ↓
Schema 验证
   ↓
依赖解析
   ↓
语义图
   ↓
策略图
   ↓
冲突检测
   ↓
优化
   ↓
Intermediate Representation (IR)
   ↓
模块绑定
   ↓
签名 + 加密
   ↓
Runtime 加载
```

IR 示例：

```text
on SalesOrder.submitted:
  check Customer.credit
  reserve Inventory
  if total > 100000:
      require Approval PURCHASE_HIGH_VALUE
  post Accounting.SALES_INVOICE_POSTED
```

### 7.2 行业 Blueprint 示例（汽车零部件 ERP）

```text
Semantic   Customer / Supplier / Material / Product / Machine / WorkOrder / QualityRecord
Atomic     CreatePO / ReceiveMaterial / IssueMaterial / StartWorkOrder / CompleteWorkOrder / QualityInspection
Flow       PurchaseFlow / ProductionFlow / SalesFlow
Rule       SupplierQualification / MaterialInspection / CreditLimit / QualityRelease
BOM        Product BOM / Production BOM
Approval   PurchaseApproval / ExpenseApproval
Accounting InventoryPosting / CostPosting / RevenuePosting
```

行业模板不是源代码，而是由这些可组合元素构成的 Blueprint。

### 7.3 三层层级（客户视角）

```text
Layer 1：Blueprint         客户可见、可编辑、可导出
Layer 2：Atomic Contract   客户可见接口、可配置参数、不可见实现
Layer 3：Execution Kernel  完全由平台控制、不可导出源码、由 SDK 执行
```

客户可以拿到：`semantic.json`、`atomic-flow.json`、`rule.json`、`form.json`、`bom.json`、`approval.json`、`accounting.json`、`manifest.json`。

客户拿不到：Atomic Engine、Compute Kernel、Rule Engine、Workflow Engine、Accounting Engine、Runtime Core 的源码。

---

## 8. 设计时编排：Space Orchestrator

### 8.1 一句话架构

```text
Space Model = 类型系统 + 共享黑板 + 约束图
Jev-like LLM = 快速结构化设计生成器
Space Delta = LLM 输出语言
Validator / Compiler = 正确性边界
Runtime = 执行边界
Marketplace / License = 价值与授权边界
```

不要让 Jev 这类快速结构化模型"自由生成系统"，而应把它改造成 **Space Delta 生成器**。

### 8.2 总体链路

```text
用户需求
   ↓
Intent Parser
   ↓
Space Router
   ↓
Task Graph Planner
   ↓
并行 Delta Generator（Jev-like LLM）
   ↓
Delta Validator
   ↓
Delta Repairer（失败回环）
   ↓
Space Merger
   ↓
Blueprint Compiler
   ↓
Runtime 执行
   ↓
反馈收集 → 更新 Space Model / 模板 / 原子目录
```

Jev 只负责 `Delta Generator` 与 `Delta Repairer`，**不负责最终正确性**。

### 8.3 Space Delta 协议（与仓库 Patch DSL 的融合）

Space Delta 是 LLM 的输出语言，本质是 JSON Patch 的领域扩展。

```json
{
  "protocol": "space-delta/v1",
  "base_version": "rev-123",
  "operations": [
    { "op": "add", "path": "/semantic/entities/-", "value": {} },
    { "op": "update", "path": "/policy/rules/PO_APPROVAL_REQUIRED", "value": {} },
    { "op": "remove", "path": "/flows/old-flow" },
    {
      "op": "link",
      "from": "/semantic/entities/PurchaseOrder",
      "to": "/semantic/entities/Supplier",
      "type": "belongsTo"
    }
  ],
  "rationale": [],
  "validation_hints": []
}
```

选择 Delta 而非整文件生成的理由：快速模型适合小输出；可并行生成；可增量验证；可回滚；可合并冲突；可审计。

**本仓库已有 Patch DSL，是 Space Delta 的前身**，建议直接演进而非另起一套：

| Patch DSL 现状（`speckit/src/core/patch/types.ts`） | Space Delta v2 目标 |
| --- | --- |
| `scope: 'page' \| 'object' \| 'permission' \| 'state' \| 'menu'` | 扩展为 `semantic \| policy \| flow \| form \| accounting \| bom \| approval \| page \| menu` |
| `operation: 'add' \| 'update' \| 'remove' \| 'reorder' \| 'replace'` | 增加 `link`（建立关系）与 `unlink`，并保留现有五种 |
| `SecurityLevel: 'L1' \| 'L2' \| 'L3'` | 保留，作为 Validator 的自动化门禁等级 |
| `patch-validator.ts` | 升级为 Delta Validator（Schema + 引用完整性 + 权限 + 可执行性） |
| `patch-manager.ts` / `executor.ts` | 升级为 Space Merger + 执行计划生成 |
| `audit-logger.ts` / `version-control.ts` | 保留为 Trust Space 的审计与版本基础 |
| `hot-reload.ts` | 保留为开发者调试能力的载体 |

这一步是本仓库**投入产出比最高**的演进：已有骨架，只需扩展命名空间与验证强度。

### 8.4 多智能体分工

| 角色 | 输出 |
| --- | --- |
| Planner LLM | 任务分解 |
| Semantic LLM | 实体、字段、关系、状态 |
| Policy LLM | 规则、审批、权限 |
| Compute LLM | 公式、成本、MRP、税务 |
| Flow LLM | 流程、事件、补偿 |
| Form LLM | 表单、布局、工作台 |
| Accounting LLM | 会计事件、分录、期间 |
| Packager LLM | manifest、依赖、版本 |
| Validator LLM | 解释错误、建议修复 |

每个角色只输出局部 Delta，使用局部 Schema。

### 8.5 L0–L3 决策分层

```text
L0 确定性层   平台预定义：Schema、路由表、预算策略、权限策略、可见性规则
L1 轻量模型层 意图分类、实体链接、候选排序、歧义消解
L2 大模型层   任务规划、复杂意图解析、Delta 修复
L3 验证层     Schema 验证、引用完整性、权限验证、可执行性验证
```

### 8.6 强制验证清单

本地生成的 Blueprint 必须经过**本地确定性验证器**，不能由 Jev 自己判断：

```text
Schema 验证 / 引用完整性 / 状态机合法性 / 原子存在性 / 权限边界
会计平衡 / 依赖版本 / 许可范围 / 可执行性
```

失败则回环给 Jev 修复，而不是直接放行。

---

## 9. Context Compiler：提示词裁剪

### 9.1 原则

不要把整个 Space Model 全量塞进 prompt。裁剪版提示词不应该由任何单一 LLM 全权决定。

> **大模型决定"要查什么"，Context Compiler 决定"实际塞什么"，Validator 决定"能不能用"。**

### 9.2 组件

```text
Context Compiler
├── Intent Reader
├── Space Router
├── Task Graph Reader
├── Seed Resolver
├── Graph Expander
├── Dependency Closer
├── Permission Filter
├── Budget Manager
├── Compressor
├── Cache
└── Context Envelope Builder
```

它不生成业务内容，只生成**给 Jev 的最小上下文包**。

### 9.3 裁剪流程

```text
种子：PurchaseOrder, Supplier, Material
   ↓ 图扩展：1-2 跳关系
   ↓ 依赖闭包：相关原子、规则、状态机
   ↓ 权限过滤：只保留当前租户可见内容
   ↓ 预算裁剪：按 token 预算保留高优先级
   ↓ 压缩：契约、签名、示例，而不是全量实现
   ↓ 缓存：按 task + version + permission 缓存
```

输出的 Context Envelope：

```json
{
  "task": "generate_semantic_delta_for_purchase_order",
  "schema": "space-delta/v1",
  "subgraph": {
    "entities": ["PurchaseOrder", "Supplier", "Material"],
    "relations": [
      { "from": "PurchaseOrder", "to": "Supplier", "type": "belongsTo" },
      { "from": "PurchaseOrder", "to": "PurchaseOrderLine", "type": "hasMany" }
    ],
    "states": ["draft", "submitted", "approved", "received", "closed"],
    "atomics": ["CreatePO", "SubmitPO", "ApprovePO", "ReceiveMaterial"],
    "rules": ["PO_APPROVAL_REQUIRED", "SupplierQualification"],
    "accounting": ["PURCHASE_RECEIPT_POSTED", "AP_INVOICE_POSTED"]
  },
  "constraints": [
    "totalAmount > 100000 requires approval",
    "approval before receipt",
    "receipt triggers AP"
  ],
  "output_contract": "space-delta/v1"
}
```

### 9.4 大模型的可参与边界

| 环节 | 大模型能否参与 | 说明 |
| --- | --- | --- |
| 意图解析 | 可以 | 自然语言 → 结构化 Intent |
| 任务规划 | 可以 | 生成任务 DAG，但必须符合 Schema |
| 检索请求生成 | 可以 | 输出"需要哪些实体/规则/原子" |
| 候选排序 | 可以 | 排序检索结果，最终由规则验证 |
| Delta 生成 | 可以 | Jev 生成 Space Delta |
| Delta 修复 | 可以 | 根据验证错误修复 |
| 上下文裁剪 | **不应全权决定** | 由 Context Compiler 决定 |
| 权限过滤 | **不能** | 必须确定性执行 |
| 最终验证 | **不能** | 必须符号验证 |

---

## 10. 部署形态与产品矩阵

### 10.1 三种本地形态

```text
1. Production Runtime      不含 Jev，只加载、验证、编译、执行 Blueprint
2. Local Design Studio     含 Jev，面向客户本地设计 Blueprint，与 Runtime 进程隔离
3. Developer Debug Kit     含 Jev + Runtime + 调试工具，可调试但不可导出内核
```

本地包含 Jev 时的关键原则：

```text
- Design Studio 与 Runtime 必须是两个独立进程
- Design Studio 不能直接写生产数据
- Design Studio 只能输出 Blueprint Package
- Runtime 只接受经过验证、签名、许可的 Blueprint
- Jev 不能绕过 Validator 和 Compiler
- Jev 不能直接读本地 Space Model 全量文件
```

Jev 在本地可以以三种方式存在：

| 模式 | 说明 | 适用 |
| --- | --- | --- |
| 云端代理 | 本地只发结构化请求，Jev 在云端 | 客户本地设计，保护模型 IP |
| 本地加密模型 | Jev 以加密 WASM/ONNX 等形式本地运行 | 离线设计、开发者调试 |
| 混合 | 小模型本地做意图/修复，大模型云端做规划 | 平衡成本与能力 |

无论哪种模式，都必须通过 **Jev Adapter** 接入：

```text
Jev Adapter
├── Model Router
├── Prompt Contract
├── Context Envelope Receiver
├── Output Schema Enforcer
├── Sandbox
├── Rate Limit
├── Audit
└── License Check
```

### 10.2 产品矩阵

| 产品 | Jev | Runtime | 目标用户 | 关键约束 |
| --- | --- | --- | --- | --- |
| Cloud Meta Studio | 有 | 无 | 平台 / 行业开发者 | 全功能设计 |
| Local Design Studio | 有 | 可选同机 | 客户 | 权限过滤、许可分离 |
| Developer Debug Kit | 有 | 有 | 开发者 | 可调试，不可导出内核 |
| Production Runtime | 无 | 有 | 客户生产 | 确定性、可审计 |
| Edge Runtime | 无 | 有 | 边缘设备 | 轻量、离线 |
| SaaS Runtime | 无 | 有 | 租户 | 云端隔离 |

### 10.3 License 类型分离

| License 类型 | 作用 | 是否含 Jev |
| --- | --- | --- |
| Design License | 允许设计、生成、修改 Blueprint | 是 |
| Debug License | 允许开发者调试 | 是 |
| Runtime License | 允许执行 Blueprint | 否 |
| Export License | 允许导出 Blueprint | 可选 |
| Resell License | 允许二次销售 | 默认否 |

Blueprint 生成后绑定：`Designer ID / Tenant ID / License ID / Watermark / Blueprint Hash`。
运行时再校验：`Blueprint Signature / Runtime License / Tenant Binding / Device Binding / Module Key`。

因此，**本地设计不等于本地可运行**。

开发者调试 License 单独定义：

```json
{
  "licenseType": "developer-debug",
  "allowed": {
    "run": true,
    "modify": true,
    "exportBlueprint": true,
    "exportKernel": false,
    "debug": true,
    "watermark": true
  }
}
```

### 10.4 运行时 AI：Agent Host

运行时可以包含 AI，但不是 Jev。

```text
设计时 AI（Jev-like LLM）：生成 Blueprint、Space Delta、修复设计 —— 位于 Cloud Control Plane / Meta Studio
运行时 AI（Agent Host）：预测、推荐、异常检测、对话助手 —— 位于 Local Runtime 可选模块
```

Agent Host 只能：调用 Atomic Contract、读取被授权的 Data Space、生成建议、触发低风险自动化、写审计。

Agent Host 不能：直接改会计凭证、绕过 Rule Engine、绕过 Workflow Engine、修改 Blueprint、生成新 Blueprint、访问未授权数据。

### 10.5 Jev 归属判断

| 场景 | 是否包含 Jev | 方案 |
| --- | --- | --- |
| 标准本地 ERP 运行 | 不包含 | Runtime 只执行 Blueprint |
| 客户本地设计 Blueprint | 可单独安装 | Local Design Studio，与 Runtime 分离 |
| 客户本地 AI 助手 | 不包含 Jev | 可选 Agent Host + 外部/本地模型 |
| 离线智能 | 不包含 Jev | 可选小型专用模型，非必需 |
| 受监管行业 | 不包含 | 审计、确定性、合规优先 |
| 开发者本地调试 | 可包含 | Design Runtime，非生产 Runtime |
| 边缘设备 | 不包含 | 资源受限，只执行 Blueprint |
| SaaS 模式 | 不包含 | Jev 在云端，Runtime 在租户侧 |

判断准则：

```text
如果目标是"执行 ERP"，不需要 Jev。
如果目标是"设计 ERP"，才需要 Jev。
```

---

## 11. 许可、IP 保护与信任体系

### 11.1 要解决的问题

```text
A 开发模板 → B 购买 → B 解压 → B 重新打包 → B 继续卖给 C
```

### 11.2 Blueprint Capsule / Capability Capsule

模板不能只是普通 ZIP，必须采用"软件许可证 + 加密容器"机制：

```text
template.erpkg
├── manifest.json
├── semantic.json
├── forms.json
├── flows.json
├── bom.json
├── approval.json
├── accounting.json
├── signature.sig
├── license.json
└── protected/
    ├── rules.enc
    ├── flows.enc
    └── proprietary_atoms.enc
```

普通 Blueprint 可直接查看；真正有 IP 价值的部分（核心流程、行业规则、特殊计算、专有算法、特殊原子组合）进入 protected 区域。这种带授权边界的加密模板即 **Blueprint Capsule**；若进一步与 License、Key、Runtime、设备/租户绑定，则升级为 **Capability Capsule**。

### 11.3 授权流程

```text
Seller 上传 Template
   ↓ Template Certification
   ↓ Template Registry
   ↓ 加密封装
   ↓ Marketplace
   ↓ Buyer 购买
   ↓ License Server 签发 Buyer-specific License
   ↓ SDK 获取解密 Key
   ↓ Local Runtime 运行
```

离线授权：许可证文件本地保存、公钥签名验证、硬件指纹绑定、短期租约 + 宽限期、撤销列表定期同步。

### 11.4 水印与追溯

```text
Buyer Watermark / Seller Watermark / License ID / Transaction ID / Runtime ID
```

即使出现盗版，也能追踪来源。

### 11.5 启动校验链

```text
Template Signature Verify
   ↓ Tenant Verify
   ↓ License Verify
   ↓ Device Verify
   ↓ Module Key Unwrap
   ↓ Runtime
```

### 11.6 现实边界（不要自欺）

不依赖"客户绝对无法逆向"这一假设，而是把目标定义为：

> 客户获得业务蓝图，但获得不了可移植的核心实现；即使拿到本地 Runtime，也无法直接复制整个平台。

三层防线：

```text
技术层    加密容器 + WASM/Native 封装 + 水印 + 设备绑定
许可层    分层 License + 离线租约 + 撤销列表
法律层    许可条款 + 合同 + 侵权追责
```

---

## 12. 空间模型：11 个空间

空间是**叙事与组织层**（用于划分团队、目录、权限），与第 6 节的执行引擎不是同一维度，两者不要混用。

| 空间 | 内容 |
| --- | --- |
| Participant Space | 客户 / 供应商 / 员工 / 组织 / 合作伙伴 |
| Data Space | 订单 / 库存 / 采购 / 财务 / 生产数据 |
| Semantic Space | 业务对象 / 字段 / 关系 / 状态 / 事件 |
| Policy Space | 权限 / 审批 / 税务 / 会计 / 业务规则 |
| Compute Space | 公式 / 成本 / MRP / 定价 / 税务 / 统计 |
| Trust Space | 审计 / 签名 / 版本 / 来源 / 操作记录 |
| Intelligence Space | 预测 / 推荐 / 异常检测 / AI Agent |
| Experience Space | 表单 / Dashboard / 工作台 / 移动端 |
| Value Space | Blueprint / Marketplace / License / Plugin / Revenue |
| Compile Space | Blueprint 编译、IR、依赖、冲突检测 |
| License Space | 授权、加密、水印、设备绑定、离线租约 |

最值得形成差异化的部分是：**Semantic + Policy + Compute + Trust + Value**。

---

## 13. Marketplace 与治理

### 13.1 交易对象与定价示例

```text
基础    销售订单原子 $10   /  库存预留原子 $20
模块    汽配采购模块 $399  /  连锁门店库存模块 $599
模板    汽配 ERP $1999     /  食品生产 ERP $3999
方案    汽车零部件 ERP $9999+
```

商品类型：Blueprint、Atomic、Module、Solution、Connector、UI 模板、AI Agent。

### 13.2 认证

```text
功能认证 / 安全认证 / 性能认证 / 合规认证 / 许可证认证
```

### 13.3 交易模式

```text
永久授权 / 订阅 / 按用量 / 按租户 / 按设备 / 收入分成
```

### 13.4 治理

```text
协议委员会 / 兼容性测试 / 版本弃用策略 / 争议处理 / 黑名单 / 安全响应
```

---

## 14. 与 sapbase 现状的对齐与差距

本节是 v3 相对 v1/v2 的核心增量：把蓝图映射到本仓库的真实资产，避免设计与代码脱节。

> 本节回答"**平台能力**缺什么"；技术选型层面的差距（语言、框架、数据、基础设施逐层对照目标技术栈）单独维护在 [TECH_STACK_GAP.md](./TECH_STACK_GAP.md)。

### 14.1 已有资产盘点

| 平台能力 | 仓库资产 | 状态 |
| --- | --- | --- |
| Meta Model / Schema | `speckit/src/core/schema/{types,registry,resolver,validator,adapters}.ts`、`shared-schemas/src/v1/*`、`schemas/*.schema.json` | 可用，需扩展 |
| Delta 生成与验证 | `speckit/src/core/patch/{types,validator,executor,patch-manager,audit-logger,version-control,hot-reload,gateway,hooks}.ts` | **强资产**，是 Space Delta 前身 |
| Form / Collection / Detail Runtime | `speckit/src/components/runtime/{FormRuntime,CollectionRuntime,DetailRuntime,PageRuntime}.tsx` | 可用 |
| 页面模型校验 | `speckit/src/core/page-model/schema-validator.ts` | 可用，校验面偏窄 |
| 权限（RBAC + Scope） | `speckit/src/core/auth/{permission-guard,permission-hooks,auth-hooks}.ts`、`speckit/src/core/store/permission.store.ts` | 可用 |
| 插件体系 | `speckit/src/core/plugins/*`、`backend/src/plugins/*`、`schemas/plugin.schema.json` | 前端插件，无沙箱 |
| **Wasm 原子模块准入** | `wasm-modules/`（闸 0 源码预检 / 闸 1 静态白名单 / 闸 2 双构建器复现 / 闸 5 吊销；Rust no_std 零能力模块 + 入库清单 `build/manifest.json`） | **新增强资产**：Atomic Contract 的实现封装层与相应门禁；宿主侧运行时未接 |
| 模块注册表（≈Registry） | `backend/src/module-registry/{module-registry,module-capability,module-relationship,module-statistics}` | **强资产**，接近模块化 Registry |
| AI 模块定义（≈Space Orchestrator 雏形） | `backend/src/ai-modules/{ai-module,ai-module-definition,ai-module-review,definition-step-prompts,step3-stateflow.schema,step3-normalizer}` | 固定步骤生成，非 Delta 闭环 |
| Workflow Engine | `backend/src/workflows/{transition-engine,workflow-guard-ai,workflow-history,workflow-auto-transition.job,entity-state-updater.registry}`、`openspec/changes/add-workflow-engine` | 较成熟 |
| 审计 | `backend/src/audit-logs/*`、`shared-schemas/src/v1/audit-log.ts` | 有审计，非不可篡改事件溯源 |
| 多租户 | `openspec/changes/migrate-to-saas-architecture`（45/75） | 进行中 |
| 全系统生成与部署 | `openspec/changes/add-full-system-generation-and-deploy` | 进行中，是 Blueprint → 运行的最近路径 |

### 14.2 差距与建议动作

| # | 差距 | 影响 | 建议动作 | 优先级 |
| --- | --- | --- | --- | --- |
| 1 | ~~无 Atomic Contract~~ **已落地（可执行）** | — | `schemas/atomic-contract.schema.json` 冻结 + `backend/src/atomic-registry/` 注册表 + `backend/src/atomic-runtime/` 宿主运行时：真实 Wasm 原子已能经 HTTP 调用、结果可审计、权限 all-of 校验、吊销即拒不回退。剩余：模块对原子的依赖声明（`dependsOnAtomics`） | P0 → 收尾 |
| 2 | 无 Blueprint Compiler 与 IR | 无法把 Schema 编译为可验证执行计划 | 在 `shared-schemas` 定义 Blueprint 包格式，实现最小 Compiler（验证 + 依赖闭包 + IR） | P0 |
| 3 | Patch DSL 命名空间局限于前端 | Delta 无法表达语义/策略/流程 | 扩展 `PatchScope`，落地 `space-delta/v2`，复用现有 validator/executor | P0 |
| 4 | `ai-modules` 是固定步骤 Prompt，无 Validator 闭环 | LLM 输出不可增量验证、不可回滚 | 引入 Delta Validator + Repairer，替换固定步骤生成 | P1 |
| 5 | 无蓝图包（`.erpkg`）与签名 | 无法发行、无法认证 | 先做 zip + `manifest.json` + 签名（加密可后置） | P1 |
| 6 | 无 License 与 Capsule | 无法交易与被授权运行 | License 文件 + 离线校验 + 设备指纹；加密容器第二期 | P1 |
| 7 | Compute Kernel 缺失 | 金额/税/成本计算散落，无法跨模板复用 | 独立 `compute` 模块：表达式求值 + 决策表 + 单位/币种转换 | P1 |
| 8 | Rule Engine 不统一 | 规则散落在 guard 与前端校验 | 统一 rule registry：定义、优先级、冲突检测、可解释性 | P1 |
| 9 | 无事件引擎与不可变审计 | 无事件溯源，审计可被改动 | 事件表 + Outbox + 哈希链；会计引擎前置条件 | P2 |
| 10 | 无 Accounting Engine | 财务域无法平台化 | 会计事件 → 分录规则 → 凭证（只冲销），复用 Rule/Compute | P2 |
| 11 | 插件无 WASM 沙箱 | 第三方扩展不可信 | **宿主运行时已就位**（`backend/src/atomic-runtime/`：零能力沙箱 + Worker 超时 + 输出上限/值域 + 吊销）；仍缺：闸 3 的低熵输出判据、`backend/src/plugins` 的插件沙箱化（插件目前仍是进程内 TS） | P2 |
| 12 | 无 Marketplace 交易面 | 无法形成价值闭环 | 在 `module-registry` 上叠加商品、定价、授权、分成 | P2 |
| 13 | 无 Context Compiler | LLM 上下文不可控、成本不可控 | 依赖图 + 权限过滤 + 预算裁剪，先服务 `ai-modules` | P2 |
| 14 | 无本地/离线运行形态 | 数据主权叙事不成立 | 打包 Production Runtime（无 Jev）+ 本地数据库 + License | P3 |

### 14.3 三条低风险演进路径

```text
路径 A（协议先行）
  在 schemas/ 与 shared-schemas 落地五个协议的 JSON Schema
  → 不改运行时代码，即可对外讨论、评审、冻结

路径 B（Delta 打通）
  Patch DSL → space-delta/v2 → 覆盖 semantic / policy / flow
  → 让 ai-modules 的输出从"整模块生成"变成"增量 Delta + 验证"

路径 C（Blueprint 闭环）
  模块定义 → Blueprint Package → Compiler → Runtime 执行
  → 复用 add-full-system-generation-and-deploy 已有工作
```

三条路径可以并行，但**路径 A 必须先于 B、C 冻结**，否则后续全部返工。

---

## 15. 路线图

### Phase 0：协议冻结

交付物：

```text
docs/ 协议文档 + schemas/ 五个 JSON Schema
1. ERP Meta Model      2. Atomic Contract     3. Blueprint Package
4. Runtime SDK Contract 5. License / Encryption Protocol
```

验收：五个 Schema 可被 `shared-schemas` 引用，且能被现有 `speckit` Schema 校验器加载。

### Phase 1：MVP

```text
语义设计器 / Atomic Engine（最小集）/ Rule Engine / Form Engine /
Local Runtime / 简单 Marketplace / License Server
```

仓库对应：扩展 `speckit` 的 Schema 与 Patch，后端新增 `atomic-registry`、`blueprint` 模块，复用 `module-registry`。

### Phase 2：行业模板

```text
汽配 ERP / 食品生产 ERP / 连锁门店 ERP / 模板认证与 Capsule
```

### Phase 3：市场与许可

```text
Blueprint Capsule / 水印 / 离线授权 / 收入分成 / 插件沙箱
```

### Phase 4：LLM 编排

```text
Space Orchestrator / Intent Parser / Space Router / Task Graph Planner /
Delta Generator / Delta Validator / Delta Repairer / Context Compiler
```

仓库对应：改造 `backend/src/ai-modules`，从固定步骤 Prompt 升级为 Delta 闭环。

### Phase 5：本地设计与调试

```text
Local Design Studio / Developer Debug Kit / Design License / Debug License / 本地 Jev Adapter
```

### Phase 6：智能与生态

```text
AI Agent / 预测与推荐 / 异常检测 / 行业协议联盟
```

| 阶段 | 与现有 OpenSpec change 的关系 |
| --- | --- |
| Phase 0 | 新增 change：`define-platform-protocols` |
| Phase 1 | 依赖 `migrate-to-saas-architecture`、`refactor-workflow-to-ddd` |
| Phase 2 | 依赖 `create-crm-module`（作为第一个真实行业样板） |
| Phase 3 | 新增 change：`add-blueprint-license-and-capsule` |
| Phase 4 | 演进 `ai-module-management`、`add-ai-assisted-module-definition` |
| Phase 5 | 复用 `add-full-system-generation-and-deploy` |
| Phase 6 | 依赖 `add-plugin-system` 与 Intelligence Space |

---

## 16. 关键风险与对策

| 风险 | 对策 |
| --- | --- |
| 协议膨胀 | 核心协议冻结，扩展通过 Profile；元模型分"必需/渐进" |
| 性能问题 | Native/WASM、缓存、查询优化 |
| 离线授权被绕过 | 签名许可证 + 宽限期 + 硬件绑定 + 撤销列表 |
| 客户修改冲突 | 分层 Blueprint + Delta 合并策略 |
| 核心 IP 泄露 | 加密 + WASM + 水印 + 法律 |
| 市场冷启动 | 官方模板 + 行业伙伴 + 认证激励 |
| 合规风险 | 审计、税务、数据主权、期间关闭 |
| AI 失控 | Policy 约束 + 审批 + 审计 + Agent Host 权限收口 |
| LLM 幻觉 | Space Delta + Validator + Compiler |
| 上下文爆炸 | Context Compiler + 预算管理 |
| 本地设计绕过许可 | Design License ≠ Runtime License |
| 运行时不确定性 | 生产 Runtime 不含 Jev |
| 设计与代码脱节 | 第 14 节对齐表随协议变更同步维护 |

---

## 17. 结论

完整形态：

```text
用户需求
   ↓
Jev-like LLM
   ↓
Space Delta
   ↓
Context Compiler / Validator / Compiler
   ↓
Blueprint Package
   ↓
Local Runtime（不含 Jev）
   ↓
Customer ERP
```

十条原则：

1. Space Model 是类型系统，不是提示词。
2. Jev 输出 Space Delta，不输出自由文本。
3. 小步生成，小步验证，失败回环。
4. 符号验证器保证正确性，LLM 只保证速度和结构。
5. 设计时编排，运行时执行，许可控制。
6. 客户拥有 Blueprint，平台控制 Runtime。
7. 行业模板可交易，核心实现不可导出。
8. 生产运行时不含 Jev；本地设计与调试可含 Jev。
9. Design License 与 Runtime License 必须分离。
10. Context Compiler 决定"实际塞什么"，大模型决定"要查什么"。

平台同时解决四个问题：

1. 平台方保护核心代码。
2. 客户拥有业务定义和流程资产。
3. 行业专家可以交易模板、模块和原子能力。
4. 客户可以在本地运行，数据主权保留在客户手中。

最终，ERP 开发从"不断写业务代码"转变为：

```text
语义建模 + 原子组合 + 规则配置 + Blueprint 编译 + Runtime 执行 + License 授权 + Marketplace 交易
```

---

## 附录 A：协议骨架索引

| 协议 | 建议文件 | 内容 |
| --- | --- | --- |
| Meta Model | `schemas/meta-model.schema.json` | 语义对象、字段、关系、状态、事件、能力、版本 |
| Atomic Contract | `schemas/atomic.schema.json` | 输入输出、前后置条件、副作用、幂等、权限、错误、实现封装 |
| Blueprint Package | `schemas/blueprint.schema.json` | manifest、分层、依赖、模块绑定 |
| Space Delta | `schemas/space-delta.schema.json` | 操作、路径、安全等级、理由、验证提示 |
| Runtime SDK | `docs/protocols/runtime-contract.md` | Loader → Verifier → Compiler → Runtime |
| License | `schemas/license.schema.json` | License 字段、离线策略、绑定项 |

## 附录 B：术语表

| 术语 | 含义 |
| --- | --- |
| Blueprint | 可交易、可组合、可版本化的业务定义集合 |
| Atomic | ERP 的最小业务能力单元，接口可见、实现不可见 |
| Space Delta | LLM 输出的结构化增量修改语言 |
| Capsule | 加密 + 授权边界的模板容器 |
| IR | Blueprint 编译后的中间表示 |
| Context Envelope | 送给 LLM 的最小上下文包 |
| Agent Host | 运行时可选 AI 模块，只能通过原子契约行动 |
| Production Runtime | 不含 Jev 的确定性执行运行时 |

## 附录 C：待决策清单

```text
1. ~~原子实现的起点：先用 TypeScript 跑通契约，还是直接 WASM 化？~~
   → 两条腿同时走：契约与业务原子先以 TypeScript 跑通（快），
   对外的、需要交付不可读实现的原子走 `wasm-modules/` 通道（见该包 README）。
   待定的是**第一类有哪些原子必须走后者**。
2. 会计引擎的边界：自研一级引擎，还是先以 Blueprint + 连接器对接外部财务？
3. 协议是否对外公开：社区标准（吸引生态） vs 平台私有（控制力更强）？
4. License Server：自建，还是接入第三方许可服务？
5. 多租户与本地运行的关系：SaaS 租户能否导出为本地 Runtime？导出即失去哪些能力？
6. 命名统一：对外使用 "Space" 还是 "Module"？（现仓库以 module 为主，需统一叙事）
7. 第一个行业样板：CRM（已在建）还是汽配？
8. `space-delta` 与现有 Patch DSL 的版本策略：直接演进（v2）还是并行双轨后再合并？
```
