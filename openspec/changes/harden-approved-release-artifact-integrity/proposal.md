# Change: 冻结候选、可信审批与不可变发布制品

## Why

本提案重新审查 **weichen 基线 `ce1e538dcec6539f66bba80d5413a3b6741486c9`**，不继承 main 的隔离复现结论。`apps/api/src/app.module.ts:124–137` 装配 Blueprint、Releases 与 ReleaseAutomation；`apps/api/src/releases/releases.module.ts:59–115` 注入 `libs/platform-release` 的真实服务，API 同名文件只是兼容导出。当前发布入口仍接收独立 manifest，`libs/platform-release/src/releases/releases.service.ts:300–368` 未读取提议、批准或草稿冻结记录即保存 published；审批仍以 body.role 判高风险且一次审批即写 approved（同文件 `195–246`）。这是授权发布者的治理关联缺口，不是已证明 Agent 获得发布权限或线上越权。

新基线已有服务器 Patch、UI/权限蓝图层、AI 包真实 Ed25519 签名和装载、发布目录版本唯一索引、删除拒绝及 CI 测试证据表。本 change 只补候选摘要与这些资产之间的可信绑定、完整目录签名和永久封存，不重建既有能力。

## 顺序、优先级与前置

- 顺序 05；优先级 **P0：生产新发布阻断**。
- 依赖 `fix-ai-trust-and-execution-evidence`（真实主体/组织与工具证据接口）和 `restore-reproducible-build-and-quality-gates`（同源码 SHA 的可信构建测试来源）。既有 PG identity/jobs、Registry 和 workspace 拓扑直接复用，不等待重做。
- `add-release-lifecycle-and-activation` 的基础表/状态词已有代码、tasks 标 Complete，但正式 `openspec/specs/release-lifecycle/spec.md` 尚不存在。基础条款先整合，本 change 仅 ADDED 独立加严要求，不改该 pending change 的任务状态；将其列为规格整合前置，不视为实测生产通过。
- 与 04 可隔离并行；06 消费已验证制品接口，不由本 change 改有效版本/安装事务。09 后置提供真实候选 runner 和最终 GateDecision；**不是本 change 的前置开发依赖**，但缺其必需真实证据和联合验收时生产新发布必须拒绝，避免 05↔09 循环。
- 正确次序：冻结 candidateDigest → 真实测试/评测 → 审批绑定 → 签名、持久未公开制品 → 最终 GateDecision → published → 06 activation。候选评测不要求先 published。A1/A2 自治不因本提案校验或局部实现放行。

## 当前已实现与剩余证据

| 新基线代码证据 | 当前事实与本 change 取舍 |
|---|---|
| `apps/api/src/ai-modules/definition-patch.service.ts:379–431`；`ai-modules.service.ts:247–308` | object/state/page/permission/menu 子集已有服务器应用与产包编译。只新增 AppDraft expectedRevision/CAS 与冻结关联，不另造 Patch/Delta 语法或声称只有浏览器实现。 |
| `libs/platform-release/src/blueprint/license.ts:19–63`；`blueprint.service.ts:326–362`；`loader.ts:127–175,193–259` | manifest 去 signature 的规范化载荷、真实 Ed25519、先盖章后签、缺根拒绝、许可/租户/有效期、生产未签名豁免拒绝已实现，保留回归验收。 |
| `apps/api/src/ai-modules/ai-modules.service.ts:893–920` | AI deliver 调用真实签名和 tenant load，load 成功才写 loadedAt；删除“补建 AI 签名/装载”的整改，保留冻结关联与不覆盖旧包。 |
| `libs/platform-release/src/releases/releases.controller.ts:141–205`；`releases.service.ts:195–246,300–368` | JWT/通用权限守卫真实存在，但角色由 body 传入、改 diff 可同次批准、published 不读取批准。需可信角色/不同用户/同摘要批准与唯一发布输入。 |
| `libs/platform-release/src/releases/releases.service.ts:338–352`；`libs/release-kernel/src/index.ts:61–63` | 目录 digest 仅覆盖 manifest；环境变量存在即生成 ed25519:digest 标签。只改 AppRelease 完整载荷签名，不否定 Blueprint 密码学。 |
| `libs/platform-release/src/releases/release-lifecycle.ddl.ts:68–71,149–174` | 已有平台/租户版本唯一和 Release 全状态删除拒绝；更新仅保护 old.status=published 的部分列，子项无封存保护。保留既有唯一/删除回归，补所有曾发布状态、全内容/归属和子项。 |
| `libs/platform-release/src/blueprint/blueprint.service.ts:131–141,285–309,347–359`；`packager.ts:140–141,290–291,324–325` | 同版本包写、盖章、签名仍在正式路径；新版 deliverPackage 会覆盖原包。所有产包消费者须转隔离 staging，再 digest 条件写，不只改 ReleaseService。 |
| `libs/platform-release/src/blueprint/blueprint.controller.ts:29–50,60–95,120–129` | package/out、deliver、compile(stamp) 路由只声明 JWT 守卫；装配链未见额外发布权限守卫。需平台授权签名与封存写入检查，不能让旧交付端点成为新发布旁路；未动态证明普通用户成功调用。 |
| `libs/platform-release/src/releases/release-validation.service.ts:145–176`；`release-test-evidence.service.ts:27–46` | 新增 G4 evidence 缓存和真实 Jest 路径，但 freshness 仅按 org/app/time，不核候选、commit 或 suite success；禁止将这些旧凭证直接授权新候选。runner/证据鉴真完整实现交 09。 |
| `libs/platform-release/src/release-automation/release-automation.service.ts:124–136` | 自动化仍直接向同 publish 服务传 manifest；该消费者必须受相同门禁。A2 分类/窗口/指标实现不在本主题重审。 |

以上均为静态代码/调用链证据；未运行业务 tests、HTTP、真 PostgreSQL、模型、浏览器或存储故障实验，不宣称漏洞已利用或生产通过。新 `npm run ci` 指向 `scripts/ci/pipeline.sh`（含 check:all、测试和证据登记），但 GitHub `.github/workflows/ci.yml:185–189,307–309` 仍直接运行测试及 warn-only check:ci；不能以“统一 pipeline 已存在”推断候选证据已闭环，CI 主体整改交 03。

## What Changes

1. 为已有草稿及服务器 Patch 增加原子应用、可信基线与 expectedRevision 校验；冻结完整文件、manifest、IR、实际 diff、UI/权限、固定依赖/许可、版本通道、迁移兼容及 changelog，生成不可编辑候选摘要。改变内容生成新修订并撤回旧发布资格。
2. 从平台身份/成员/权限解析作者和审批角色；Builder 记录真人发起者与 agent profile 两种来源，不能以固定 piagent-builder 或 null 避免作者分离。高风险实际 diff 推导所需能力，由不同合格真人审批；改 diff 与审批拆开。
3. **BREAKING**：现有 `POST /api/builder/releases` 仅接受 proposalId/frozenRevisionId/candidateDigest/evidenceSetDigest 与幂等键，明确拒绝独立 manifest/authorId/approverId。自动化、紧急和旧 Blueprint 交付写入口不例外；生产缺必需真实 gate 时无 published 或可消费制品。
4. 复用共享 canonicalizeJson 和 Node Ed25519，对完整目录载荷签名；区分 candidateDigest/artifactDigest/releaseDigest，G8 使用未公开签名制品回执，不把最终决策或回执反向嵌入其自身签名。
5. 在已有数据库与文件存储上增加永久封存/子项保护、digest 寻址条件创建、固定版本别名和 publish 持久意图；直接复用 PG jobs/幂等基础，仅添加必要发布请求摘要与恢复适配，不另造任务队列。
6. 以只读历史盘点及加法迁移兼容旧包和目录。旧标签签名原样保留为 legacy-unverified，不补造历史批准；不重签/覆盖旧发布、不释放退役版本号、不改变安装指针。

## Impact

能力为 `release-lifecycle`（五条独立加严 ADDED）与 `blueprint-delivery`（完整 MODIFIED Licensed and Signed Delivery，加一条 digest 存储 ADDED）。正式 Explicit Unsigned Exemption、Re-Sign After Upgrade 等原判据不改，只回归；既有 `add-blueprint-ui-and-permissions-layers`、`add-ai-patch-recompile`、`add-ai-blueprint-signing-and-load` 的功能直接复用，不重造需求。

预期 owner：`libs/platform-release/src/releases/{releases.service.ts,releases.controller.ts,release-ports.ts,release-validation.service.ts,release-test-evidence.service.ts,release-lifecycle.ddl.ts,entities/**}`、`libs/platform-release/src/blueprint/{blueprint.service.ts,blueprint.controller.ts,license.ts,packager.ts,loader.ts}`、`libs/release-kernel/src/index.ts`（纯计算）、`libs/shared-core/src/lib/canonical-json.ts`（既有规范化）、`libs/shared-schemas/src/v1/blueprint.ts`/`shared-schemas`（按现有导出边界）；`apps/api` 只装配及适配 AI/module-registry 写入与迁移。消费者包括 `libs/platform-release/src/release-automation`、`libs/agent-tools/src/agent-tool.registry.ts`、`libs/api-client/src/api/releases.api.ts` 和 `apps/web-console/src/app/admin/proposals/[id]/page.tsx`。

不做有效 ReleaseContext、灰度路由、安装/activation 原子事务或数据回退（06），不实现完整真实评测 runner/阈值/浏览器预览（09），不启用 A2（10），不重写 Kernel、Registry、金额库、Delta、UI 层或 PG identity/jobs/data-scope。所有新增接口/配置是待新增；保持 Nest/Next/React/PG/TypeORM/Nx/npm 和现有拓扑，不安装依赖、不改业务实现、不 apply/archive/部署。

## 验收出口

实现后须用真实身份 HTTP、隔离 PostgreSQL 应用角色、真实文件条件写及多进程故障实验逐项证实：无批准/错摘要/自报角色/单人多角色/作者自批/批准后内容变化/跨 org/app/平台作用域均拒绝；目录与 Blueprint 两层验签和授权均通过，逐字段篡改均拒绝；published/superseded/revoked 的归属/内容/子项不可变，同版本异摘要不覆盖，竞争及恢复仅产生一份完整制品与持久发布结果，publish 不激活。

09 必需真实证据缺失、旧 freshness evidence、fixture、非空 URL、自报 passed 或未签名豁免不能解除生产新发布拒绝；候选可在无 published 的隔离环境完成真实测试/评测。生产出口另需 01/03/09 的实际必需证据与独立批准，06 单独验收生效；本次 OpenSpec strict 成功仅是提案语法校验。未来实施才更新既有 release/blueprint 协议、DOMAIN/DECISIONS、Schema manifest 与 OpenAPI；本次不写权威 docs/台账，reducer 统一登记。
