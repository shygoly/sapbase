# Implementation Tasks

## 里程碑与验收门

| 里程碑 | 范围 | 验收门（命令 + 期望） |
| --- | --- | --- |
| **P0** 基线修复 | 迁移集补 `users` 基线与实体对齐 | 从空库跑完迁移不报错；`GET /api/module-registry/:id` 等既有接口的 e2e 通过 |
| **P1** 判据冻结 | 闸 3 判据文本 + 契约 Schema 扩展 | `openspec validate --strict` 通过；Schema 正例通过、负例（越界 range / 未知档位）被拒 |
| **P2** 泄漏样例 | 故意泄漏的 Wasm 模块 + 构建产物 | `wasm-modules` 全部测试通过；样例如实被闸 1 放行（它不违规导入，只是在**值**上做手脚） |
| **P3** 闸 3 实现 | 四条判决 + 一条信号 | jest：O1–O5 每条各有正例与负例；命中判决时**不返回**结果且审计留痕；S1 只写审计 |
| **P4** 闸 4 实现 | 证据门 + 状态机门 | jest：跳级被拒、缺证据被拒、正常晋升通过；`bindImplementation(active)` 绕过被拒 |
| **P5** 端到端 | 真实链路 | e2e：泄漏模块被闸 3 拦下；合规模块走完影子期被晋升；绕过晋升直接 active 被拒 |

### 执行约定

1. 每完成一项：勾选 + 附证据（命令 + 结果），不写"应该可以"。
2. 协议先行：P1 未完成不进 P3/P4（判据文本是实现的唯一依据）。
3. fail-closed：闸 3 命中判决即**不返回结果**；闸 4 缺证据即**不绑定**。没有"警告后放行"。
4. 每个里程碑结束跑一次全量回归（单元 × 两引擎、e2e、`wasm-modules`、`tsc`）。

## Phase P0: 基线修复（前置）

- [ ] 核实并写下事实：仓库迁移集里**没有**任何迁移创建 `users` 表（`rg "name: 'users'" src/migrations/` 无结果），
      本地库的 `users` 是早期形态（`roleId` / `departmentId`），与 `User` 实体声明的
      `role` / `department` / `permissions` 不一致
- [ ] 补 `users` 基线迁移（含 `roles` / `departments` 外键列），并让迁移在**已有旧表**的库上也能跑通（幂等：存在即跳过/对齐）
- [ ] 验证"从零重建"：在空库上跑完全部迁移不报错，且 `synchronize: false` 下 TypeORM 能加载全部实体
- [ ] 回归：`GET /api/module-registry/:id`、`:id/capabilities`、`addCapability` 的 e2e 通过（当前它们在真实库上直接 500）
- [ ] 把 `backend/src/module-registry/module-registry.service.ts` 里的**窄查询**还原为 `findOne()`，
      或写明为何保留窄查询（两条路都要留下理由，不允许"改完就忘"）

## Phase P1: 判据冻结

- [ ] `docs/protocols/atomic-output-audit.md`：判别表（O1–O5 判决、S1 信号）+ **明确的不判清单** + 档位语义
- [ ] `schemas/atomic-contract.schema.json`：新增可选 `outputAudit`（`off` / `standard` / `strict`，默认 `standard`）、
      输出行可交换性 `commutative`、逐列可选 `range`
- [ ] 负例覆盖：未知档位 / `range` 越界或倒置 / `commutative` 与"输出含汇总位"组合的矛盾声明
- [ ] `shared-schemas` 暴露类型（只类型、不判定），并按既有约定重建 `dist`

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
