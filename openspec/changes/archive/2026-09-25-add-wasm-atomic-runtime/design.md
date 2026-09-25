# Wasm Atomic Runtime Design

## 架构总览

```text
                 构建侧（已存在）
  wasm-modules/  ── 闸 0/1/2/5 ──►  build/*.wasm + manifest.json
                                            │
                                            │ ① 导入（重算哈希，不采信清单）
                                            ▼
  backend/src/atomic-registry/  ──  AtomicContract（契约 + 实现绑定）
                                            │
                                            │ ② 执行请求（原子类型 + 版本 + 投影输入）
                                            ▼
  backend/src/atomic-runtime/   ──  Loader / Verifier / Executor / Limits / Audit
        │                                   │
        │ ③ 复用 wasm-modules/dist 的判定   │ ④ 注入宿主内存 → 调 run → 读回输出
        ▼                                   ▼
  static-gate + revocation            零能力 Wasm 实例（V8）
```

关键点：**准入判定与执行判定是同一份代码**（`@speckit/wasm-modules` 的
`staticGate` / `assertNotRevoked`），不做两份实现。两份实现漂移的那一刻，准入闸就形同虚设。

## 运行时选型

| 方案 | 优势 | 代价 | 结论 |
|---|---|---|---|
| **Node 内置 WebAssembly（V8）** | 零新增依赖；与 NestJS 同进程；已在本仓库验证（`wasm-modules` 测试里真实实例化并调用过 `run`） | 无 fuel 计费；无法限制指令数；超时只能在宿主侧按墙钟掐（需 Worker 隔离才掐得干净） | **v1 采用** |
| Wasmtime（Rust 嵌入 / sidecar） | fuel 计费、epoch 中断、WASI 精细控制；目标技术栈的推荐项 | 引入第二个运行时与进程模型；NestJS 侧需 IPC 或 napi 绑定；运维面变大 | Phase 4 再评估 |
| WasmEdge / Extism | AI 推理、插件框架能力好 | 同上，且生态更偏边缘 | 暂不采用 |

v1 用三件事替代 fuel 计费：

1. **静态闸**（已有）：模块必须导入宿主内存且声明上限（当前 2 页 / 1024 页）、无表、无 tag、
   无共享内存 —— 结构上堵死自增长内存与间接调用面。
2. **墙钟超时**：在 Worker 线程里执行，超时即终止线程（同进程同步调用掐不断死循环，
   这是 v1 必须用 Worker 的原因）。
3. **输出上限**：调用前后校验输出区长度，超过契约声明即拒并记审计。

> 诚实标注：v1 **不能**阻止"计算量大但没有内存增长"的原子占用 CPU。
> 因此 v1 只接**平台自研**（Tier A）与已人工审查的 Tier B 计算型原子，
> 不接受未经审查的第三方原子进入高并发路径。

## 数据模型

```text
AtomicContract            （原子契约：能力定义，与实现解耦）
├── id, organizationId（null = 平台内置）
├── atomicType            例：available-inventory
├── version               语义化版本
├── kind                  calculation | query（v1 只允许这两类）
├── inputSchema           JSONB：输入投影字段与类型
├── outputSchema          JSONB：输出字段、值域、字节上限
├── permissions           string[]：所需权限点
├── errors                string[]：契约错误码
├── idempotency           none | requestId
└── status                draft | active | deprecated
```

```text
AtomicImplementation      （实现绑定：一个原子可有多个实现）
├── id, atomicContractId
├── kind                  typescript | wasm
├── moduleSha256          wasm 实现必填
├── abiVersion            1
├── tier                  A | B
├── review                JSONB：审查背书（reviewer / reviewedAt / reproducibleBuildRef / confidential）
├── sourceGate / staticGate  准入闸报告（审计留痕）
├── status                submitted | built | tested | active | rejected | revoked
└── createdAt, updatedAt
```

```text
AtomicModuleManifest      （导入台账：哪份清单被导入过）
├── id, file, sha256, atomicType, tier
├── importedAt, importedBy
└── manifestSnapshot      JSONB（原始清单行，便于追溯）
```

`AtomicImplementation.status` 直接复用 `wasm-modules` 的准入状态机
（`canPromote` / `isRunnableStatus`），不另造一套状态。

## 执行流程

```text
1. 收到调用（atomicType, version, 输入）
   ↓
2. 解析契约：AtomicContract + 选定的 AtomicImplementation
   ↓
3. 执行前检查（任一不过即拒，不回退）
   · 契约存在且 status = active
   · 实现 status ∈ {shadow, canary, active}
   · 未命中吊销名单（assertNotRevoked）
   · 调用方拥有契约声明的 permissions
   · 输入通过 inputSchema 校验
   ↓
4. 字节校验：对模块字节重算 SHA-256 == 实现绑定的 moduleSha256
   ↓
5. 静态闸：staticGate(bytes)（结果按 sha256 缓存）
   ↓
6. 准备宿主内存 Memory({ initial: 2, maximum: 1024 })
   写输入投影（整数列），预留输出区
   ↓
7. Worker 线程内 new WebAssembly.Instance + 调用 run(inOff, n, outOff)
   墙钟超时即终止 Worker
   ↓
8. 读回输出 → 校验输出上限与值域 → 按契约组装结果
   ↓
9. 写审计（atomicType / sha256 / 输入输出摘要 / 耗时 / 调用方）
   ↓
10. 返回结果（失败时返回契约错误码，绝不回退到内置实现）
```

## 与现有模块的关系

```text
module-registry（已有）        —— 模块、能力、关系、统计
        │  模块声明 dependsOnAtomics: ["available-inventory@^1.0"]
        ▼
atomic-registry（本次新增）    —— 原子契约与实现
        │
        ▼
atomic-runtime（本次新增）     —— 加载与执行
```

即：**模块是业务能力的组合，原子是最小执行单元**。一个模块可以只用 TS 原子（现状），
也可以绑定 Wasm 原子（本次新增）。

## 输入投影：为什么原子拿不到业务数据

Wasm 原子只接收**整数列投影**，标识类字段（物料号、单据号、租户 ID）不进入模块：

```text
宿主侧：  { material: "SKU001", onHand: 10, reserved: 4, inTransit: 1 }
             ↓ 投影（按下标）
模块侧：  输入 = [10] [4] [1]        ← 只有数字，没有 "SKU001"
             ↓ run()
模块侧：  输出 = [7]
宿主侧：  { material: "SKU001", available: 7 }   ← 宿主按下标回填
```

这条规则既是防外泄的机制（模块无法通过输出夹带它从未见过的标识），
也让模块的实现与业务数据模型解耦 —— 换数据模型不影响已入册模块。

## 安全模型边界

| 威胁 | v1 是否覆盖 | 机制 |
|---|---|---|
| 模块读取宿主文件 / 网络 | ✅ | 零导入 + 静态闸（只允许 `env.memory`） |
| 模块偷跑代码（实例化即执行） | ✅ | 拒 start 段 |
| 模块无限增长内存 | ✅ | 内存由宿主注入且声明上限 |
| 模块间接调用（表） | ✅ | 拒表段 |
| 模块死循环 | 🟡 | 墙钟超时 + Worker 终止（非指令级） |
| 模块通过输出夹带数据 | 🟡 | 输出上限 + 值域校验；低熵判据（闸 3）未移植 |
| 构建期被投毒（build.rs） | ✅ | 闸 0 + 隔离构建器 |
| 不可复现构建 | ✅ | 双构建器对拍 |
| 交付后模块被替换 | ✅ | 执行前重算字节哈希 |
| 源码泄漏平台核心算法 | ❌ | 不在本次范围（需签名 + 加密容器，v3 §11） |

## 已知风险与对策

| 风险 | 对策 |
|---|---|
| V8 无指令级限流，恶意计算型原子可耗 CPU | v1 限制为平台自研 / 已审查原子；Phase 4 评估 Wasmtime |
| Worker 每次执行都新建实例，吞吐受损 | 实例缓存（按 sha256）+ Worker 池；先测后调优 |
| 原子与模块的依赖漂移（模块引用了已吊销原子） | 模块发布时校验依赖原子状态；运行时再查一次吊销名单 |
| 契约版本升级破坏已发布模块 | 契约版本化 + 依赖用语义化范围；破坏性变更须新版本共存 |
| 把写操作误接进沙箱原子 | v1 契约层面就不允许 Command / Effect 类型 |

## 实施顺序

```text
Phase 1  契约与导入：atomic-registry 实体 + 迁移 + 清单导入（含字节重算）
Phase 2  运行时：Loader / 静态闸复用 / Worker 执行 / 输出校验 / 审计
Phase 3  接入：REST API + 权限校验 + module-registry 依赖关联 + 前端调用示例
Phase 4  硬化：吊销名单同步、实例缓存与 Worker 池、Wasmtime 评估
```

## Wasmtime 评估（M5 交付，2026-09-25）

> ⚠️ **已被取代（2026-09-25）**：本节结论"v1 不引入 Wasmtime"是当时的阶段性取舍；
> 随后用户质疑并核实了嵌入成本后，结论**改为采用 Wasmtime**，
> 见 openspec change [`add-wasmtime-host`](../../add-wasmtime-host/proposal.md)。
> 本节保留作为决策演进记录（含当时的证据与触发条件），请以新 change 为准。

**问题**：v1 用 Node 内置 WebAssembly（V8）跑原子，靠"静态闸 + 墙钟超时 + 输出上限"约束。
它缺什么、值不值得换 Wasmtime？

**Wasmtime 能多给的**：

| 能力 | 说明 | V8 能做到吗 |
| --- | --- | --- |
| **fuel 计费** | 按指令数计费，可设上限 —— 计算型原子无论内存是否增长都能被精确掐断 | ❌ V8 无公开 API |
| **epoch 中断** | 由宿主按时间片中断执行，不依赖杀进程 | ❌ 只能杀 Worker |
| WASI 精细化 | 精细的文件/网络能力授予 | 不需要（我们的模块是零能力） |
| 可嵌入 Rust | 与未来 Rust 内核同栈 | 不适用（宿主是 NestJS） |

**本仓库实测基线**（`scripts/benchmark-atomic-runtime.ts`，2026-09-25）：
小负载 2.1ms / 中负载 0.7ms / 大负载（2 万行）6.3ms，吞吐 159–1364/s。
也就是说：**当前瓶颈不是执行引擎，而是固定开销**，而固定开销已经用 Worker 复用压掉了。

**一条决定性事实（2026-09-25 核实）**：**Node 生态没有可用的 Wasmtime 绑定。**

```text
@bytecodealliance/wasmtime        → 不存在（官方 scope 无此包）
wasmtime (npm)                    → 0.0.2，最后发布 2023-05-02，周下载 ~100
@as-harness/wasmtime (社区 napi)  → 0.6.0，周下载 4
@bytecodealliance/jco             → 1.35.0（活跃）但把组件编译成 JS 跑在 V8 上，拿不到 fuel
```

要用 Wasmtime 必须**自建**：要么 Rust sidecar + 自定义 IPC 协议，要么自己维护 napi 绑定。
这不是"换个依赖"，而是多一个进程模型、一套协议、一套运维面。

**结论分两层，别混为一谈**

1. **引擎能力**：Wasmtime 确实更强，且强的正是"跑不可信代码"的核心 ——
   fuel（指令预算）、epoch（按时间片精确中断）、进程外与崩溃域隔离。这三点上 V8 是真缺。
2. **当前取舍**：引擎用 V8，原因是**嵌入成本**（无绑定 → 自建 sidecar）叠加
   **当前威胁模型**（只接 Tier A 与已审查的 Tier B）。
   这是**阶段性取舍，不是"Wasmtime 不如 V8"的技术判断**。

**触发条件（满足任一即迁移，而不是继续 defer）**

```text
1. 出现"不可信第三方（Tier B）原子进入高并发路径"的需求
   —— 那时"杀 Worker"的代价（一次调用丢掉、Worker 重建）会变成可感知的抖动，需要 epoch 中断
2. 出现"必须限制单次调用的指令预算"的合规或计费要求
   —— 墙钟超时给不出指令数，而 fuel 可以
3. 宿主侧改用 Rust 内核（当前是 NestJS + V8）
```

**迁移路径（刻意做成有界改动）**

引擎被隔离在 `WasmInstancePool` 这个接缝之后，切换**不动**契约、ABI、闸、审计与权限：

```text
不动：schemas/atomic-*.json、ABI v1、闸 0/1/2/5、atomic-registry、审计、权限、REST 接口
改：  WasmInstancePool（V8 Worker） → WasmtimeSidecarClient
新增：Rust sidecar（crates/wasm-host：Wasmtime + fuel/epoch）+ 行分隔 JSON 协议
      协议需覆盖：加载(sha256, bytes) / 调用(inOff, rows, outOff, len, fuel, deadline) / 错误回传
验证：直接复用现有 e2e 与单元测试（ABI 与错误码不变 → 测试即回归网）
```

代价清单（迁移时才付）：sidecar 的多平台构建与打包、IPC 序列化、
进程生命周期与健康检查、崩溃恢复策略、fuel 预算的配置与计量口径。

> 诚实标注：v1 仍然**不能**阻止"计算量大但内存不涨"的原子占用 CPU —— 只能按墙钟掐断整次调用。
> 这也是为什么 v1 只接平台自研（Tier A）与已审查的 Tier B 计算型原子（见"运行时选型"一节）。
