# Implementation Tasks

## 里程碑与验收门

> 前置：本提案批准后才开工（`openspec/AGENTS.md` 的批准门）。
> 每个里程碑有**可复现的验收门**；门不过不解释为"环境问题"。

| 里程碑 | 范围 | 验收门（命令 + 期望） |
| --- | --- | --- |
| **S1** 协议与骨架 | Rust crate + `hello/load/call` + 错误信封 | `cargo test -p wasm-host` 通过；手工 `hello→ready`、`load`、`call` 往返正确 |
| **S2** 接缝替换 | `WasmtimeEngine` 实现同一接口 + `ATOMIC_ENGINE` 开关 | `ATOMIC_ENGINE=wasmtime` 下现有单元 **90 项**全过 |
| **S3** 对拍 | e2e 两套引擎 | `ATOMIC_ENGINE` 取 `v8` 与 `wasmtime` 两种值，e2e **3 项**都过 |
| **S4** fuel/epoch | 契约 `cpuBudget` + 双保险中断 | 新增负例全绿：fuel 耗尽、epoch 中断、sidecar 崩溃不回退、版本不匹配拒启 |
| **S5** 打包运维 | 三目标构建 + 健康/退避重启 + 审计标注 | CI 产出三平台二进制；崩溃后 60s 内自动恢复并有审计 |
| **S6** 切换默认 | 翻转 `ATOMIC_ENGINE` 默认值 | 连续 3 次全量回归（单元 + e2e + wasm-modules 53 项）无波动 |

### 执行约定

1. 每完成一项：勾选 + 附证据（命令 + 结果），不写"应该可以"。
2. **不允许静默回退**：引擎不可用时必须显式失败；`ATOMIC_ENGINE_FALLBACK=v8` 才允许回退且必须留审计。
3. 不改变对外契约：HTTP 接口、ABI v1、错误码语义与映射表保持不变。
4. 每个里程碑结束跑 `openspec validate add-wasmtime-host --strict`。

## Phase S1: 协议与 sidecar 骨架

- [x] 建 `crates/wasm-host`（Rust + wasmtime 48.0.3；49 要求 rustc 1.96 而本仓库锁 1.95）
- [x] 实现行分隔 JSON 协议：`hello/ready`（版本协商）、`ping/pong`、错误信封
- [x] 实现 `load`：按 sha256 缓存 `Module`，重复 load 幂等（实测第二次返回 `cached: true`）
- [x] 实现 `call`：新建 Store/Memory/Instance，注入输入、调用 `run`、回读输出（**含按需增长内存**）
- [x] 闸 1 复检：sidecar 在 `load` 时自行校验导入面只有 `env.memory`、非共享、有上限（双保险）
- [x] `cargo test`：**3 passed**（零能力模块通过 / 多一个 WASI 导入被拒 / 协议消息解析）

## Phase S2: Node 侧接缝

- [x] 抽出 `WasmEngine` 接口（`run(EngineCall) → EngineResult`），V8 池与 sidecar 客户端都实现它
- [x] 实现 `WasmtimeSidecarClient`（子进程管理、按 id 配对、超时杀进程重建、崩溃时在途调用全失败）
- [x] `AtomicExecutor` 只依赖接口，不依赖具体引擎（构造参数类型改为 `WasmEngine`）
- [x] `ATOMIC_ENGINE=v8|wasmtime` 选择（**默认仍 v8**，本阶段不翻转）
- [x] 引擎错误码保留原样（`FUEL_EXHAUSTED`/`EPOCH_TIMEOUT`/`TRAP`/`ENGINE_EXIT`）供审计

## Phase S3: 两套引擎对拍

- [x] e2e 参数化：同一份 `backend/test/atomic-runtime.e2e-spec.ts` 在两种引擎下运行（默认 V8；通过 `ATOMIC_ENGINE` 选择实际引擎）—— 实测风险：sidecar 忘了按需增长内存（20k 行输入立刻暴露"输入超出内存范围"）；已修
- [x] 引擎选择接入 `AtomicExecutor` 依赖的 `WasmEngine`，避免执行路径分叉导致的假绿测试
- [x] 性能对拍：steady-state p50 相同（1ms）；计算密集批量 Wasmtime 约慢 25%（12.2ms vs 9.7ms @20k 行）；开销量级可接受（IPC 低），如需再考虑二进制帧
- [x] 对拍结论与差异原因记录到 `design.md` 的「对拍实测结果」

## Phase S4: fuel 与 epoch

- [x] `schemas/atomic-contract.schema.json` 增加可选 `cpuBudget`（整数 fuel 单位，下限 1000）+ 契约校验正负例（低于下限/非整数被拒）
- [x] sidecar：`consume_fuel(true)` + `set_fuel(budget)`；`epoch_interruption(true)` + 宿主 tick 线程
- [x] 契约 `cpuBudget` → 执行预算的传递链路（优先级：显式请求 > 契约 > 引擎默认；3 项捕获型引擎单测覆盖）
- [x] 迁移 `179040...`+`179050...`：`dependsOnAtomics` 与 `cpuBudget` 列，已在本地库双向验证
- [x] 负例：fuel 预算故意给 10（正常调用实测耗 97）→ `FUEL_EXHAUSTED`；死循环模块在 wasmtime 下 **47ms** 被中断（V8 需墙钟 500ms+）
- [x] 审计保留引擎原始原因（`FUEL_EXHAUSTED`/`EPOCH_TIMEOUT`/`TRAP`）与 `fuel_used`
- [x] 文档：fuel 口径与**校准方法**写进 `design.md`（实测 ≈32 指令/行，给出 4 步校准法）

## Phase S5: 打包与运维

- [x] CI 构建并测试引擎二进制：新增 `wasm-host` job（matrix：`ubuntu-latest`/`x86_64-unknown-linux-gnu`、`macos-latest`/`aarch64-apple-darwin`），跑 `cargo test --release --locked` + 构建 + 制品上传
- [x] **linux/arm64 与 linux/x64 交叉构建（本机已验证）**：用 cross-rs 镜像 + 显式挂载手工复现（`cross` CLI 在 macOS 会回落宿主 cargo），产出并核对架构：
  `linux-x64` = ELF x86-64、`linux-arm64` = ELF ARM aarch64、`darwin-arm64` = Mach-O arm64、宿主 = Mach-O x86_64
- [x] 健康探针（`ping` → `health()`）+ **真实退避重启**（指数退避封顶 5s、惰性重启）+ 重启后模块缓存重建；9 项客户端单测覆盖（含超时杀进程、加载/调用期崩溃、协议不匹配、引擎不存在）
- [x] 审计标注 `engine`（成功与失败都写）与实际 `fuelUsed`
- [x] `engine_fallback` 路径：`FallbackEngine`（**仅引擎级故障**触发、粘性切换、审计留 `engineFallback`；模块级故障与超时**不**回退）+ 17 项单测
- [x] 部署文档：sidecar 加固建议写进 `design.md`（无网络命名空间 / 只读根 + 非 root / cgroup 限额，含 docker 与 systemd 片段）

## Phase S6: 切换默认引擎

- [x] 全量回归连续 3 次无波动：**默认引擎（wasmtime）**下单元 **123** × 3 轮、e2e **3** × 3 轮、wasm-modules **53**；另确认 `ATOMIC_ENGINE=v8` 同样 123 + 3
- [x] 翻转 `ATOMIC_ENGINE` 默认为 `wasmtime`（`buildEngine()` 默认值；`=v8` 保留为对拍与显式回退路径）
- [x] 更新 `docs/META_LANGUAGE.md`（§3.2 增执行引擎说明 + 文档真源表 + 术语表）与 `docs/TECH_STACK_GAP.md`（WASM 沙箱行改为"已采用 Wasmtime"、C 组划线）
- [x] 在归档的 `add-wasm-atomic-runtime/design.md` 评估节**回填取代指向**（标注 ⚠️ 已被 `add-wasmtime-host` 取代，保留决策演进记录）
