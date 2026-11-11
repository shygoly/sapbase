# Change: Add Wasmtime Host

## Why

当前原子运行时跑在 **Node 内置 WebAssembly（V8）** 上。它在 v1 够用，但缺三样正好是"跑不可信代码"核心能力的东西：

| 缺什么 | 后果 |
| --- | --- |
| **fuel（指令预算）** | 无法限制单次调用的指令数，只能按墙钟掐断整次调用 |
| **epoch 中断** | 只能杀 Worker；代价是这次调用全丢 + Worker 重建 |
| **进程外隔离** | 与宿主同进程；V8 自身出漏洞即宿主沦陷，模块崩溃也会带走 API 进程 |

而这三点恰恰是平台路线图的刚需：v3 设计的核心承诺是 **Blueprint 市场与第三方行业模板（Tier B）**，
即"运行别人交来的代码"。`docs/META_LANGUAGE.md` 的准入分层也明确 Tier B 存在。

**一条决定性的工程事实**（2026-09-25 核实）：Node 生态**没有可用的 Wasmtime 绑定** ——
官方 `@bytecodealliance/wasmtime` 不存在，`wasmtime` npm 包停在 2023 年的 0.0.2，
社区 napi 绑定周下载个位数，`jco` 走的是"编译成 JS 跑在 V8 上"（拿不到 fuel）。
因此引入 Wasmtime 只有一条路：**Rust sidecar + 自定义 IPC**。

**为什么是现在**：引擎被隔离在 `WasmInstancePool` 这一个接缝之后，
ABI v1 已冻结、契约 Schema 已冻结、90 个单元 + 3 个 e2e 可原样当回归网。
越往后改，需要重新验证的面越大。

## What Changes

- **ADDED**: Rust sidecar `crates/wasm-host` —— Wasmtime + fuel 计费 + epoch 中断 + 模块缓存
- **ADDED**: 引擎宿主协议（行分隔 JSON over stdio）：版本协商、`load`、`call`、错误信封、健康探针
- **ADDED**: Node 侧 `WasmtimeSidecarClient`，实现与 `WasmInstancePool` 相同的接口（`run(PoolCall) → PoolResult`）
- **MODIFIED**: 执行沙箱从"同进程 Worker"改为"独立进程"（能力面不变：仍只注入一块有上限的宿主内存）
- **MODIFIED**: 资源限制从"墙钟超时"升级为"**fuel 指令预算 + epoch 中断 + 墙钟兜底**"
- **ADDED**: 原子契约新增**可选**字段 `cpuBudget`（指令预算），未声明时取平台默认
- **ADDED**: 引擎选择开关 `ATOMIC_ENGINE=v8|wasmtime`（迁移期两套并存，e2e 全绿后再翻默认）
- **ADDED**: sidecar 的构建打包（Linux x64/arm64、macOS arm64）与进程生命周期管理（重启退避、健康检查）

## Impact

- **Affected specs**:
  - `wasm-atomic-runtime`：MODIFIED ×3（Fail-Closed Pre-Execution Verification / Zero-Capability Execution Sandbox / Resource Limits）+ ADDED ×1（Engine Host Contract）
  - `atomic-registry`：MODIFIED ×1（Atomic Contract Definition 增加可选 `cpuBudget`）
- **Affected code**:
  - 新增：`crates/wasm-host/`（Rust）、`backend/src/atomic-runtime/wasmtime-sidecar.client.ts`
  - 修改：`backend/src/atomic-runtime/atomic-executor.service.ts`（改注入实现，逻辑不变）、`atomic-runtime.module.ts`（按 `ATOMIC_ENGINE` 选择）
  - 修改：`schemas/atomic-contract.schema.json`（新增可选 `cpuBudget`）、`wasm-modules/`（仅消费同一 ABI，不改）
- **Breaking changes**: **对外无**（HTTP 接口、ABI v1、错误码语义全部不变）；对内是执行引擎替换
- **Migration**: 迁移期 `ATOMIC_ENGINE=v8` 为默认，sidecar 就绪后跑完整 e2e 对拍（同一批用例两套引擎都过），
  再翻默认值；V8 实现保留一个版本周期作为回退路径

## Decisions Made

1. **sidecar 而非 napi 绑定**：自维护 napi 绑定要跟着 Wasmtime 的 C API 与 Node ABI 双线升级，
   且崩溃仍会带走宿主进程；sidecar 用 stdio 协议，版本与崩溃域都独立。
2. **一进程多实例**：sidecar 常驻，按模块哈希缓存已编译模块，**每次调用新建 Store/Instance**
   —— 与现有 V8 池语义一致（模块全局状态不跨调用残留）。
3. **fuel 为主、epoch 为辅、墙钟兜底**：fuel 给确定性指令预算；epoch 给"卡在长循环里也能按时间片中断"；
   墙钟保留作最后一道（防止 sidecar 自身卡死）。
4. **`cpuBudget` 可选**：默认由平台给定（`ATOMIC_DEFAULT_FUEL`），契约可声明更小预算；
   未声明字段的既有契约不受影响（Schema 向后兼容）。
5. **超预算归类为 `ATOMIC_FAILED` 的新 reason**（不新增对外错误码，避免破坏调用方契约）；
   若后续需要区分，再加 `CPU_BUDGET_EXCEEDED` 并同步更新错误码表。
6. **协议只做两件事**：`load` 与 `call`。不做热更新、不做多语言 ABI、不做 WASI 授予。

## Out of Scope

- WASI 能力授予与外部连接器（当前模块是零能力，不需要）
- 把 Blueprint Compiler / 其他内核也搬到 Rust（另立变更）
- 组件模型（Component Model / WIT）与 `jco` 路线
- 闸 3 的低熵输出判据
