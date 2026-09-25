# 项目元语（Meta Language）

> 版本：1.0
> 日期：2026-09-24
> 定位：本文件是 sapbase 的**基础定义层** —— 元模型、协议原语、执行原语、工程约定与术语真源。
> 与设计文档的分工：设计文档回答"**要做什么**"，本文件回答"**用什么词、按什么不变量做、真源在哪**"。
> 任何新增设计、代码或文档，都应先在本文件的词汇与不变量里找到落点；找不到，说明元语需要扩展（走变更记录）。

---

## 0. 怎么用这份文件

| 角色 | 用法 |
| --- | --- |
| 写代码的人 | 命名与结构以第 6 节术语表的"代码标识符"为准，不要另造同义词 |
| 写设计/提案的人 | 引用第 1–3 节的原语，不要重新定义；新概念先扩展第 6 节 |
| 评审者 | 用第 4 节的不变量作为验收清单 |
| AI 助手 | 本文件 + `openspec/project.md` 是进入项目时必读的元上下文 |

---

## 1. 元模型：Ω

业务系统的第一性定义。**四个必需维度 + 六个渐进维度**，是所有语义对象的共同骨架：

$$
\Omega=\langle E,O,R,\Phi,\Sigma,\Lambda,\Gamma,\Tau,V,C\rangle
$$

| 符号 | 含义 | 必需性 | 仓库落点 |
| --- | --- | --- | --- |
| $E$ | Entity 业务实体 | 必需 | `speckit/src/core/schema/types.ts` 的 `ObjectSchema` |
| $O$ | Object 实体实例 | 必需 | 后端实体（`backend/src/**/*.entity.ts`） |
| $R$ | Relation 对象关系 | 必需 | `ObjectSchema.relations` |
| $\Phi$ | Constraint / Policy / Behavior | 必需 | `FieldDefinition.validation`、`backend/src/permissions`、规则（待统一） |
| $\Sigma$ | State 状态机 | 渐进 | `backend/src/workflows/`、Patch DSL 的 `state` scope |
| $\Lambda$ | Event 领域事件 | 渐进 | `backend/src/common/events/` |
| $\Gamma$ | Capability 能力 | 渐进 | `backend/src/module-registry/module-capability.entity.ts`、原子契约（提案中） |
| $\Tau$ | Time 生效时间与生命周期 | 渐进 | 各实体的 `createdAt/updatedAt`；生命周期语义待补 |
| $V$ | Version 版本与迁移 | 渐进 | `ObjectSchema.version`、`backend/src/migrations/` |
| $C$ | Context 租户/组织/权限上下文 | 渐进 | `TenantAwareEntity` + `DataIsolationInterceptor` |

判据：**元模型是类型系统，不是提示词。** 任何"约定"必须能落到上表的某个维度或第 2、3 节的原语上，否则它不是元语，只是偏好。

---

## 2. 协议原语（五个核心协议）

这五个协议是平台的地基。**未冻结的协议不做实现**（见不变量 10）。

| # | 协议 | 目的 | 状态 | 落点 |
| --- | --- | --- | --- | --- |
| 1 | ERP Meta Model | 业务对象、字段、关系、状态、事件、能力、上下文、版本 | 🟡 部分 | 前端 Schema + `shared-schemas`；JSON Schema 权威源待建 |
| 2 | Atomic Contract | 原子能力的输入输出、前后置条件、副作用、幂等、权限、错误、实现封装 | 📋 提案中 | `openspec/changes/add-wasm-atomic-runtime/`；实现侧参照 `wasm-modules/build/manifest.json` |
| 3 | Blueprint Package | 完整 ERP 的语义/流程/规则/表单/BOM/审批/记账/分层/签名 | ❌ 未开始 | 设计见 v3 §5.3、§7 |
| 4 | Runtime SDK Contract | Blueprint 如何被本地 Runtime 加载、验证、编译、执行 | 🟡 部分 | 执行链已有实际实现（见 3.2 与 3.3），契约文本待固化 |
| 5 | License / Encryption Protocol | 模块如何加密、授权、绑定客户、防二次销售 | ❌ 未开始 | 设计见 v3 §11 |

---

## 3. 执行原语

### 3.1 Atomic Contract

**原子**是 ERP 的最小业务能力；**契约**描述它的接口与约束，与实现解耦。

- 类型：`calculation` / `query`（v1 允许）；`command` / `effect`（涉及事务与补偿，另立变更）
- 契约要素：`atomicType`、`version`、`inputSchema`、`outputSchema`、`permissions`、`errors`、`idempotency`
- 实现可换：同一契约可有 TypeScript 实现（平台自研，跑在内核）与 Wasm 实现（可交付，跑在沙箱）

### 3.2 Atomic Module 与 ABI v1

Wasm 原子模块的运行约定（已实现，见 [`wasm-modules/README.md`](../wasm-modules/README.md)）：

```text
run(in_off: i32, n: i32, out_off: i32) -> i32      // 0 = 成功
输入 @in_off : [on_hand: i32[n]] [reserved: i32[n]] [in_transit: i32[n]]
输出 @out_off: [available: i32[n]] [total_available: i32]
```

- 导出：`run`（函数）+ `abi_version`（函数或常量全局）+ 工具链全局 `__heap_base` / `__data_end`
- 导入：**恰好一个** `env.memory`，必须有上限
- 模块**不接收标识**（物料号、单据号、租户 ID），宿主只写整数列投影，调用后按下标回填
- **执行引擎**：Rust sidecar（`crates/wasm-host`，Wasmtime 48）提供 fuel 指令预算、epoch 中断与进程外隔离；
  V8 实现保留为对拍引擎与显式回退路径（`ATOMIC_ENGINE=v8`；回退需 `ATOMIC_ENGINE_FALLBACK` 且审计留痕）

### 3.3 准入闸（0–5）

| 闸 | 位置 | 挡什么 | 状态 |
| --- | --- | --- | --- |
| 0 源码预检 | 编译**之前** | `build.rs` / proc-macro / `.cargo/config` / 非空依赖 / npm 生命周期 | ✅ |
| 1 静态白名单 | 不运行就挡 | 非白名单导入、start 段、共享内存、GC、表、自定义内存、memory64、未授权导出 | ✅ |
| 2 复现构建 | 两个独立构建器 | 哈希不一致、"只交 `.wasm`"、夹带预构建 `target/` | ✅ |
| 3 输出管控 | 运行期 | 通过输出通道夹带数据 | ❌ 未移植（判据需按 ERP 语境重设计） |
| 4 影子发布 | 发布流程 | 未经影子验证直接上生产 | ❌ 未移植（属控制面编排） |
| 5 吊销 | 执行前 | 已吊销模块继续执行、旧名单回放 | ✅（判定逻辑） |

附：准入层级 **Tier A**（平台自研）/ **Tier B**（第三方交源码、平台复现构建 + 审查），**不设 Tier C** —— 不透明二进制结构性地无法入册。

### 3.4 分层可见性

| 层 | 客户可见 | 可改 | 可导出 |
| --- | --- | --- | --- |
| Public（语义、表单、基础流程） | 是 | 是 | 是 |
| Config（阈值、字段映射、参数） | 是 | 是 | 部分 |
| Protected（核心规则、专有算法、特殊原子组合） | 否 | 否 | 否 |
| Kernel（Native/Wasm 执行内核） | 否 | 否 | 否 |

### 3.5 Capsule

- **Blueprint Capsule**：加密容器 + 授权边界的模板（可见层明文，Protected 层加密）
- **Capability Capsule**：进一步与 License、Key、Runtime、设备/租户绑定
- 核心等式：`模板文件 ≠ 可运行模板`；`文件 + License + Key + Runtime + 绑定 = 可运行`

### 3.6 增量协议（Delta）

LLM 的输出语言，是结构化增量而非自由文本。**它修改的对象是第 1 节元模型所描述的语义对象集合**，
并且是设计时产物写入该集合的唯一合法方式：

```json
{ "protocol": "space-delta/v1", "base_version": "rev-123",
  "operations": [ { "op": "add", "path": "/semantic/entities/-", "value": {} },
                  { "op": "link", "from": "...", "to": "...", "type": "belongsTo" } ] }
```

仓库既有 **Patch DSL**（`speckit/src/core/patch/`：5 类 scope、5 种操作、L1–L3 安全级）是它的前身，
演进路径为 `space-delta/v2`（扩展命名空间 + `link`/`unlink`），**不另起一套**。

### 3.7 Context Compiler 与决策分层

```text
L0 确定性层   平台预定义：Schema、路由表、预算策略、权限策略
L1 轻量模型层 意图分类、实体链接、候选排序、歧义消解
L2 大模型层   任务规划、复杂意图解析、Delta 修复
L3 验证层     Schema 验证、引用完整性、权限验证、可执行性验证
```

`Context Envelope` 由 Context Compiler 产出，是送给 LLM 的最小上下文包。

---

## 4. 不变量（Invariants）

评审与实现时的硬性判据。与第 1–3 节冲突时，以本节为准。

1. **元模型是类型系统，不是提示词。**
2. **大模型决定"要查什么"，Context Compiler 决定"实际塞什么"，Validator 决定"能不能用"。**
3. **判定权在平台/宿主，不在提交方**：哈希一律重算，不采信自述值。
4. **fail-closed 且不回退**：任一闸不过即拒，**不得**静默回退到内置实现。
5. **复现构建**：同源码 + 同锁定工具链 = 同字节 = 同哈希；哈希变即视为"换了一份代码"，必须重走准入。
6. **Wasm 源码零依赖**：依赖可携带 `build.rs` / proc-macro，会把审查面扩散到未审代码。
7. **零能力执行**：模块只有一块宿主注入、有上限的内存；无网络、文件、进程、系统调用。
8. **生产 Runtime 不含 Jev**：设计时生成与运行时执行分离；Design License ≠ Runtime License。
9. **客户拥有 Blueprint，平台控制 Runtime**：业务定义可迁移，核心实现不可导出。
10. **协议先行**：五个核心协议未冻结，不做大规模实现。
11. **不假设客户无法逆向**：目标是"拿不到可移植的核心实现"，而非"绝对不可逆"。
12. **一份判定逻辑只写一次**：准入侧与执行侧共享同一实现（两份必然漂移）。
13. **设计时产物一律表达为增量（Delta）**：不得旁路改写语义对象集合，
    也不得让 LLM 直接产出最终结构。

---

## 5. 工程元语

### 5.1 工作区与包管理器

```text
包管理器：npm（唯一锁文件 = 根 package-lock.json）
workspaces：shared-schemas / speckit / backend / wasm-modules
约定详见：docs/PACKAGE_MANAGER.md
```

### 5.2 文档真源（哪份文档负责什么）

项目已有成体系的结构化描述文档。**新增内容先往这些文件里放，不要另建新文件**：

| 主题 | 真源 | 备注 |
| --- | --- | --- |
| 基础定义（元模型、原语、不变量、术语） | **本文件** | 跨领域的定义层 |
| 平台总体设计（要做什么） | [`ERP_Space_Platform_设计方案_v3.md`](./ERP_Space_Platform_设计方案_v3.md) | 含路线图与差距 |
| 前端 Schema 驱动系统 | [`speckit/docs/schema-system.md`](../speckit/docs/schema-system.md) | 页面/表单/视图生成 |
| 增量修改机制（Patch DSL） | [`speckit/docs/patch-dsl.md`](../speckit/docs/patch-dsl.md) | 未来 Delta 协议的载体 |
| 前端组件模式（Runtime-First） | [`speckit/docs/component-patterns.md`](../speckit/docs/component-patterns.md) | — |
| 插件体系 | [`speckit/docs/plugins.md`](../speckit/docs/plugins.md) | UI / Integration / Theme |
| 导航与 RBAC | [`speckit/docs/nav-rbac.md`](../speckit/docs/nav-rbac.md) | — |
| 主题体系 | [`speckit/docs/themes.md`](../speckit/docs/themes.md) | — |
| 前端集成指南 | [`speckit/docs/frontend-integration-guide.md`](../speckit/docs/frontend-integration-guide.md) | — |
| CRM 模块 | [`speckit/docs/crm-module.md`](../speckit/docs/crm-module.md)、[`crm-integration.md`](../speckit/docs/crm-integration.md) | 第一个业务模块样板 |
| Clerk 配置 | [`speckit/docs/clerk_setup.md`](../speckit/docs/clerk_setup.md) | ⚠️ 模板残留：`@clerk` 依赖源码未使用，待清理 |
| 后端 Base Object 模式 | [`backend/docs/architecture/base-object-pattern.md`](../backend/docs/architecture/base-object-pattern.md) | 实体基类约定 |
| AI 模块的数据与安全 | [`backend/docs/ai-modules-database-and-security.md`](../backend/docs/ai-modules-database-and-security.md) | — |
| 后端开发指南 | [`backend/docs/developer-guide.md`](../backend/docs/developer-guide.md) | — |
| 工作流引擎 | [`backend/src/workflows/README.md`](../backend/src/workflows/README.md) | 代码就近文档 |
| 前端运行时总体设计（历史） | [`通用_erp_前端运行时_speckit_v_1 (1).md`](<../通用_erp_前端运行时_speckit_v_1 (1).md>) | 根目录；理念来源 |
| 当前 vs 目标技术栈差距 | [`TECH_STACK_GAP.md`](./TECH_STACK_GAP.md) | — |
| 前端依赖实际版本 | [`TECH_STACK_v2.md`](./TECH_STACK_v2.md) | `speckit/README.md` 是上游模板原文，不可作依据 |
| 包管理器与依赖安装 | [`PACKAGE_MANAGER.md`](./PACKAGE_MANAGER.md) | — |
| Wasm 原子模块与准入门禁 | [`wasm-modules/README.md`](../wasm-modules/README.md) | — |
| Wasm 执行引擎（sidecar） | [`crates/wasm-host/`](../crates/wasm-host/) + openspec change `add-wasmtime-host` | V8 实现见 `backend/src/atomic-runtime/wasm-instance-pool.ts` |
| 变更提案与任务清单 | `openspec/changes/<change-id>/` | 按 OpenSpec 流程 |
| Git 工作流 | [`openspec/GIT_WORKFLOW.md`](../openspec/GIT_WORKFLOW.md) | — |
| 项目上下文（AI 助手入口） | [`openspec/project.md`](../openspec/project.md) | — |

**入口分层**（避免在 `AGENTS.md` 里维护扁平清单）：

```text
AGENTS.md（仓库级：元语 + 3 条硬规则）
   ↓
docs/META_LANGUAGE.md（定义层） + openspec/project.md（上下文） + openspec/AGENTS.md（流程）
   ↓
本表（文档真源）→ 各子系统的结构化文档

子目录另设作用域入口：speckit/AGENTS.md、backend/AGENTS.md（各自索引本目录 docs/）
```

### 5.3 变更流程

新能力 / 破坏性变更 / 架构调整 → **先立 OpenSpec change proposal**（`openspec/AGENTS.md`），
批准后再实现；实现完成后归档到 `openspec/changes/archive/`。

---

## 6. 术语表

| 中文 | English | 代码标识符 / 落点 | 状态 |
| --- | --- | --- | --- |
| 元模型 | Meta Model | `Ω`；`ObjectSchema` | 🟡 部分 |
| 语义对象 | Semantic Object | `ObjectSchema` | ✅ |
| 原子契约 | Atomic Contract | `atomicType`、`AtomicContract`（提案） | 📋 |
| 原子模块 | Atomic Module | `wasm-modules/modules/*` | ✅ |
| 执行引擎 | Wasm Engine | `WasmEngine` 接口；`crates/wasm-host`（Wasmtime）/ `WasmInstancePool`（V8） | ✅ |
| 原子实现 | Atomic Implementation | `AtomicImplementation.moduleSha256`（提案） | 📋 |
| 模块清单 | Module Manifest | `wasm-modules/build/manifest.json` | ✅ |
| 准入层级 | Admission Tier | `AdmissionTier = "A" \| "B"` | ✅ |
| 准入状态机 | Admission Status | `submitted → built → tested → shadow → canary → active` | ✅ |
| 审查背书 | Review Attestation | `ReviewAttestation` | ✅ |
| 复现构建 | Reproducible Build | `reproducibleBuildRef` | ✅ |
| 静态闸 | Static Gate | `staticGate()`、`StaticGateError` | ✅ |
| 源码闸 | Source Gate | `sourceGate()`、`SourceGateError` | ✅ |
| 吊销名单 | Revocation List | `RevocationList`、`assertNotRevoked()` | ✅ |
| 业务蓝图 | Blueprint | — | 📋 |
| 蓝图包 | Blueprint Package | `blueprint.erpkg` | ❌ |
| 能力胶囊 | Capability Capsule | — | ❌ |
| 增量协议 | Delta | `space-delta/v1`（协议标识）；现有 `PatchScope`/`PatchOperation` | 🟡 |
| 上下文编译器 | Context Compiler | `ContextEnvelope` | ❌ |
| 设计时模型 | Jev-like LLM | `DeltaGenerator`/`DeltaRepairer` | ❌ |
| 运行时 AI | Agent Host | — | ❌ |
| 模块注册表 | Module Registry | `backend/src/module-registry/` | ✅ |

---

## 7. 本次会话沉淀索引

| 会话产物 | 在元语里承载什么 |
| --- | --- |
| [`ERP_Space_Platform_设计方案_v3.md`](./ERP_Space_Platform_设计方案_v3.md) | 第 1–3 节原语的展开与出处（v1+v2 融合、冲突消解、路线图） |
| [`TECH_STACK_GAP.md`](./TECH_STACK_GAP.md) | 第 2 节各协议"状态"列的判定依据；Rust 触发条件 |
| [`TECH_STACK_v2.md`](./TECH_STACK_v2.md) | 前端维度的实际事实（纠正了上游模板残留） |
| [`wasm-modules/`](../wasm-modules/README.md) | 第 3.2、3.3 节的实现（ABI v1 + 闸 0/1/2/5） |
| [`openspec/changes/add-wasm-atomic-runtime/`](../openspec/changes/add-wasm-atomic-runtime/proposal.md) | 第 2 节协议 2/4 的落地提案 |
| [`PACKAGE_MANAGER.md`](./PACKAGE_MANAGER.md) | 第 5.1 节工程元语 |

---

## 8. 变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| 1.2 | 2026-09-24 | 补入口分层：新增 `speckit/AGENTS.md`、`backend/AGENTS.md` 两个作用域入口；`openspec/AGENTS.md` 的 Context Checklist 与 Stage 1 步骤纳入本文件；§5.2 补 Clerk 文档行并标注为待清理残留 |
| 1.1 | 2026-09-24 | 按反馈修正：移除上一版加入的 space 相关表述（本文件只做结构化系统描述，不引入新概念词）；§5.2 文档真源表改为**索引项目已有的结构化文档**（speckit/docs、backend/docs、openspec），明确"新增内容先放入既有文件，不另建新文件" |
| 1.0 | 2026-09-24 | 首次建立：从本次会话（设计 v3、技术栈差距、Wasm 原子模块、变更提案、包管理器收敛）提炼元模型、协议与执行原语、不变量、术语表与文档真源 |
