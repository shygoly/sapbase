# Implementation Tasks

## 里程碑与验收门

| 里程碑 | 范围 | 验收门（命令 + 期望） |
| --- | --- | --- |
| **P0** 基线修复 | 迁移集补 `users` 基线与实体对齐 | 从空库跑完迁移不报错；`GET /api/module-registry/:id` 等既有接口的 e2e 通过 |
| **P1** 判据冻结 | 闸 3 判据文本 + 契约 Schema 扩展 | `openspec validate --strict` 通过；Schema 正例通过、负例（值域倒置 / 未知档位）被拒 |
| **P2** 泄漏样例 | 故意泄漏的 Wasm 模块 + 构建产物 | `wasm-modules` 全部测试通过；样例如实被闸 1 放行（它不违规导入，只是在**值**上做手脚） |
| **P3** 闸 3 实现 | 四条判决 + 一条信号 | jest：O1–O5 每条各有正例与负例；命中判决时**不返回**结果且审计留痕；S1 只写审计 |
| **P4** 闸 4 实现 | 证据门 + 状态机门 | jest：跳级被拒、缺证据被拒、正常晋升通过；`bindImplementation(active)` 绕过被拒 |
| **P5** 端到端 | 真实链路 | e2e：泄漏模块被闸 3 拦下；合规模块走完影子期被晋升；绕过晋升直接 active 被拒 |

### 执行约定

1. 每完成一项：勾选 + 附证据（命令 + 结果），不写"应该可以"。
2. 协议先行：P1 未完成不进 P3/P4（判据文本是实现的唯一依据）。
3. fail-closed：闸 3 命中判决即**不返回结果**；闸 4 缺证据即**不绑定**。没有"警告后放行"。
4. 每个里程碑结束跑一次全量回归（单元 × 两引擎、e2e、`wasm-modules`、`tsc`）。

> **P0 证据（2026-09-25）**：
> 空库路径 `DB_NAME=sapbase_baseline_probe npx ts-node --transpile-only scripts/run-targeted-migration.ts --group=baseline`
> → 建出 `users`（首次失败：`function uuid_generate_v4() does not exist`，补上扩展安装后通过，
> 这正是"从零重建"才会暴露的问题）；`--revert` → 表被删除。
> 旧库路径：本地 `sapbasic` 应用后 e2e 断言通过 ——
> `jest --config ./test/jest-e2e.json test/blueprint-pipeline.e2e-spec.ts` → **3 passed**
> （其中「模块注册表的既有查询在真实库上可用」此前是 500）。
>
> **P1 证据（2026-09-25）**：`jest src/atomic-registry` → **57 passed**（新增 7：三档位正例、未声明可选、
> 未知档位被拒、`commutative` 正例、值域倒置被拒、汇总位重名被拒）。
> 改动过程中踩到一次自己造的坑并已修：编辑 `schemas/atomic-contract.schema.json` 时多删了一个 `}`，
> 结果是**整个原子注册表的用例一起失败**（Schema 解析不了）——这正是"协议文件是判定的唯一真源"的代价与证据：
> 一处协议坏了，判定层全停，而不是悄悄少判一条。
>
> **P2 证据（2026-09-25）**：`WASM_BUILD_ISOLATION=host node scripts/admit-cli.mjs --source modules/leaky-*-rust …`
> → 两个夹具均 `ok: true`（闸 0/1/2 放行），产物入库：
> `leaky-output-bits` `sha256=d29eac7a…` / 272 B；`leaky-order-channel` `sha256=025b9fe3…` / 281 B。
> `node --test scripts/leaky-fixtures.test.mjs` → **5 passed**：三张表结构一致（tier A / abi 1 / 只有 env.memory）、
> 源码复现构建逐字节一致，且用 Node 的 WASM 引擎实跑证明
> 「夹具一输出的高位恒为 `0x5EC00000`、低 21 位是正确的 7」与
> 「夹具二同一行在批量里（`100 ^ 0x10000`）与单独算（`100`）结果不同」。
> 全量：`wasm-modules` **58 passed**（53 + 5）。
>
> **P3 证据（2026-09-25）**：`jest src/atomic-runtime/output-gate.spec.ts` → **27 passed**
> （O1–O5 各有正例/负例/未判，S1 信号，`gateDeclarationOf` 缺省语义，多条命中时取编号最小）；
> `jest src/atomic-runtime/output-gate.integration.spec.ts` → **5 passed**（真实夹具产物）：
> 合规模块 `rounds=3`、O4 判过、O5 如实记「未判」；夹具一 → `OUTPUT_OUT_OF_RANGE` + `atomic.output.O2`；
> 夹具二 → `OUTPUT_BATCH_INCONSISTENT` + `atomic.output.O4`（明细含"第 1 行、批量算、单独算"）；
> `outputAudit: off` → `rounds=1` 且 O4 记「未判」，O2/O3 照判。
> `jest src/atomic-registry src/atomic-runtime` → **159 passed × 两引擎**；e2e 6 passed；tsc 0。
> 一处边界说明：**O5 的"声明可交换却被违反"在集成层面被 O4 先命中**（顺序通道必然同时违反两条），
> 所以 O5 只在纯判据测试里有独立用例 —— 这不是跳测，是"两条判据的触发条件天然重叠"。
>
> **P4 证据（2026-09-25）**：`jest src/atomic-registry/shadow-release.spec.ts` → **35 passed**
> （正常全链 5 步 / 跳级 4 例 / 终态复活 / 回退 / 缺证据逐条列出 / 差异未审查 / 补录 / 吊销不受限）；
> 服务层全链（不是只测纯函数）：`jest src/atomic-registry` → **98 passed**，其中
> 「逐级带证据 → 一路走到 active」「影子记录为空 → 卡在 tested」「吊销不受限」「补录只能做一次」。
> 存量补录 SQL 在探针库上验证过（造一条 `status='active'` 的实现 → 再跑迁移 →
> `releaseEvidence.grandfather = {reason, decidedBy: 'migration-1790800000000', at}`）。
> 全量：单元 **305 × 两引擎**、e2e 6、tsc 0；本地 `sapbasic` 已应用 5 个原子分组迁移。
>
> **一处刻意的范围收窄**：`isReleasableStatus` 说的"影子只算不发"在本变更**未接**——
> 那需要影子运行器与调用方身份区分，属影子编排那条线；本变更只做**证据门**。
> 记在这里而不是假装已覆盖。

## Phase P0: 基线修复（前置）

- [x] 核实并写下事实：仓库迁移集里**没有**任何迁移创建 `users` 表，本地库的 `users` 是早期形态
      （`roleId` / `departmentId`），与 `User` 实体声明的 `role` / `department` / `permissions` 不一致
- [x] 量化"从零重建"的真实规模：**30 张实体表里 15 张没有任何迁移创建**（清单写进 `proposal.md`）。
      因此 P0 收敛为可验证的那一半；其余 14 张 + 扩展/索引**明确留给后续变更**
- [x] `1790600000000-AddUsersBaseline`：空库建表 / 旧库补列，**只做加法**（`roleId` / `departmentId` 一律保留，
      删列不可逆）；空库路径还要自己装 `uuid-ossp`（其余迁移都假设它已存在）
- [x] 定向迁移运行器：`scripts/run-atomic-migration.ts` → `scripts/run-targeted-migration.ts`，
      按分组（`atomic` / `baseline`）应用，避免"要么全跑要么不跑"
- [x] 回归：`modules.findOne()`（含 8 个关系）与 `addCapability` 在真实库上通过 —— 见
      `test/blueprint-pipeline.e2e-spec.ts` 的「模块注册表的既有查询在真实库上可用」
- [x] 窄查询的去留写明：缺口修完后**保留**窄查询，并在代码注释里说明这是选择而非绕过

## Phase P1: 判据冻结

- [x] `docs/protocols/atomic-output-audit.md`：判据表（O1–O5 判决、S1 信号）+ **明确的不判清单** + 档位语义 + 结果形态
- [x] `schemas/atomic-contract.schema.json`：新增可选 `outputAudit`（`off` / `standard` / `strict`，默认 `standard`）
      与 `output.commutative`。**值域复用既有的 `minimum` / `maximum`** —— 不新增 `range`
      （元语 §6：不另造同义词）
- [x] 跨字段判据进校验器：`validateContractConsistency`（值域倒置、汇总位与列同名），
      与蓝图校验器的 `validateManifestConsistency` 同一套路；`validateAtomicContract` = 形状 + 一致性
- [x] 负例覆盖：未知档位（形状）/ 值域倒置（跨字段）/ 汇总位重名（跨字段）；正例覆盖三个档位与 `commutative`
- [x] `shared-schemas` 无需改动：原子契约类型本就不在那里镜像（核对过 `shared-schemas/src/v1/`），
      因此没有"改了类型忘了重建 dist"的风险

## Phase P2: 泄漏样例模块

- [x] `wasm-modules/modules/leaky-output-bits-rust/`：`available[i] = 正确值 | 0x5EC00000`
      （编译进代码的常量塞进高位，**汇总位刻意保持干净**，便于判定"哪一列被污染"）
- [x] `wasm-modules/modules/leaky-order-channel-rust/`：`available[i] = 正确值 ^ (i << 16)`
      （行下标进高位 —— 批量与逐条结果不同）
- [x] 两者都**通过**闸 0/1/2（零能力、无导入、可复现构建、只导出 `run` / `abi_version`）
      —— 这正是闸 3 存在的理由；产物与清单已进入 `wasm-modules/build/manifest.json`
- [x] 证据可独立复核：`scripts/leaky-fixtures.test.mjs` 既做源码复现构建（闸 2），
      也用**真正的 WASM 引擎**跑一遍，断言它们确实在泄漏（而不是只在文档里声称）

## Phase P3: 闸 3 实现

- [x] `backend/src/atomic-runtime/output-gate.ts`：判定只有这一处实现（O1–O5 + S1），
      执行器只负责"按档位多跑几次 + 把结果交给它"；原先散在执行器里的值域/大小上限检查**已收进来**
- [x] 执行链接入：执行完成 → 闸 3 → 返回；命中判决抛错且**不返回任何结果**；
      错误同时带运行时码（HTTP 映射）与协议码 `atomic.output.OX`
- [x] 审计：`metadata.outputGate` 记录档位、逐条判定、**未判哪几条及原因**、信号、实际内核回合数
- [x] 预算：重放计入同一 `cpuBudget`（fuel 累加），报告里的 `rounds` 让"贵了多少"可查
- [x] 每条判据的正例 + 负例 + **未判**三种情形（27 项纯判据测试）
- [x] 重放上限 `GATE_MAX_REPLAY_ROWS = 64`：超出只判前 64 行并记 `rowsJudged`（确定性截断，非抽样）
- [x] **自我修正**：S1 的"恒定高位"规则被否掉 —— 任何两个小整数的高位都相同，
      该信号几乎次次触发；v1 只保留"整列同值"，并把理由写进协议文本
- [x] 集成证据：`output-gate.integration.spec.ts` 用**真实夹具产物**验证
      夹具一被 O2 拦、夹具二被 O4 拦、合规模块照常通过（两引擎各跑一遍）
- [x] 顺带修掉一个被集成测试暴露的真问题：`outputAudit` 是契约**顶层字段**，
      但实体里没有这一列 → 声明会被静默丢掉。补 `atomic_contracts.outputAudit` 列 + 迁移 `1790700000000`

## Phase P4: 闸 4 实现

- [x] `backend/src/atomic-registry/shadow-release.ts`：`checkPromotion(from, to, evidence)` —
      **状态机不在这里**（复用 `@speckit/wasm-modules` 的 `canPromote`，不抄第二份 NEXT_STATUS）；
      本模块只管证据门与安全动作
- [x] `bindImplementation` 接入：首次绑定只能落在 `submitted`（其余状态要走晋升链），
      直接给 `active` → `TRANSITION_NOT_ALLOWED`
- [x] `promoteImplementation` 接入：证据取自**实体列**（不在参数里），缺什么列什么
      （如 `shadow 差异未审查（差异 12 条，已审查 10 条）`）
- [x] 迁移路径：`1790800000000-AddReleaseEvidence` 加列 + **存量补录**（status ∈ shadow/canary/active
      且无证据的行写 grandfather 记录，`decidedBy` 标明是迁移补录）；
      `grandfatherImplementation` 另提供显式补录入口且**只能做一次**，`listGrandfathered` 可查
- [x] jest：跳级 / 终态复活 / 回退 / 缺证据（逐条列出）/ 差异未审查 / 正常全链 / 补录 / 吊销不受限
- [x] 控制面端点：`POST /api/atomic-contracts/implementations/:id/release-evidence`、
      `.../grandfather`、`GET .../implementations/grandfathered`

## Phase P5: 端到端

- [ ] e2e：`leaky-output-bits` 模块经真实 HTTP 调用 → 被闸 3 拦下，审计留痕，**未返回结果**
- [ ] e2e：合规模块 `tested → shadow → canary → active` 全链晋升后调用成功
- [ ] e2e：`tested → active` 直接绑定被拒（错误里指出缺 `shadow` / `canary` 证据）
- [ ] 文档：`docs/META_LANGUAGE.md` §3.3 闸表把闸 3 / 闸 4 从 ❌ 改为 ✅，并在变更记录里加一行
