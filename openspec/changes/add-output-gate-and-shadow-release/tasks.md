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

- [ ] `wasm-modules/modules/leaky-output-bits/`：把常量塞进输出高位（用于 O2 / S1）
- [ ] `wasm-modules/modules/leaky-order-channel/`：让输出取决于行序（用于 O4 / O5）
- [ ] 两者都必须**通过**闸 0/1/2（它们不违规导入、可复现构建）——这正是闸 3 存在的理由
- [ ] 产物与清单进入 `wasm-modules/build/manifest.json`

## Phase P3: 闸 3 实现

- [ ] `backend/src/atomic-runtime/output-gate.ts`：纯函数实现 O1–O5 + S1，输入是"契约声明 + 输入 + 单条结果 + 批量结果"
- [ ] 执行链接入：执行完成 → 闸 3 → 返回；命中判决抛出带 `reason` 的错误码，**不返回任何结果**
- [ ] 审计：记录档位、判了哪几条、**未判哪几条**（如未声明 `commutative` 时的 O5）、S1 报告、实际内核回合数
- [ ] 预算：闸 3 追加的执行必须计入同一 `cpuBudget`，不得放宽
- [ ] 每条判据的负例：O1 多列/缺列、O2 越界、O3 超上限、O4 批量≠单条、O5 置换后汇总变了
- [ ] 反例（必须**不**报错）：空输入、全 0 输出、未声明 `commutative` 的原子行序变化

## Phase P4: 闸 4 实现

- [ ] `backend/src/atomic-runtime/shadow-release.ts`：证据门表 + 状态机回溯（`assertPromotable(from, to, evidence)`）
- [ ] `bindImplementation` 接入：`status: 'active'` 必须能回溯出完整证据链；跳级与缺证据各给独立原因码
- [ ] 迁移路径：为既有 `active` 实现提供一次性补录（或显式标记"早于闸 4"），不允许静默放行
- [ ] jest：跳级、缺证据、自证（请求体里塞字段冒充证据）、正常晋升、吊销不受闸 4 限制

## Phase P5: 端到端

- [ ] e2e：`leaky-output-bits` 模块经真实 HTTP 调用 → 被闸 3 拦下，审计留痕，**未返回结果**
- [ ] e2e：合规模块 `tested → shadow → canary → active` 全链晋升后调用成功
- [ ] e2e：`tested → active` 直接绑定被拒（错误里指出缺 `shadow` / `canary` 证据）
- [ ] 文档：`docs/META_LANGUAGE.md` §3.3 闸表把闸 3 / 闸 4 从 ❌ 改为 ✅，并在变更记录里加一行
