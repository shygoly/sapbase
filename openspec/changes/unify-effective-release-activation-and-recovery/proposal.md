# 变更：统一实际 Release 生效、安装路由与可恢复回退

## Why

本提案重新审查基线为 **weichen `ce1e538dcec6539f66bba80d5413a3b6741486c9`**，文档分支为 `docs/weichen-ai-native-remediation-20261110`。旧 main 评估只用于问题候选，不作为本次实测。新基线已把 Release 实现迁入 `libs/platform-release`；`apps/api` 保留装配/兼容导出。已有安装事务、行锁、追加修订、回退重载摘要检查、可信安装守卫、PG jobs、编译缓存以及真实蓝图 UI consumer 均予以保留，不再提出重建这些能力。

仍需整改的是“发布目录里的 active”尚未成为“安装和用户实际执行的定义”：`libs/platform-release/src/releases/releases.service.ts:371–440` 不更新安装修订，`:474–480` 只取最新 active；`apps/api/src/business-apps/business-apps.service.ts:270–288` 的上下文不含版本；`apps/api/src/semantic-runtime/semantic-runtime.service.ts:2103–2105` 仍按传入包 ID 装载。新 UI 确实已经接入路由，但 `apps/web-portal/src/app/dashboard/apps/[packageId]/[[...page]]/page.tsx:1–13` 与 `libs/ui-runtime/src/blueprint/BlueprintAppRuntime.tsx:130–169,250–253` 都沿 URL 包 ID 调用定义和记录接口。因此不是“没有 UI”，而是它尚未消费安装有效版本。

## What Changes

1. 将可信不可变 Release 描述映射到既有安装修订，分开目录摘要、包字节摘要和 IR 摘要。特别是当前安装 `releaseDigest` 实际来自 `loaded.plan.irDigest`（`apps/api/src/business-apps/business-apps.service.ts:334–344`），不能把旧字段重新解释为包或目录摘要。
2. 在现有安装事务基础上增加唯一切换协调器；Release activate/rollback 与安装 install/upgrade/rollback 均委托同一平台操作，旧路径不再形成第二个版本写入口。
3. **BREAKING**：版本变更请求必须提交 `Idempotency-Key`、调用方观察到的 `expectedRevisionId` 和涉及路由时的 `expectedRoutingRevision`。首次安装以“期望不存在”为明确基线；恢复暂停安装不等于切版本。
4. API、现有 Blueprint UI、Registry 适配器及 Agent 接口消费服务端解析的有效 `ReleaseContext`；URL 包 ID 仅用于兼容定位/核对，不能选择另一已授权但未生效包。现有 tenant/app/permission/data-scope 检查继续生效。
5. 显式、互斥、稳定的 cohort 路由及请求/turn pin；不从 latest activation、自报 cohort 或进程随机数决定版本。预览走隔离候选 namespace，不建立生产有效绑定。
6. **复用** `libs/platform-core/src/jobs` 的入队、领取、租约和事件原语，新增 Release 白名单 handler、操作请求摘要及提交回执；不新建并行任务队列。幂等命中和恢复仍须授权，指针、修订、activation 事实、ReleaseEvent、Outbox 与回执同事务提交。
7. 当前安装到目标的迁移 ledger、方向性兼容证据和受控补偿；缺证据拒退且保持当前 active。定义回退、数据补偿和代码镜像回滚分离。

## Impact

### 优先级、依赖和现有 changes

顺序 **06**，优先级 **P0：实际生效与回退安全**。依赖 `enforce-deterministic-business-command-invariants`（04，共享确定性命令和可靠事件消费）及 `harden-approved-release-artifact-integrity`（05，冻结候选、批准、签名和不可变制品接口）。安装/PG jobs/身份/data-scope 是此基线资产，不要求重新实现；04/05/06 可先在隔离环境按契约开发。

`release-lifecycle` 与 `business-app-platform` 目前仅存在于 pending changes，正式 `openspec/specs` 尚无这两个能力。故本次只用 **ADDED 独立接线/验收条款**，不以 MODIFIED 替换不存在的正式原条款。`add-release-lifecycle-and-activation` 的生命周期、唯一默认 active、追加回退、changelog 和追溯基础，`refactor-ai-native-business-app-platform` 的安装/可信上下文/RLS/跨应用边界，以及 `add-async-job-and-callback-facade` 的 PG 队列均不重造。旧任务勾选不是本次执行证据，也不修改其状态。

旧 pending 条款中的“第二个非 cohort active 被拒”继续约束非法双活；合法切换是一次事务替换唯一默认绑定，不先撤旧再试目标。原 activation 事实不改，通过绑定/状态投影解释当前状态。`release.enabled=false` 的兼容含义需在批准实施时同步收窄：已验证稳定安装可运行，旧 install/upgrade/rollback 仅经同一安全适配器处理；开关不能恢复无证据版本变更。已有 `add-blueprint-ui-runtime-consumer` 保留 list/form/detail 与权限渲染判据，本次仅接版本解析，不重建 UI，完整人机工作台归08。

07保存并传递本次 pin；08消费版本化定义和切换冲突；09提供冻结候选真实评测/预览/G3证据及最终门禁。**生产新发布、切换和 A1/A2 的放行必须满足实际必需证据，尤其09尚缺的真实评测不能由文档或本次校验代替**。流程是 `candidateDigest → 真实测试/评测 → 审批 → 签名未公开工件 → 最终 GateDecision → published → activation`；候选迁移验证不要求先 published，不形成依赖循环。稳定安装继续按其已验证绑定确定性运行。10的策略只能调用本次协调器，本次不实现A2指标或晋级策略。

### 新基线证据与取舍

| 新基线路径 | 事实及本次取舍 |
|---|---|
| `apps/api/src/app.module.ts:97–108,124–137`；`apps/api/src/releases/releases.module.ts:51–119` | 实际装配 platform-release、BusinessApps、jobs 与 Agent 消费者；不能审旧 backend 副本代替 |
| `apps/api/src/business-apps/business-apps.service.ts:394–435,537–548` | 已有事务/安装锁/服务端观察修订比较/目标 IR 摘要重验；保留，仅增加调用方预期基线及有效 Release 关联 |
| `libs/platform-release/src/releases/releases.service.ts:443–470` | 目标 published 检查在旧状态更新之后，且不核验当前数据路径；不过 HTTP 有全局 tenant transaction，不能复用旧离线结果宣称 HTTP 必然留下空 active |
| `libs/platform-core/src/common/transaction/tenant-transaction.interceptor.ts:35–40`；`with-tenant-context.ts:23–35` | 已有 HTTP 环境事务与 RLS 上下文。新增协调器须对 worker/内部调用同样显式保证短事务，不笼统声称当前所有调用无事务 |
| `libs/platform-release/src/releases/release-idempotency.service.ts:38–63`；`releases.controller.ts:208–252` | 新实现已有 Redis，但依然先读缓存、完成后 SET/Map；无进行中占位和请求摘要，控制器把调用者 key 包成 succeeded jobId；静态未证实真实并发失败 |
| `libs/platform-core/src/jobs/job-queue.ts:69–109,216–280`；`jobs.module.ts:16–37` | PG唯一幂等、可传 EntityManager、SKIP LOCKED和租约已经存在；新增 Release handler 与同事务回执，删除旧设计的专用平行 job 表 |
| `libs/platform-release/src/blueprint/blueprint.service.ts:53–128` | 已有 tenant/exemption 缓存和文件变化失效，不是完全没缓存；有效上下文缓存仍需安装/路由/不可变摘要 namespace |
| `apps/api/src/agent-sessions/agent-sessions.service.ts:50–108` | 轮次从 latest active 得 release，保存 contextHash 后执行只传 org/actor/permissions；本次提供 pin 接口，07负责完整模型/会话传递 |

### 非目标与兼容风险

不改业务代码、权威 docs、正式 specs、台账或旧 pending change；本文及 tasks 均为未实施规划。不替换 Next/React、Nest、PG/TypeORM、Nx/npm，不引入新流程、Delta、金额库或 WASM command/effect；不把 Jev 引入确定性 Kernel。Registry 仍为工具唯一入口，平台仍拥有授权/有效版本/发布判定。部署、迁移和归档均不在本次执行范围。

旧同步安装响应变更应有明确 API 弃用/客户端升级方案，不能声称完全兼容；历史安装可重载且 IR 一致也不自动证明它拥有可信 AppRelease 目录记录。对账唯一可信映射可追加关联，不篡改历史；已验证 legacy 稳定包可保持受控运行，缺映射的新切换必须拒绝。兼容窗口、job保留期和路由政策由负责人批准，不复制无依据的24h A2窗口。

### 验收出口

必须在授权的隔离真实 PG 环境实测：同一用户激活v2后安装修订、API定义/记录、现有UI请求、Registry与Agent上下文解析结果摘要一致；旧 URL、跨安装目标和伪造 cohort 在副作用前拒绝。并发同 key、异参同 key、撤权重试、进程重启、租约接管和提交前后断点只能产生一次逻辑切换；Outbox故障不能分裂指针/回执，投递失败不重做切换。实际当前数据代际、脚本摘要和方向性兼容证据须覆盖安全升级/回退及破坏性/部分迁移拒退。灰度双版本共用数据必须证明读写共存，预览不得生产写，旧pin写明确冲突。

记录 SHA、制品/候选摘要、套件版本、实际 case/断言、失败/skip、PG角色与版本、迁移ledger、浏览器版本及请求证据；跨change真实模型联验另记provider/model与实际调用，不以确定性fixture冒充模型。现有根 `npm run ci`、`npm run e2e` 和 API `test:e2e` 已存在，但目录演练脚本不能代替有效版本/故障矩阵；专用 `test:release-activation-e2e` 与 `test:release-context-browser` 是**待新增**命令。本次仅静态阅读和该change OpenSpec严格校验，不跑真库/Redis/模型/browser、不宣称已通过或已利用；strict validate只证明提案格式。
