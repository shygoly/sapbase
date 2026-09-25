# Implementation Tasks

## 里程碑与验收门

> 本 change 是按批准执行的长任务。下面每个里程碑都有**可复现的验收门** —— 绿了才进下一个。
> 门不过时不解释为"环境问题"，先查是不是自己错了。

| 里程碑 | 范围 | 验收门（可复现命令 + 期望） |
| --- | --- | --- |
| ~~**M0** 解除阻塞~~ | 依赖收敛 | **目的已达成，机械门延后**：验收所需的"能跑起来"由 `jest`（90 项）+ **真实 PostgreSQL 的 e2e**（3 项）提供，未依赖 `npm ci`；残余的"CI `apps` job 转正"属环境治理，已转记 `docs/PACKAGE_MANAGER.md`，需用户授权后执行 `npm ci` |
| **M1** 契约注册表 | 三实体 + service + 状态机复用 | jest：契约 CRUD、语义化版本解析、非法状态流转被拒 |
| **M2** 清单导入 | `importManifest`（重算哈希） | jest：真实 manifest 导入成功；篡改字节被拒；重复导入幂等 |
| **M3** 宿主运行时 | Loader / Verifier / Executor / Worker / 资源限制 | jest：真实 wasm 原子 ABI 往返正确；超时中断；输出超限被拒；哈希不符被拒 |
| **M4** 接入与审计 | REST + 权限 + 审计 + module-registry 关联 | e2e：HTTP 调用返回正确结果，且审计可查 |
| **M5** 硬化 | 吊销同步 + 实例缓存 + 文档回写 | jest：吊销即拒且**不回退**；CI 的 `wasm-modules` job 绿 |

### 执行约定

> **M1 证据（2026-09-25）**：`jest --runInBand src/atomic-registry` → **40 passed / 2 suites**
> （19 契约与清单校验 + 21 注册表服务）；`tsc --noEmit` 错误数 20 → **19**
> （`semver` 类型声明顺带修掉一处既有错误，新增文件零错误）。
>
> **M2 证据（2026-09-25）**：同命令 → **46 passed / 2 suites**（新增 6 项：真实清单导入、
> 幂等、字节篡改被拒、哈希对但闸 1 不过被拒、Schema 不合被拒、清单缺失 404）。
> 其中"闸 1 不过"用 `buildFixtureWasm({ importWasi: 'fd_write' })` 造真实违规模块，
> 并给出**正确哈希**写进清单 —— 证明拒的是闸，不是哈希。
>
> **M3 证据（2026-09-25）**：`jest --runInBand src/atomic-runtime` → **9 passed / 1 suite**。
> · 真实 ABI 往返：两行 `available=[7,7]`、`total=14`；单行 `onHand=0,reserved=7,inTransit=3` → `-4`
> · 五类拒绝：`MODULE_HASH_MISMATCH` / `MODULE_REJECTED_BY_GATE` / `EXECUTION_TIMEOUT` /
> `MODULE_REVOKED` / `OUTPUT_LIMIT_EXCEEDED`，外加 `INVALID_INPUT`（非整数）
> · **超时是真死循环**：手写一个能过闸 1 的 `loop { br 0 }` 模块，500ms 超时实测 514ms 被终止
> —— 不是用假 worker 测的
>
> **M4 证据（2026-09-25）**：`jest --config test/jest-e2e.json test/atomic-runtime.e2e-spec.ts`
> → **2 passed**。真 HTTP + 真 PostgreSQL（sapbasic）+ 真 Wasm 字节：
> · `POST /api/atomic-contracts` 登记契约 → 绑定真实产物 → `POST /api/atomic-contracts/e2e-available-inventory/invoke`
> 返回 **200**，`columns.available=[7,7]`、`total=14`、`moduleSha256` 与产物一致
> · 审计落库核对：`audit_logs` 里 `action='atomic.invoke'` 一行，`status='success'`、`actor='e2e@test.local'`、
> `metadata.moduleSha256` 一致
> · 拒绝路径经 HTTP：模块哈希换成不存在的值 → **404 `MODULE_NOT_FOUND`**（不回退）
> 前置：`npx ts-node --transpile-only scripts/run-atomic-migration.ts` 建表；
> 单元层同轮 `jest src/atomic-registry src/atomic-runtime` → **69 passed / 4 suites**，`tsc` 错误 19 → 18。
>
> **M4 补充（2026-09-25）**：权限与值域两处缺口补齐。
> · 权限 **all-of**：契约 `permissions: ['inventory.read']` + 身份无该权限 → 单元 `PERMISSION_DENIED`、
> e2e 经 HTTP **403**，且审计留 `status='failure'`；带上权限则正常算出 `total=7`
> · 值域：契约声明 `available.minimum=0` 时，超卖（`onHand=0,reserved=7` → -7）被
> `OUTPUT_OUT_OF_RANGE` 拒；值域内的同一次调用正常放行
> · e2e 从 2 → **3 passed**；单元从 69 → **74 passed**
>
> **M5 部分（2026-09-25）**：吊销名单同步落地 —— `RevocationListService`
> （本地文件 + 版本单调防回放 + 解析不动即拒、保留上一版），控制器每次调用前同步一次。
> 证据：`jest src/atomic-runtime` 新增 9 项 → 全套 **86 passed / 6 suites**；
> 其中"把旧名单放回去（v5 → v2 且不含原吊销项）"仍保持 v5 与 A 的吊销 —— 防回放实测生效。
> 前端接入示例：`speckit/src/lib/api/atomic.api.ts`（已导出到 `lib/api/index.ts`）。
>
> **M5 性能（2026-09-25）**：先压测后调优，数据说话。
> `npx ts-node --transpile-only scripts/benchmark-atomic-runtime.ts 30`：
>
> | 行数 | 优化前 mean | 优化后 mean | 优化后 p95 | 吞吐 |
> | --- | --- | --- | --- | --- |
> | 2 | 40.5ms | 2.1ms（p50 0ms） | 1ms | ~476/s |
> | 1000 | 40.8ms | 0.7ms | 2ms | ~1364/s |
> | 20000 | 46.0ms | 6.3ms | 9ms | ~159/s |
>
> 结论：原瓶颈是"每次调用新建 Worker + 重新编译模块"的固定开销（2 行 vs 20000 行只差 5ms），
> 而非计算。改为**缓存 Worker 与已编译模块、每次调用新建内存与实例**后，
> 小负载约 **20×**、中负载约 **58×**。语义未放宽：模块全局状态仍不跨调用残留。
> e2e 套件耗时 50s+ → 8.5s，单次 HTTP 调用 421ms → 156ms。
> 踩到的坑：常驻 Worker 会让事件循环保持活跃 —— 必须实现 `OnModuleDestroy`，否则 `app.close()` 后进程不退出。
>
> **M4 收尾 + 文档回写（2026-09-25）**
> · `module-registry` 新增 `dependsOnAtomics`（`atomicType@range`）+ 迁移 `1790400000000`，
> 发布为 active 时逐条解析，**一次列出全部缺失项**；单元 4 项（含"三条依赖中两条不可用"的负例）
> · Wasmtime 评估结论写入 `design.md`（v1 不引入 + 3 条触发条件 + 代价清单）
> · 差距文档同步：`TECH_STACK_GAP.md` 的 WASM 沙箱 🟡→✅、C 组划线；v3 设计 §14.2 的 #1 标为已落地、#11 更新
> · 全量：单元 **90 passed / 7 suites**，e2e **3 passed**，`tsc` 仍 18（全为既有缺依赖）

1. 每完成一项：勾选 + 在 `tasks.md` 里附一行证据（命令 + 结果），不写"应该可以"。
2. 遇到需要决策的地方：停下来问，不自行扩大范围（`backend/AGENTS.md`）。
3. 不引入计划外依赖；每个里程碑结束跑 `openspec validate add-wasm-atomic-runtime --strict`。
4. 迁移一旦提交不改写（`backend/AGENTS.md` 第 3 条）。

### 已知阻塞与决策点

- **M0 未执行**：`npm ci` 会重建整个 `node_modules`（当前是 npm/pnpm/bun 混合形态），
  属对工作区的重操作，需明确授权后才跑。M1/M2 不依赖它（ts-jest 可直接跑）。
- **M3 起依赖 M0**：否则后端类型检查/构建无法当作验收门。
- M1 需要 `@speckit/wasm-modules`（状态机复用）。workspace 链接尚未安装，
  暂时在 `backend/jest.config.js` 用 `moduleNameMapper` 指向该包的 `dist`；
  M0 完成后即可移除该桥接。

## Phase 0: 协议冻结（执行时新增的前置阶段）

> 调整说明：原计划的顺序是先建实体、Schema 留到后面的协议冻结阶段补。
> 实际执行改为**先冻结 Schema 再建表** —— 字段一旦进数据库就难改，先冻结代价最小。
> 判定权威放在仓库根 `schemas/`（语言中立、可对外、可审计），后端只做"照章执行"。

- [x] `schemas/atomic-contract.schema.json`（v1 只允许 `calculation` / `query`；Wasm 实现必须能指认模块哈希；Tier B 必须有审查背书与复现构建引用）
- [x] `schemas/atomic-module-manifest.schema.json`（准入清单形态）
- [x] `backend/src/atomic-registry/schema-loader.ts`（定位并加载 `schemas/`，支持 `SPECKIT_SCHEMAS_DIR` 覆盖）
- [x] `backend/src/atomic-registry/contract-validator.ts`（契约与清单校验，fail-closed）
- [x] 负例测试 19 项：12 类契约违规 + 3 类清单违规 + 与 `wasm-modules` 真实产物的正例联调

## Phase 1: 原子契约注册表

- [x] 定义 `AtomicContract` 实体（atomicType / version / kind / inputSchema / outputSchema / permissions / errors / idempotency / status；`organizationId` 可空表示平台内置）
- [x] 定义 `AtomicImplementation` 实体（kind / moduleSha256 / abiVersion / tier / review / 闸报告 / status；状态枚举与 `wasm-modules` 的准入状态机一致）
- [x] 定义 `AtomicModuleManifest` 导入台账实体（`sha256` 唯一 → 导入幂等的依据）
- [x] 生成迁移 `CreateAtomicRegistry`（唯一约束：atomicType + version；已在 `data-source.ts` 注册）
- [x] **应用迁移到本地库并验证**：`npx ts-node --transpile-only scripts/run-atomic-migration.ts`
  （up/down 双向验证：建出 3 张表 + `module_registry.dependsOnAtomics`；回滚后表数归 0，再应用回 3；
  e2e 即跑在这套真库上）
- [x] 实现 `AtomicRegistryService`（契约登记、实现绑定、按 `atomicType + version` 解析）
- [x] 复用 `@speckit/wasm-modules` 的准入状态机（`canPromote` / `isRunnableStatus`）做状态流转校验与"可执行实现"判定
- [x] 单元测试：契约解析、版本选择、状态流转拒绝跳闸
- [x] `atomic-registry.module.ts`（供后续接入 `AppModule`）

## Phase 2: 清单导入

- [x] 实现 `importManifest()`：读取 `wasm-modules/build/manifest.json`
- [x] 对每个 `.wasm` 字节重算 SHA-256，与清单声明不符即拒（**不采信清单自述值**）
- [x] 复用 `staticGate()` 对字节做准入复检；报告随导入结果返回，供绑定实现时写入 `staticGate` 字段
- [x] 幂等：同 sha256 重复导入不产生重复记录
- [x] 记录导入台账（file / sha256 / tier / 实测 sizeBytes / importedBy / 原始清单快照）
- [x] 导入入口定为 **REST**：`POST /api/atomic-contracts/import`（含导入人取值），不再另做 CLI
- [x] 测试：篡改字节后导入被拒且不落台账；哈希正确但闸 1 不过同样被拒；重复导入幂等；清单不合 Schema 直接拒

## Phase 3: 宿主 Wasm 运行时

- [x] 实现 `WasmModuleLoader`（按 sha256 前缀定位、全量哈希在 Verifier 校验、进程内缓存）
- [x] 实现 `WasmModuleVerifier`（字节哈希 → 静态闸 → 按哈希缓存结论；复用同一份 `staticGate`）
- [x] 实现 `AtomicExecutor`：宿主内存注入 + 输入投影写入（列优先）+ 调用 `run` + 读回输出
- [x] 在 Worker 线程中执行，实现墙钟超时与强制终止
- [x] 输出**上限**校验（按契约 `outputSchema.maxOutputBytes`）
- [x] 输出**值域**校验（按 `outputSchema.columns[].minimum/maximum`；越界 → `OUTPUT_OUT_OF_RANGE`）
- [x] 契约错误码统一（`AtomicRuntimeError` + 11 个 code，含 `PERMISSION_DENIED` / `OUTPUT_OUT_OF_RANGE`；非 0 返回码 → `ATOMIC_FAILED`，MUST NOT 回退）
- [x] 吊销检查：执行前 `assertNotRevoked()`（名单同步机制留给 M5）
- [x] 测试：用 `available-inventory` 真实产物验证 ABI 往返（两行 `[7,7]` 合计 14；单行负数也正确）
- [x] 测试：哈希不符、闸 1 不过、**真实死循环超时中断**、输出超限、命中吊销，五类拒绝路径

## Phase 4: 审计、权限与接入

- [x] 每次调用写审计（成功与失败都写；含 atomicType / moduleSha256 / 行数 / 耗时 / 调用方 / 结果 / 失败原因）
- [x] 权限校验：契约声明的 `permissions` 做 **all-of** 校验（JWT 权限点 × 契约声明；与静态 any-of 的 `PermissionsGuard` 语义不同，区别写在代码注释里）
- [x] REST API：`GET /api/atomic-contracts`、`POST /api/atomic-contracts`、`POST /api/atomic-contracts/import`、`POST /api/atomic-contracts/:type/invoke`
- [x] 错误码 → HTTP 状态码映射（`toHttpError`：404 / 400 / 422 / 504 / 501，绝不把失败变成 200 回退）
- [x] `module-registry` 支持 `dependsOnAtomics`（`atomicType@range`），模块发布（status=active）时逐条 `resolve` 校验；**一次列出全部缺失项**而不是遇到第一条就停
- [x] 前端调用示例（`speckit/src/lib/api/atomic.api.ts`，含"失败不回退"的使用说明与投影字段约定）
- [x] E2E：HTTP 登记契约 → 绑定真实模块 → **经 HTTP 调用** → 结果正确 → 审计落库可查

## Phase 5: 硬化

- [x] 吊销名单同步机制（本地文件 + **版本单调防回放** + 解析不动即拒且保留上一版；每次调用前同步）
- [x] 实例缓存 + Worker 池（**先压测再调优**：缓存 Worker 与已编译模块，每次调用新建内存与实例；超时则终止并摘除该 Worker）
- [x] 评估 Wasmtime sidecar 以获取 fuel 计费与 epoch 中断（结论：**v1 不引入**，给出 3 条触发条件与代价清单，写入 `design.md` 的"Wasmtime 评估"节）
- [x] 文档：更新 `docs/TECH_STACK_GAP.md`（WASM 沙箱 🟡→✅、C 组划线）与 v3 设计文档（§14.2 差距 #1 标为已落地、#11 更新为"宿主运行时已就位"）
