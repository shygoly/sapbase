# 冻结候选与不可变制品设计（weichen）

## Context / Goals / Non-Goals

基线 `ce1e538dcec6539f66bba80d5413a3b6741486c9`。运行链为 AppModule → API ReleasesModule 工厂 → platform-release ReleasesService；BlueprintModule 及签名/装载实现在 platform-release。`release-ports.ts:3–9` 已反转 AI/outbox/eval 依赖，不把实现搬回 apps/api。保留现有状态词、正式 Blueprint 协议和七道装载判据；Kernel 纯确定性，Registry 唯一工具入口，批准/签名由平台掌握。

目标仅为服务器候选冻结、同摘要可信审批/证据消费、完整签名、不可变目录和包、publish 恢复。不设计 activation/ReleaseContext/安装迁移事务（06），不写真实评测/预览 runner（09），不配置/启动任何自治（10）。既有 PG identity、jobs、data-scope、安装事务、单金额库及 UI/权限蓝图层直接复用。

## 1. 修订冻结及已有 Delta 的适配

`apps/api/src/ai-modules/definition-patch.service.ts:387–431` 已有纯服务器 applyDefinitionPatch，支持 object/state/page/permission/menu 的已实现子集；`AIModulesService.persistDefinitionAsBlueprint` 已连接转换、产包及编译。本 change 不新增 Delta 语法、不补造这套服务，新增 AppDraft 适配器把合法增量应用到已验证基线。没有可表达操作就拒绝，不把完整替换 manifest 当 Delta。

待新增 apply/freeze 契约带可信 org/app/draft、expectedRevision、baseReleaseId/baseReleaseDigest。草稿批次应用在 PG 锁/CAS 下全部成功或全部拒绝；编译和依赖解析不持长事务，最终保存时再用 CAS 核对草稿、基线与解析结果。保存只读冻结快照，公开 getter 返回只读投影；原草稿 frozen 状态不等于内容已受保护，必须有数据库/服务封存。

FrozenCandidate 是既有 AppDraft 的平台只读投影，不是新业务包。至少固定：组织或独立平台作用域、appKey、proposal/draft/frozenRevision、实际作者与 agent 来源、可信基线 release id/digest（首次为明确空基线+准入 policy 引用）、版本/通道/changelog、真实 diff/diffDigest、所有文件及逐文件 SHA、去 signature 的完整 manifest（含 runtime、layers、ui/permissions、compiled 章及固定 compiledAt）、IR、依赖闭包与解析到的模块 SHA/契约版本/许可、工具/技能/知识固定版本、权限变化、兼容/迁移/补偿计划。`loader.ts:281–298` 现会再次按 range 解析 Registry，受治理制品解析须核对冻结绑定，不静默换 latest。

修改任何上述内容只能追加修订、重新冻结并撤回旧候选发布资格；旧快照/证据/批准不覆盖。审批时 modifiedDiff 明确拒绝。UI 修改操作转回草稿，不提供“改并批准”。

## 2. 三个摘要与签名对象

复用 `libs/shared-core/src/lib/canonical-json.ts:7–21` 的规范化算法；release-kernel 仅新增纯载荷/摘要计算并复用同一算法，不另造第二种排序。冻结 Schema 拒绝非 JSON 值、非有限数、未知字段和会被 JSON.stringify 丢弃的值；不得偷偷 Unicode 归一化。重复键若需拒绝应在原始 JSON 解析边界完成，不能声称解析后的对象可恢复重复键。算法/域版本固定并有向量测试。

| 名称 | 输入 | 用途 |
|---|---|---|
| candidateDigest | 域 `sapbase-release-candidate/v1` + 规范化 FrozenCandidate.payload | 测试评测、预览、审批及 publish 锚点 |
| artifactDigest | 最终 signed .erpkg 全部实际字节 SHA-256 | 条件存储地址、传输完整性 |
| releaseDigest（现目录 digest） | 域 `sapbase-approved-release/v1` + 完整签名 envelope 的 header/payload | 完整目录签名与消费者校验 |

Blueprint manifest 的既有 `manifestPayload()` / Ed25519 语义不变（`license.ts:19–37`）。冻结前编译盖章；冻结后仅在 staging 加 manifest.signature，文件字节、unsigned manifest、compiledAt、IR 和依赖绑定保持等价。ZIP 的容器元数据/签名增加导致 artifactDigest 与 candidateDigest 不同是正常的，但必须验证逻辑内容一致；不能因为摘要不同而豁免内容核验。若发生内容漂移，重走新候选/真实证据/批准。

目录签名是新用途 envelope，不将 AppRelease 伪装成 Blueprint manifest。被签 header 固定 algorithm=Ed25519、keyId、payloadVersion；payload 覆盖可信归属/版本/基线、完整候选、最终 manifest/artifactDigest、release items、依赖许可、兼容迁移/changelog、G0–G6 evidenceSetDigest 及快照、G7 approvalSetDigest/快照/policyVersion、固定 publishIntentId/发布 ID/主体/时间及 emergency 理由。排除自身 signature/digest 和明确可变状态字段。用 Node createPrivateKey/sign/verify，拒绝非 Ed25519 key、缺根/坏根/未知版本/标签签名；私钥仅经平台 secretRef/受控 signer 读取，不进入返回 DTO、日志或 Agent。

## 3. 审批、证据与无循环发布

当前 JWT 的 id 来自签名 token 的 sub（`libs/platform-core/src/auth/jwt.strategy.ts:30–41`），通用权限守卫确有执行；并非请求体直接传 approverId。剩余问题是 body.role、提议缺可信发起者、单次高风险批准和无摘要绑定。审批通过平台 identity/成员/权威权限服务重解析当前资格，不另建身份引擎，也不采纳 email/unknown/body.role 作角色证据。`agent-tool.registry.ts:321–335` 当前只记录固定 agent 名及 createdBy=null，适配时透传可信真人 initiator 和受控 profile，防止作者冲突被 null 隐藏。

平台按真实 diff 的最高风险计算 policy 所需能力：权限/工具/知识需安全能力；迁移/破坏性结构需技术能力；组合风险全部满足。高风险至少两位不同非作者真人，owner 与所需 specialist 分离；单人多角色不算双人，platform_admin 不豁免。低风险仍需有权非作者真人。A2 将来如有批准的预授权 policy，只能在 10 完成后由本服务实例化同候选凭证，不能以配置开关或 actorAgent=null 代替批准。

审批追加记录 candidateDigest、frozenRevisionId、evidenceSetDigest、verified principal/role/capability、policyVersion、decision 和时间；撤销追加事件，不能改历史批准。签名前和提交前重查资格、候选未撤回、策略与证据一致。

待新增 ports（位于现有 release-ports.ts，由 API 装配，均尚未实现）：

- `FrozenCandidateReader.get(principal, proposalId, frozenRevisionId, candidateDigest)`：向 09 返回固定候选、基线、依赖与隔离包引用，不要求 published releaseId；访问需候选审批/执行资格，普通业务读不能枚举。
- `CandidateEvidenceProvider.readRequired(candidate, policyVersion, stage)`：09 提供真实 evidenceSet/适用性/最终 GateDecision；05 只消费并拒绝 required 的 missing/unavailable/skipped/零执行、自报 passed、环境错配。旧 `findFresh(org,app,time)` 和 CI commitSha 不能代替同候选证据。
- `ApprovalReceiptReader` 与 `SignedUnpublishedArtifactReceiptReader`：05 返回未 published 的 G7 审批及 G8 验签/不可变存储回执给 09；回执引用 candidateDigest、releaseCatalogDigest、blueprintPackageDigest，不回查 published 作为前置。
- `PublishedArtifactResolver.resolve(principal, {releaseId, expectedReleaseCatalogDigest, appKey, installationId, purpose})`：purpose 限 install/upgrade/rollback/resume；返回独立目录/包/IR摘要、只读包引用、signedManifest、冻结依赖/许可、compatibility/migrationRefs 及最终 GateDecision 引用。05 核验目录授权、签名/封存/状态，superseded 仅在明确可回退政策下用于 rollback；revoked/failed/preview 拒绝。06 再核安装与当前数据兼容，结果不表示已激活。候选预览只用 FrozenCandidateReader，不经此生产解析口。

按阶段核验而非一次等待所有 G0–G8：

1. 冻结 candidateDigest，09 在隔离候选上执行真实 G0–G6（适用项由服务端推导并审计），无需 published。
2. G7 真人审批绑定固定 evidenceSetDigest。
3. 创建固定 publish 意图/ID/主体/时间；核验 G0–G6/G7 后在未公开 staging 签 Blueprint，核内容相等并条件持久化完整包；签完整目录 payload，生成 G8 可信回执。
4. 09 根据上述回执产生最终 GateDecision；G8/最终决策不反向嵌入自身被签 payload，后置 release.published 事件不成为 G8 前置。
5. 短 PG 事务锁候选/版本命名空间，复核授权、资格、证据、签名/存储及完整 GateDecision；追加 Release/items/events 并关联 proposal。提交后才可读取 published，06 再独立 activation。

生产 admission 默认拒绝新的发布资格，只有所需真实 provider/证据及联合验收独立批准后开放；现有 RELEASE_ENABLED 只是否定开关，不能独自授权。09 缺实现时应返回 UNAVAILABLE 或明确 missing gate，无 published、可消费签名包或安装变化。隔离 fixture 只用于测试 org/库/存储并带 source=isolated-test，生产 DI/配置/admission 均拒绝。现有正式未签名开发豁免仅用于隔离装载，1–3/7 判据、生产报错和审计保持原样，不变成发布凭证。

## 4. 发布命令、消费者与持久恢复

改造实际 `POST /api/builder/releases`：仅 `{proposalId,frozenRevisionId,candidateDigest,evidenceSetDigest}` + Idempotency-Key，组织/主体从可信上下文取得；旧 manifest/authorId/approverId/version/changelog 字段明确 400，不自动转旧方法。失效/错摘要 409，授权 403，缺必需提供器明确 UNAVAILABLE。`release-automation.service.ts:126–136` 必须改为消费同候选和平台凭证；紧急仅改变优先级/理由，不减门禁。

现幂等有 Redis 成功缓存与内存回退（`release-idempotency.service.ts:38–63`），不是 PG publish 意图；复用 `libs/platform-core/src/jobs` 的任务真源、租约/重试与既有幂等基础，新增必要的 publish intent 请求摘要、进行中/结果和候选唯一约束。以 org/平台作用域、授权主体、操作、key 定位；同 key 不同摘要冲突，同候选并发返回同持久结果，命中仍重新授权。若某步骤失败不得返回 succeeded；真实 jobs 状态供已有 HTTP job/SSE 适配消费，不新造队列。06 的 activation/rollback 意图与本 change 分开。

Blueprint 所有写消费者必须接入封存判断与平台签名授权：`packageFrom/compile(stamp)/deliver/deliverPackage`、AI materialize/deliver、module-registry export 只能在受控 staging 创建候选或隔离开发包；不得写 published 引用地址或覆盖版本别名。旧 package dir/out 请求不可指定任意生产目标；现 Blueprint JWT-only 路由需补业务/平台授权和作用域核验，不把认证等同许可签发。保持合法第一方隔离开发用途，Builder 仍只能通过 Registry 提议/只读编译，不新增 approve/sign/publish 工具。

## 5. 永久封存与条件存储

已有 DDL 的 Release DELETE 拒绝和平台/租户版本 partial unique index 保留，不再“新建删除保护”。新增不可清空 sealedAt/封存事实，依据曾 published 而非当前 status 守护完整行；只放行显式 status/updatedAt 等状态审计字段，未来内容列默认保护。id/组织/app/版本/通道/基线/manifest/changelog/compatibility/digest/signature/候选与证据批准引用/发布及创建主体时间不可改；superseded/revoked 不恢复写权限或释放版本。父封存后子项 INSERT/UPDATE/DELETE 拒绝，候选/审批/证据快照追加不可变。保持 RLS 与平台 NULL 独立授权，子项继承父归属；生产应用角色非 owner/superuser/无 BYPASSRLS，不声称可防 DB 管理员改 DDL。

待新增 `ImmutableArtifactStore.putIfAbsent(artifactDigest, bytes)` / `getVerified(artifactDigest)`：服务端生成安全 hex 路径，在同文件系统 staging 完整写/fsync，通过排他创建或不覆盖原子链接提交，再 fsync 目录。禁止 exists→write、覆盖 rename、symlink 或 caller out 路径。相同 digest 已存在时重读重算并验证完整字节；损坏目标拒绝告警而非覆盖。未来对象存储必须条件创建/只读保护，驱动不支持则拒绝，不引入新云存储为本次前置。

版本别名在数据库固定映射 artifactDigest，已发布不可换向。包先落、目录后事务；事务失败只能留下不可见完整孤儿，恢复核验可复用但不得公开半包。对象引用不是授权，解析始终核目录/包签名、实际 SHA、许可和固定依赖。

## 6. 加法兼容、风险与安全回退

旧 `.erpkg` 先只读验证七道关并盘点真实 SHA，合法字节复制到 digest 地址、登记固定只读旧别名；同名多字节或目录矛盾隔离人工处理。不就地 license 补写/盖章/重签历史包。旧目录 ed25519:digest/unsigned:dev 原样保留为独立 legacy-unverified 资格，不把历史行补造成已批准；重新交付需新冻结候选、未占用版本及完整证据批准。

当前 AI deliver 的“签名后 load 成功才写 loadedAt”继续保留；新不可变交付返回新包引用/版本并以实际 load 的同一个引用更新 metadata，不继续使用旧 packageId 读取。兼容客户端明确迁移返回类型与 UI，旧签名开发包不能默默被当新 governed Release；既有已安装稳定确定性运行不强制重装，重新安装/回退资格由 06 判定。

失败回退只关闭新 publish/签名写入，保留新保护、存储只读与历史可查；旧应用版本不支持新字段时只读或拒写，不能撤 guard、重开 manifest/未签名/emergency 旁路。文件与数据库无法共同回滚，完整孤儿保留策略可审计；ZIP 时间/编译章变化触发候选重做，而非允许漂移；权限撤销需提交前复核，不依赖 token 缓存。

## 7. 验证及命令纪律

本次只读代码与 OpenSpec strict 校验，不执行真库/模型/浏览器/HTTP/产包测试。实际 package 为 `@sap/api`，有 `test` 和 `test:e2e`；未来用 `npm run test --workspace @sap/api -- <新增专属套件参数>` 与 `npm run test:e2e --workspace @sap/api -- <新增配置/参数>`，先登记准确文件与 Jest 配置。`apps/api/jest.config.js` 当前 rootDir=src，新增 lib 测试必须明确 mapper/config，不能假设现命令扫描 lib。存储多进程与浏览器测试命令均待新增，不借 main dist 或旧次数充当实测。

现 G4 确有 Jest 执行，根 ci pipeline 含 check:all；GitHub 入口仍另走 CI YAML。03 负责接真实阻断 CI，09 负责同候选 runner/证据鉴真，本 change 专测门禁消费、阶段顺序与拒绝副作用。真实验收记录 commit SHA、Node/OpenSSL、PG/应用角色/RLS、文件系统/驱动、实际 case/断言及失败；缺环境/初始化失败/未执行必须 BLOCKED，不得 PASS。未来实施后更新现有 release/blueprint 协议、DOMAIN/DECISIONS、Schema manifest/OpenAPI 与命令登记，本次不改权威 docs。
