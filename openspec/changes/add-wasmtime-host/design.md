# Wasmtime Host Design

## 架构

```text
NestJS（宿主，不可信判定之外的一切照旧）
  AtomicExecutor
      │  run({key, bytes, input, rows, inOff, outOff, outLength, timeoutMs, fuel})
      ▼
  引擎接缝：WasmEngine（接口不变）
      ├── V8Engine（现状：WasmInstancePool，Worker 线程）      ← ATOMIC_ENGINE=v8
      └── WasmtimeEngine（新增：WasmtimeSidecarClient）        ← ATOMIC_ENGINE=wasmtime
              │  行分隔 JSON over stdio
              ▼
        crates/wasm-host（独立进程，Wasmtime）
          ├── 模块缓存（sha256 → CompiledModule）
          ├── 每次调用：新建 Store + Memory + Instance
          ├── fuel 计费：ConsumeFuel(true) + set_fuel(budget)
          ├── epoch 中断：epoch_deadline_tick + 宿主按周期 tick
          └── 只导出 run/abi_version，只导入宿主内存
```

**不动的东西**（这是本变更能做的关键）：契约 Schema、ABI v1、闸 0/1/2/5、
`atomic-registry`、审计、权限 all-of、错误码 → HTTP 映射、REST 接口全部保持原样。
`AtomicExecutor` 内除"注入哪个引擎"之外一行不改。

## 为什么 sidecar，而不是 napi 绑定

| 维度 | napi 绑定 | sidecar（本方案） |
| --- | --- | --- |
| 生态可用性 | 无官方包；社区包周下载个位数，等于自己写 | 用 Wasmtime CLI/crate 官方能力 |
| 升级负担 | 跟 Wasmtime C API **和** Node ABI 双线 | 只跟 Wasmtime 版本 |
| 崩溃隔离 | ❌ 模块/引擎崩溃带走宿主进程 | ✅ 进程级隔离 |
| 资源约束 | 与宿主共享 cgroup | ✅ 可单独限 CPU/内存/无网络 |
| 代价 | — | IPC 序列化 + 进程生命周期管理 |

## 引擎宿主协议 v1（行分隔 JSON over stdio）

```text
宿主 → sidecar
  {"t":"hello","protocol":1,"engine":"wasmtime"}
  {"t":"load","id":7,"sha256":"<64hex>","bytes":"<base64>"}
  {"t":"call","id":8,"sha256":"<64hex>","input":"<base64:i32le>",
   "rows":2,"inOff":0,"outOff":24,"outLength":3,"fuel":1000000,"deadlineMs":2000}
  {"t":"ping","id":9}

sidecar → 宿主
  {"t":"ready","protocol":1,"engine":"wasmtime","wasmtime":"<version>"}
  {"t":"ok","id":7}
  {"t":"result","id":8,"rc":0,"out":"<base64:i32le>"}
  {"t":"error","id":7,"code":"BAD_MODULE"|"UNKNOWN_MODULE"|"FUEL_EXHAUSTED"|"EPOCH_TIMEOUT"|"TRAP",
   "message":"..."}
  {"t":"pong","id":9}
```

约定：

- **一行一条消息**；`id` 由宿主递增，应答必须回带同一 `id`（并发安全）。
- 初始 `hello/ready` 做**版本协商**：协议号或引擎版本不匹配 → 宿主拒绝启动该引擎（fail-closed）。
- `bytes`/`input`/`out` 一律 base64（避免 stdio 上的二进制与换行问题）。
- sidecar **不解析业务语义**：它只认内存偏移与长度，契约、投影、权限、审计全在宿主侧。

## fuel 与 epoch 的口径

```text
contract.cpuBudget（可选，整数 fuel 单位）
   ↓ 缺省用 ATOMIC_DEFAULT_FUEL（建议初值 1_000_000，按实测校准）
每次 call 前：store.set_fuel(budget)
执行中：
  · fuel 耗尽        → Wasmtime 返回 out-of-fuel trap → {"code":"FUEL_EXHAUSTED"}
  · epoch 到达       → epoch_deadline_tick 触发中断     → {"code":"EPOCH_TIMEOUT"}
  · 宿主墙钟到点     → 宿主终止该次调用（最后一道）      → 既有 EXECUTION_TIMEOUT
```

宿主侧的 epoch 递增线程只在**有在途调用**时按 `ATOMIC_EPOCH_TICK_MS`（建议 50ms）tick，
避免空闲时无谓唤醒。fuel 与 epoch 的**双保险**关系：fuel 保证确定性预算，
epoch 保证"预算设大了也不会真的跑满"。

## 失败模式与处置

| 失败 | 处置 |
| --- | --- |
| sidecar 启动失败 / `hello` 不匹配 | **拒绝启动引擎**；`ATOMIC_ENGINE=wasmtime` 时整个原子接口不可用（不回退到 V8，除非显式配置允许） |
| sidecar 崩溃（在途调用） | 该次调用失败（`ATOMIC_FAILED`，**不回退**）；进程按退避重启，重启后需重新 `load` 模块 |
| 模块 trap | 该次调用失败；模块本身仍可复用（每次新建 Store） |
| fuel/epoch 触发 | 该次调用失败并记审计（含用量）；模块保留在缓存 |
| 协议解析错误 | 视为致命：终止并重启 sidecar（避免半截消息污染流） |

**是否允许回退到 V8**：默认**不允许**（元语不变量 4）。若部署时需要过渡，
用显式配置 `ATOMIC_ENGINE_FALLBACK=v8` 打开，并在审计里标注 `engine_fallback: true`
—— 静默回退是禁止的，显式且留痕的回退是可接受的过渡手段。

## 打包与部署

```text
构建：cargo build --release（crates/wasm-host）→ 单文件二进制
目标：x86_64-unknown-linux-gnu、aarch64-unknown-linux-gnu、aarch64-apple-darwin
随包：随 backend 产物分发（放在 dist/engine/），或独立镜像层
运行：由 NestJS 以子进程启动（stdio 管道），env 传入版本与 tick 参数
加固：无网络命名空间（部署侧）、只读根、非 root、CPU/内存 cgroup 限额
可用性：`ATOMIC_ENGINE` 未设置时保持 v8 —— 本变更不改变默认行为，直到对拍通过
```

### 部署加固建议（S5）

sidecar 执行的是**不可信代码**，它的加固与宿主同等重要。三条底线：

```text
1. 无网络：以独立网络命名空间启动（docker --network=none / systemd PrivateNetwork=yes）
   —— 模块本身零能力（只导入宿主内存），网络隔离是第二层，防的是引擎漏洞
2. 只读根 + 非 root：容器 --read-only、--user 10002:10002；
   systemd 侧 ProtectSystem=strict + PrivateTmp=yes + NoNewPrivileges=yes
3. 资源限额：cgroup 限制 CPU 与内存（建议 --memory=1g --cpus=2），
   与 fuel/epoch 形成"引擎内 + 引擎外"双保险
```

docker-compose 片段（本地部署形态）：

```yaml
wasm-host:
  image: sapbase/wasm-host:48.0.3
  read_only: true
  network_mode: none
  user: "10002:10002"
  mem_limit: 1g
  cpus: 2.0
  tmpfs: ["/tmp:size=64m,mode=1777"]
  # 由 backend 通过 stdio 启动时改由 backend 直接 spawn，无需暴露端口
```

systemd 片段（裸二进制形态）：

```ini
[Service]
ExecStart=/opt/sapbase/wasm-host
PrivateNetwork=yes
ProtectSystem=strict
ProtectHome=yes
NoNewPrivileges=yes
MemoryMax=1G
CPUQuota=200%
```

**二进制缺失时的行为**：不静默回退；启动日志给出明确错误与构建命令
（`cargo build --release -p wasm-host`），调用原子时返回可诊断错误，`health()` 报 `ok:false`。

### 已在本机验证的四平台产物与交叉编译配方（S5，2026-09-25）

```text
darwin-x86_64（宿主）   Mach-O x86_64      cargo build --release --locked
darwin-arm64           Mach-O arm64       cargo build --release --locked --target aarch64-apple-darwin
linux-x64              ELF x86-64         cross-rs 镜像 + 显式挂载（见下）
linux-arm64            ELF ARM aarch64    cross-rs 镜像 + 显式挂载（见下）
```

**为什么不是 `cross` CLI**：本机实测 `cross 0.2.5` 在 macOS 上会 `Falling back to cargo on the host`，
接着因 `rust-toolchain.toml` 的 1.95.0 pin 要求安装 linux 工具链而失败；cross-rs 镜像本身**不自带 Rust**，
只提供交叉 C 工具链。可复现的方式是直接用镜像并显式挂载（`<rustup-cache>` 为容器内的 RUSTUP_HOME）：

```bash
docker run --rm -v "$PWD":/src -w /src \
  -v "<rustup-cache>":/rustup -v "$HOME/.cargo/registry":/cargo/registry \
  -e RUSTUP_HOME=/rustup -e CARGO_HOME=/cargo -e PATH=/cargo/bin:/usr/local/bin:/usr/bin:/bin \
  -e CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc \
  -e CC_aarch64_unknown_linux_gnu=aarch64-linux-gnu-gcc \
  -e CARGO_TARGET_DIR=/src/target-docker \
  ghcr.io/cross-rs/<target-triple-image>:main bash -lc '
    curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal \
      --default-toolchain 1.95.0 --target <target-triple> >/dev/null
    cargo build --release --locked --target <target-triple>'
```

CI 上（ubuntu runner 有 Docker）用 `cross` 更省事，工作流里已经配好；本机这条配方是它的等价物。

## 验收与回归网

```text
对拍：同一批 e2e（3 项）+ 单元（90 项）在 ATOMIC_ENGINE=v8 与 =wasmtime 下都通过
新增负例：
  · fuel 预算耗尽 → 调用失败且审计记 FUEL_EXHAUSTED
  · epoch 中断    → 死循环模块在预算内被中断（比墙钟更快返回）
  · sidecar 崩溃  → 在途调用失败且不发生回退；重启后新调用成功
  · 版本不匹配    → 引擎拒绝启动
性能：对比两套引擎的 p50/p95（现有 benchmark 脚本加 --engine 参数）
```

## 对拍实测结果（S3，2026-09-25）

```text
引擎      rows=2            rows=1000         rows=20000
        mean / p50        mean / p50        mean / p50
V8      3.2ms / 1ms       1.1ms / 1ms       9.7ms / 9ms
Wasmtime 71.7ms / 1ms     1.5ms / 1ms       12.2ms / 11ms
```

**结论**：

- **稳态 p50 两者相同（1ms）** —— IPC 开销在稳态可忽略，不需要换二进制帧协议。
- Wasmtime 在计算密集批量上约慢 25%（20k 行 11ms vs 9ms）：
  Cranelift 与 V8 TurboFan 的差异，叠加 fuel 计量的开销。在本项目量级无关紧要。
- 差异在**冷启动**：V8 首调用 82ms（Worker 启停），Wasmtime 最坏 2134ms（进程 spawn + 握手；
  e2e 里含 HTTP 的首调用是 265ms）。冷启动是一次性的，且可用常驻 sidecar 摊掉。
- 测试全绿：单元 **90 项**、e2e **3 项**，两套引擎下都通过。

**对拍抓到的真实差异**（正是设计里担心的"两套引擎语义漂移"）：

1. **sidecar 忘了按输入/输出增长内存** —— V8 实现里有这一步，移植时漏了；
   20k 行输入时立刻暴露"输入超出内存范围"。已修。
2. **握手应答不带 `id`** —— 客户端的按 id 配对把它丢掉，握手永远挂住。已修（按 0 号请求结算）。
3. **常驻子进程需要接生命周期钩子** —— 与 V8 池同一个坑：不实现 `OnModuleDestroy`，
   `app.close()` 后进程不退出（e2e 卡住）。已修。

## 预算校准方法（S4，2026-09-25）

**实测指令用量**（`available-inventory`，3 列，`ATOMIC_ENGINE=wasmtime`）：

```text
rows      2    → fuel 97
rows   1000    → fuel 32,033
rows  20000    → fuel 640,033
```

**结论：用量与行数线性（≈32 指令/行 + 约 33 的固定开销）**。校准步骤：

```text
1. 用 benchmark 脚本量两个行数点（如 1000 与 20000）→ 得到 per-row 与 fixed
2. 按业务允许的最大行数估算上限：budget = fixed + perRow × maxRows
3. 乘安全系数（建议 3–5×）：给实现留优化/抖动余量，但足以挡住死循环
4. 写进契约 cpuBudget；未声明的契约沿用 ATOMIC_DEFAULT_FUEL（默认 1,000,000 ≈ 3 万行）
```

**注意**：fuel 是**引擎计量**，不同 wasmtime 版本可能略有差异；因此预算应视为"量级约束"，
而不是精确计费口径。真正的成本计费若要做，需固定引擎版本并把版本写进审计。

实际用量已进结果与审计：`AtomicInvocationResult.fuelUsed` → `audit_logs.metadata.fuelUsed`，
引擎标识同写入 `metadata.engine`（成功与失败都写）。

## 风险

| 风险 | 对策 |
| --- | --- |
| 多平台二进制打包成为负担 | 先用 CI matrix 构建三目标；本地开发用 host 目标 |
| IPC 成为新瓶颈 | base64 + 单行 JSON 足够；若实测成为瓶颈再换长度前缀二进制帧 |
| fuel 口径难以校准 | 默认值先宽松（只挡死循环），再按实测收紧；口径写进契约文档 |
| 两套引擎语义漂移 | 强制"同一套测试跑两套引擎"，漂移即红 |
| 运维面增加 | 健康探针 + 退避重启 + 审计标注引擎与用量 |
