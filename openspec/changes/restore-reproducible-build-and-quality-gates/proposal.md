# Change: 收紧现有构建拓扑、CI 门禁与交付证据

## Why

顺序 **03**；优先级 **P0（必需工程证据与交付阻断）**；前置 `refactor-ai-native-control-plane-boundaries`。重新审查基线为 **weichen / `ce1e538dcec6539f66bba80d5413a3b6741486c9`**，文档分支 `weichen-ai-native-remediation-20261110` 分支。本提案只规划剩余缺口，不 apply，不把 main 的构建诊断、测试数量或离线复现作为本基线实测。

### 已实现与剩余证据

| 复核结论 | weichen 实际证据与消费者 | 本 change 取舍 |
|---|---|---|
| 旧“三内核漏建”已修 | `.github/workflows/ci.yml:169–176,240–247` 构建 shared-core、release-kernel、agent-kernel 和平台库；`package.json:21,44` 根构建也已补齐 | 删除再次补建三库任务；仅验收现有顺序并改为可验证拓扑 |
| 实际 owner 已迁移，但直接依赖与缓存闭包仍需补 | `libs/agent-tools/package.json:16–19` 与 `libs/platform-release/package.json:18–20` 已声明内核依赖；API 的 `agent-sessions/agent-sessions.service.ts:5`、`agent-feedback/agent-feedback.service.ts:6` 仍直接 import agent-kernel，`apps/api/package.json:84–88` 未声明它；`nx.json:4–13` 无显式 `^build`、根锁/工具链输入闭包 | 不重做七项目或现有拆分；只校验现有 apps/libs 图、直接依赖、outputs、输入失效 |
| error 和 browser 范围已实现；入口及目录级保证不完整 | `eslint.config.js:50–61` 已 error；`package.json:32` 已含 apps 的 ts/tsx；`scripts/meta/check-all.mjs:19–25` 已含图 checker。其判据 `scripts/meta/lib/boundaries.mjs:92–117,124–169` 只看项目边且空结构可变成零项目；无同项目 domain/infra 解析路径规则 | 删除“升 error/首次覆盖前端”任务；保留实际 CI 强制接线、图完整性和内部路径拒绝集 |
| 新统一流水线存在但未成为 GitHub CI 真源 | `scripts/ci/pipeline.sh:1–9` 已 set -e 和严格 check:all，却未构建生产者/前端或跑真库/browser；`.github/workflows/ci.yml:307–309` 仍调用 `package.json:27` 的 warn-only check:ci，没有调用 pipeline | 收敛入口到共享必需阶段与最终聚合决定，不另造第二套流水线 |
| RLS 必测仍可能空跑 | `.github/workflows/ci.yml:252–288` 已有重建/schema 前置并纳入 RLS；`apps/api/test/rls.e2e-spec.ts:51–55,96–97,130–131` 捕获角色/表等异常后 early return | 保留现有重建路径，required 模式传播前置错误并核对实际 case/断言；不宣称本次突破 RLS |
| schema 清单生成器的新 owner 闭包不正确 | `scripts/meta/schema-manifest.typeorm.mjs:24–43` 只扫描 apps/api 并匹配实体装饰器；`apps/api/src/users/user.entity.ts:1–2` 为兼容 re-export，真实实体在 `libs/platform-core/src/users/user.entity.ts:7–8`；生产注册来自 `apps/api/src/app.module.ts:90` 的 `APP_ENTITIES` | 接真实注册元数据而非扫描兼容壳；现有 `verify-from-zero.ts:36–60,82–88` 的真库差异检查继续复用，验证其实体集合与生产一致 |
| 缓存搬迁不是接口修复 | `apps/api/src/app.module.ts:81` 装配 `apps/api/src/cache/cache.module.ts:22–32` 的旧 store 与静默 memory；服务壳转到 `libs/platform-core/src/cache/cache.service.ts:12–27`。组织服务实际读写并精确删除，TTL 调用为 `300`（`organizations.service.ts:43–65,89–90,114–118`）；该 API 直接传 TTL。`invalidatePattern:57–61` 空实现未找到生产调用者 | 修兼容 Keyv stores、driver/TTL 与双实例精确删除；不强造 namespace generation 系统，未支持 pattern 明确拒绝即可 |
| 测试证据已新增，但仍是可自报的新鲜记录 | `scripts/ci/record-test-evidence.mjs:18–48` 摘要 JSON、记录 SHA，缺 token 时只保存本地；`libs/platform-release/src/releases/releases.controller.ts:92–106` 接 body 的摘要/时间/ranBy；service `release-test-evidence.service.ts:27–46` 保存并仅按 org/app/时间查；G4 `release-validation.service.ts:145–155` 见记录即 passed，或禁执行也 passed | 扩展既有证据/端口而非重造：受控 runner、同 subject、实际套件与断言、原工件摘要；旧记录仅诊断，不可生产放行 |
| 完整 Next build 已进 CI，浏览器证据尚未闭环 | `.github/workflows/ci.yml:188–189` 构建两个 Next app；`apps/*/next.config.ts:6` build 忽略 lint，必须独立门禁。已有 `tests/locale-routing.e2e.js:4–5,12–20,65–83` 使用 dev servers/外部 Playwright 回退及部分 SSO mock，未被 CI 调用 | 保留双 app build 和路由用例；补锁定浏览器、已构建工件及真实 API 基础冒烟，mock 子集单独标记 |
| 宿主构建/健康方法存在，交付链仍缺绑定 | CI `wasm-host` job 已上传目标工件；arm64 cross 只 build（`.github/workflows/ci.yml:104–126`）。`libs/platform-release/src/atomic-runtime/wasmtime-sidecar.client.ts:79–90` 已有 hello/ping health；`atomic-runtime.module.ts:44–55` 缺 binary 只记日志；`apps/api/src/health/health.controller.ts:24–32` 仅存活；`.github/workflows/release.yml:21–47` 仅发标签说明 | 只接现有引擎到能力 readiness 和同 SHA 工件清单；标签说明不是部署授权，不推断存在生产部署旁路 |
| npm 约定仍有模板残留 | 根跟踪 `bun.lock`，`package.json:2` 仍 everythingclaude；两个前端声明 Clerk，但对应 apps/libs 的 TS/TSX 未发现 Clerk import | 审批消费者清单后清理；保留 Cargo.lock，不盲升框架主版本 |

以上实现判断以静态调用链为主。仅运行边界纯函数的既有离线测试（15 tests、15 pass、0 fail）和语法检查；它们不证明真实 Nx 图、完整 CI、冷构建或生产运行。未安装依赖、未连接 PG/Redis/模型、未启动服务或浏览器，实际运行/部署版本未知。

## What Changes

1. 在当前 apps/libs 结构上校验直接依赖与 build 图，声明完整 outputs/input 闭包，并维护唯一 JavaScript 根 npm 锁；保留已有双 Next app 与平台基座，不重新迁移目录。
2. 在已为 error 的项目边界上增加有效图/源码范围验证及同项目解析路径限制；纯业务 Kernel 保持确定性，Agent Host 可在服务端适配模型，工具只能经 Registry。
3. 复用 `scripts/ci/pipeline.sh` 与既有 GitHub jobs，定义共同必需阶段及最终聚合决定：严格契约/边界、拓扑构建、实际单测、PG/schema/RLS、完整双前端构建及真实基础浏览器冒烟。缺前置、空跑、skip 或模板不适用不产生工程 PASS。
4. 已提交 schema manifest、生产 `APP_ENTITIES` 元数据与迁移后临时 PG 三向对拍；不自动覆盖真源、不 synchronize 修库凑绿，保留既有狭窄默认值等价判据。
5. 缓存接当前锁定 cache-manager 7/Nest cache 3 的 Keyv stores，明确 redis/memory、毫秒 TTL、双实例精确删除与断连结果；不把未使用 pattern 空函数膨胀为新平台能力。
6. 扩展既有 `ReleaseTestEvidenceService` 和 CI JSON 记录器为可信 subject-bound 工程证据，G4 不再采信任意“新鲜记录”或禁执行的 passed；真实 G4/G5/预览总决策由09消费，本 change 不重写完整发布门禁。
7. 平台重算同 SHA 的 API/双前端、Rust 目标 binary、原子 manifest/module 与迁移摘要，消费必需测试证据；新增能力 readiness 复用现有 Wasmtime health。未测试目标/缺工件拒交付，发布说明与可部署授权分离。

## Impact

- 能力：`workspace-architecture`、`delivery-verification`。两者不在当前正式 `openspec/specs` 中；这里使用独立具体 **ADDED** 条款，不对 pending change 冒用 MODIFIED。
- 预期实施 owner：根 `package.json`/`package-lock.json`/`nx.json` 与当前 apps/libs 配置；`scripts/ci/*`、`scripts/meta/*`、`.github/workflows/*`；`apps/api/test/*`、`apps/api/scripts/verify-from-zero.ts`、`apps/api/src/cache/cache.module.ts`、health 装配；缓存在 `libs/platform-core`，证据及引擎在 `libs/platform-release`；双 Next apps 与现有路由测试。
- **BREAKING**：required CI 不再容忍 warn-only、缺真实前置/必測 case/可信证据；声明 Redis 不能静默 memory；旧 test-evidence 可诊断但不能授权 G4。业务 API、Blueprint/Delta、金额库和 WASM ABI 不改。
- 锁文件静态版本：Next 15.5.12、React/ReactDOM 18.3.1、Nest core 10.4.22、TypeORM 0.3.28、Nx 24.0.2、Nest cache 3.1.3、cache-manager 7.2.8。不是部署实测；Keyv Redis adapter 与浏览器依赖在批准实施时新增并锁定，禁止本次安装。

### 既有 changes 与依赖

`adopt-nx-workspace-and-boundaries`、`refactor-app-workspace-split-and-platform-base` 的物理拆分、platform tags、error 与图 checker 已有实际代码；本提案仅收紧其未兑现的构建/CI/目录验收，不再次实现这些能力。`add-meta-contracts-and-checkers` 的四契约和提交 manifest、`restore-green-backend-tests` 的全量入口、`add-wasmtime-host` 的 ABI/隔离/health 均继续复用；实施归档时由整合者消解旧 warn-only/旧目录场景，不修改它们的完成状态。本次不更新权威 docs 或台账。

执行前置只有00架构契约。旧 pending changes 的并行整合是兼容检查点，不强加待归档依赖。04/05可以消费拟定工程证据接口并隔离开发；06汇合安装与制品；07/08样板的真实浏览器联合验收后置，不能阻断前段隔离开发。09消费本 change 工程证据并完成真实候选评测与最终发布判断；10只在09验收后讨论 A1、再有限 A2。

### 不做什么与验收出口

不改业务代码、不 apply/archive、不启动/部署/迁移。本提案不换 Next/React/Nest/TypeORM/Nx/npm，不拆微服务/Kubernetes，不扩 Rust 到业务域，不恢复旧 workflow，不重造 PG jobs/identity/data-scope、安装事务、Blueprint/Delta 或单一金额库。缓存不得成为权限、审批、有效版本、业务事实或幂等真源。

退出需在批准后的干净隔离环境实际获得：根 npm ci 与双 app 拓扑 build；缓存失效闭包；真实 lint/图/目录/契约负例非零；迁移 ledger/元数据/PG/RLS 正负断言；Redis 双实例读写/TTL/精确删除/断连；锁定浏览器针对双 Next 原工件的基础真实链；目标原生或批准等价环境的 Rust 执行证据与清单/readiness 拒绝集。报告包含 subject、实际版本、预期/实际套件与 case 集合、逐例实际断言、失败/skip、原始日志摘要、原工件摘要和 runner 来源。

冻结 `candidateDigest` → 真实测试/评测 → 独立审批 → 签名但未公开工件 → 最终 GateDecision → published → activation。03仅提供工程部分的证据和工件绑定，不要求先 published 才能测试；没有09真实评测/总门禁不得放行生产新发布或自治，已有稳定安装可继续确定性运行。OpenSpec strict 通过只证明文档结构，不代表上述实施已完成。
