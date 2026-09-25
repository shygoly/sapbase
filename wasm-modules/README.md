# wasm-modules — 平台签名的 Wasm 原子模块

原子模块的**源码、准入闸门与入库产物**。模块在运行时以**零能力**方式执行：
只允许导入一块由宿主提供、有上限的线性内存，没有网络、文件、进程与系统调用能力。

这是《ERP Space Platform 设计方案 v3》里 **Atomic Contract 的实现封装层**：
客户可见原子名称、参数与前后置条件，不可见实现；实现以 Wasm 形态分发，宿主按字节哈希
指认"客户同意跑的那一份代码"。

---

## 来源与改动（移植说明）

本包由 `medtrust/packages/wasm-algorithms` 移植而来，保留了其准入模型与五道闸的核心机制，
按 ERP 语境与 sapbase 技术栈做了以下改动：

| 维度 | 来源（medtrust） | 本仓库 | 理由 |
|---|---|---|---|
| 内容哈希 | SM3（国密，`sm-crypto` 依赖） | **SHA-256**（`node:crypto`，零依赖） | sapbase 设计文档 §11 采用 SHA-256 + Ed25519；且避免引入外部密码库 |
| 签名算法 | SM2 | **Ed25519**（留给控制面实现） | 同上 |
| 领域词汇 | `analysisType`（医学失衡检测分析类型） | `atomicType`（原子类型） | ERP 原子能力 |
| 示例模块 | `disproportionality`（医学 2×2 计数） | `available-inventory`（可用库存计算） | 对应设计文档 §6.2 的计算示例 |
| 语言通道 | Rust + AssemblyScript 双通道 | **只启用 Rust**（AS 的判定逻辑保留） | 去掉 `assemblyscript` 编译器依赖，保持构建零依赖 |
| 编译期执行点 | build.rs / proc-macro / .cargo / npm 生命周期 | 同左 | 未改动 |
| 构建隔离 | Docker 无网络/只读/非 root | 同左（镜像名改为 `speckit-wasm-builder`） | 未改动 |

**未移植的部分**（有意为之，见"已知边界"）：

- 闸 3（输出通道管控 / 低熵输出 schema / canary 不可复原）—— 它服务于医疗数据的披露风险模型，
  ERP 侧的等价需求是"第三方原子不得外泄租户数据"，需要重新设计判据后再引入。
- 闸 4（影子发布只算不发）—— 属于发布流程编排，不属于模块包的职责；状态机里保留了
  `shadow` / `canary` 词汇供控制面使用。

---

## 五道闸（本包实现的用粗体标出）

| 闸 | 位置 | 挡什么 |
|---|---|---|
| **闸 0** 源码预检 | `src/source-gate.ts`，编译**之前** | `build.rs` / `[package].build` / `[build-dependencies]` / 非空依赖 / proc-macro / `.cargo/config` / npm 生命周期脚本 / 夹带 `node_modules` / `[workspace]` |
| **闸 1** 静态白名单 | `src/wasm-binary.ts` + `src/static-gate.ts`，不运行就挡 | 非白名单导入（WASI / env 函数 / 表 / 全局 / tag）、start 段、共享内存、GC 类型、自定义内存或表、memory64、导出未授权符号、字节与内存页超限 |
| **闸 2** 复现构建 | `scripts/admission.mjs` + `Dockerfile.builder` | 不可复现的产物（两个独立构建器哈希不一致即拒）、把 `rustc` 装进服务容器、带预构建 `target/` 蒙混过关、"只交 `.wasm`" |
| 闸 3 输出管控 | **不在本包**：判据已冻结在 `docs/protocols/atomic-output-audit.md`，实现在宿主侧（`backend/src/atomic-runtime/`） | 用输出通道夹带常量、输出随行序变化、值越界 |
| 闸 4 影子发布 | **不在本包**：实现在宿主侧（准入状态机 `shadow` / `canary` 的编排） | 未经影子期直接上生产、凭一次请求跳级 |

| **闸 5** 吊销 | `src/revocation.ts` | 已吊销模块继续执行；旧名单回放把吊销"撤销" |

闸 3 / 闸 4 放在宿主侧而不是模块包，理由很直接：**静态的东西挡不住值的泄漏**，
而发布编排属于控制面，不属于被审查的源码。本包为闸 3 提供了两个**对照夹具**（见下节）。

核心不变量：

> **Blueprint 固定的模块哈希必须由平台从提交的源码复现产出。**
> 于是"只交二进制"的模块结构性地无法入册 —— 不是政策上拒绝，是复现不出哈希就签不了、固定不了。

---

### 闸 3 的对照夹具（`modules/leaky-*-rust`）

为了让"闸 3 到底挡没挡住"有可对照的真相，本包内置两个**故意做手脚**的模块。
它们在闸 0/1/2 眼里与生产模块**完全一样**（零能力、无导入、可复现构建），
因此都会被放行 —— 这正是闸 3 存在的理由：

| 夹具 | 原子类型 | 做什么手脚 | 应当被哪条判据拦下 |
|---|---|---|---|
| `leaky-output-bits-rust` | `leaky-output-bits` | `available[i] = 正确值 \| 0x5EC00000`（把编译进代码的常量塞进高位，汇总位保持干净） | O2 值域（判决）+ S1 常量位（信号） |
| `leaky-order-channel-rust` | `leaky-order-channel` | `available[i] = 正确值 ^ (i << 16)`（把行下标塞进高位） | O4 批量-单条一致（判决）+ O5 置换不变（声明 `commutative` 后） |

两条注意：

1. 它们是**测试夹具，不是生产模块**。别在真实契约里绑定它们。
2. 它们会出现在 `build/manifest.json` 里且 `tier: "A"` —— 这是刻意的：
   闸 0/1/2 确实拦不住它们，写进来才能让"闸 3 拦住了"这句话可被复核。

证据在 `scripts/leaky-fixtures.test.mjs`：既从源码复现构建证明它们过闸 0/1/2，
也用真正的 WASM 引擎跑一遍证明它们**确实**在泄漏（常量藏在高位、批量与逐条结果不同）。

---

## ABI v1（小端）

```text
run(in_off: i32, n: i32, out_off: i32) -> i32        // 0 = 成功，非 0 = 参数非法

输入 @in_off : [on_hand: i32[n]] [reserved: i32[n]] [in_transit: i32[n]]
输出 @out_off: [available: i32[n]] [total_available: i32]     // 共 n*4 + 4 字节

available[i] = on_hand[i] - reserved[i] + in_transit[i]
```

导出 `run`（函数）与 `abi_version`（Rust 形态为函数；AssemblyScript 形态为常量全局，
宿主两种形态都认，见 `abiVersionExportKind`）。物料号、单据号等**标识不进入模块**：
宿主按下标建立映射，模块只回整数列。

---

## 目录结构

```text
wasm-modules/
├── src/                          # 准入判定逻辑（与 Runtime 侧共享的同一份实现）
│   ├── wasm-binary.ts            #   Wasm 结构化解析（段表 / 导入 / 导出 / 类型段）
│   ├── static-gate.ts            #   闸 1：静态白名单
│   ├── source-gate.ts            #   闸 0：编译期执行点预检
│   ├── admission.ts              #   准入层级 / 状态机 / 审查背书 / 固定条款
│   ├── revocation.ts             #   闸 5：吊销名单
│   ├── test-fixtures.ts          #   静态拒绝集夹具（20 类负例）
│   └── *.test.mjs                #   测试（node --test）
├── modules/
│   └── available-inventory-rust/ # 提交形状的源码：Cargo.toml + rust-toolchain.toml + src/lib.rs
├── scripts/
│   ├── toolchains.mjs            #   锁定构建配方 + hermetic 环境 + 容器参数
│   ├── admission.mjs             #   闸 2：双独立构建器复现 + 闸 1 校验
│   ├── admit-cli.mjs             #   准入构建 CLI（stdout 一行 JSON）
│   ├── check-reproducible.mjs    #   可复现性闸门（入库字节 + 源码重建）
│   └── wasm-utils.mjs            #   SHA-256 / 模块检查 / 清单读写
├── Dockerfile.builder            # 隔离构建器镜像（无网络 / 只读 / 非 root / 无凭据）
├── build-rust.sh                 # 容器入口：吃只读源码、吐 .wasm
└── build/                        # 入库产物：*.wasm + manifest.json
```

---

## 使用

```bash
# 0) 首次需要安装 workspace 依赖（包已声明 typescript devDependency）
npm install
# 或者复用仓库里已有的 tsc：
#   PATH="$PWD/backend/node_modules/.bin:$PATH" npm run wasm:test

# 1) 编译准入逻辑（生成 dist/，scripts 从这里 require）
npm run wasm:build

# 2) 准入构建：默认走隔离容器（推荐）
docker build -f wasm-modules/Dockerfile.builder -t speckit-wasm-builder:1.95.0 wasm-modules
npm run wasm:admit -- --source modules/available-inventory-rust --atomic-type available-inventory --tier A

# 本机自证（开发/CI）：必须显式声明，代码不做静默回退
WASM_BUILD_ISOLATION=host npm run wasm:admit -- --source modules/available-inventory-rust --atomic-type available-inventory

# 3) 测试：闸 0 / 闸 1 的拒绝集 + 闸 2 真构建 + ABI 功能正确性
npm run wasm:test

# 4) 可复现性闸门：入库字节 = 清单哈希 = 源码重建哈希
WASM_BUILD_ISOLATION=host npm run wasm:reproducible -- modules/available-inventory-rust
```

已验证结果（本机 rustc 1.95.0 + wasm32-unknown-unknown）：

```text
admit:  sha256=54c7674e...d8736  sizeBytes=265  abi=1
        导入 = env.memory(min=2,max=1024)；导出 = run / abi_version / __heap_base / __data_end
tests:  53 passed（45 闸 1+闸 0，8 闸 2+ABI）
repro:  源码重建与入库字节逐字节一致
```

---

## 已知边界

- **依赖必须为空。** 任何依赖都可能自带 `build.rs` 或 proc-macro，会把审查面扩散到平台没审过的
  代码。需要依赖须走 vendored + 白名单，另立变更。
- **容器隔离强度取决于宿主 Docker 配置**（用户命名空间、seccomp profile）。构建环境应与生产
  控制面网络隔离，且不持有任何控制面凭据。
- **闸 3 / 闸 4 不在本包**：闸 3 的判据已冻结在 `docs/protocols/atomic-output-audit.md`，
  实现在宿主侧（`backend/src/atomic-runtime/`）；闸 4 同理。本包只提供它们的对照夹具。
- **已与运行时集成（模块侧这一半）**：`backend/src/atomic-registry` 导入本包的
  `build/manifest.json`（**重算哈希，不采信自述**），`backend/src/atomic-runtime` 通过
  Wasmtime sidecar（`crates/wasm-host`）执行这些产物。本包仍不负责"谁来加载"，
  它只负责"这份代码能不能入册"。
- **`build/manifest.json` 是准入记录，不是许可**：签名与许可由控制面负责（v3 设计文档 §11）。
