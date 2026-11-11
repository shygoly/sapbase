# 现有工程链的 fail-closed 收紧设计

## Context

基线 `ce1e538dcec6539f66bba80d5413a3b6741486c9`。运行组合根在 `apps/api/src/app.module.ts`，不是旧 backend；缓存模块仍由组合根装配，而 `CacheService`/组织消费者位于 `libs/platform-core`。Release controllers/service/validation/evidence 是 `libs/platform-release` 实现，`apps/api/src/releases/*` 多为兼容壳，`releases.module.ts:57–65` 用工厂注入实际证据端口。双 Next app 已存在，不要求重做布局。

当前 build 顺序已建三内核与平台库；error 与浏览器 lint 范围也已存在。真实冷安装、Nx 图、所有构建及真实服务尚未执行；不能把静态配置或本次15个图纯函数 fixture 当应用验收。目标是在这些资产上补可验收闭包，而非全面平台审计。

## Goals / Non-Goals

目标是统一 required 工程判定、同输入可干净重建、实际消费者的依赖/实体闭包、真实测试与已测试工件绑定。主体栈、业务 Kernel 确定性、Registry 唯一入口、平台授权、原子零能力及既有发布/安装事务保持不变。

非目标是模型 runner、G0–G8 总编排、审批签名实现、发布/激活事务、人机工作台或 A2；这些由对应 changes 负责。缓存是可丢加速层，PG jobs/identity/data-scope 不改用缓存作真源。所有新接口是待实施，不是本次已上线能力。

## Decisions

### 1. 使用当前 workspace 图，不再手工修复旧三库顺序

保留根 dev/build、所有现有 workspace build 入口及纯函数兼容 re-export。检查实际生产 import 的直接包声明，API 的 agent-kernel 直接消费不能靠 agent-tools 的传递依赖掩盖；release-kernel 的实际生产 owner 已在 platform-release，不能机械要求每个 API 壳再依赖它。测试专用依赖单独登记。

根 build 与 CI 使用同一 Nx build 闭包。批准实施时确认 npm 脚本推断 target 与显式 project targets 的最终图，不能仅因某 project.json 未写 build 就认定不可构建。补 `dependsOn: ["^build"]`、实际 executor 的 outputs、项目/依赖 production 输入、根 package-lock/package/npm 配置、编译配置、工具链与非秘密构建环境。Next 消费源码型 UI libs 的现有 transpilePackages 保留，由该 Next target 的输入覆盖实际库源码，不为每个 UI 库强造 dist。关闭 PG/Redis/browser/故障测试结果缓存；纯计算缓存必须标原运行来源。

冷构建在批准后的隔离副本清普通 dist/.next/target 与 Nx cache，禁止远程命中，再根 npm ci 按图 build；随后验证缓存恢复产物完整与依赖/锁/编译配置变化使消费者失效。普通生成物不提交凑绿；已入册 WASM 字节/manifest 继续按原复现准入核验，不被误删。

JavaScript 仅根 package-lock；Cargo.lock 保留。逐项使用清单核对 bun.lock、模板包名、Clerk 等，无消费者才删。当前锁定主体版本不盲升；多 ESLint 主版本是兼容入口问题，不能靠批量升级或禁检查解决。

### 2. 保留已有项目 error，补图完整性和内部路径判据

继续用现有 ESLint project tags 与 B0–B5 checker，必须在 required pipeline 中实际执行；graph 生成失败、错结构、零节点、遗漏本次必需项目/源文件不能按零违规通过。图外 npm 外部依赖可以按明确 externalNodes 分类，不把未知 workspace 目标一律当外部而忽略。记录 graph sourceSha/inputDigest 与项目集合，防旧图复用。

目录级规则对解析后真实 import/export 边实施：纯领域/共享 Kernel 不接 Nest/TypeORM/Redis/fs/fetch/模型；domain 不引用同项目 infra；Agent Kernel 只依赖批准端口/纯规则，实际工具经 Registry；browser 不接 Node-only runtime。相对、TS alias、package export、re-export 都需覆盖。`domain-shipping` 项目当前含迁移/导入适配器，不能把它整个 package 误当纯领域内核；按明确目录/导出区分纯规则与 Node 适配，保留合法基础设施消费者。测试例外按具体文件与符号审查，不用 wildcard 打洞。

边界命令为非自动修复，不调用 API 当前含 --fix 的 lint 作只读门禁。双 Next build 可继续采用独立 lint job，但 build 的 ignoreDuringBuilds 不得导致 required lint 漏跑；src 范围为空/错 glob 应拒绝。

### 3. 一个 required 阶段契约，允许 GitHub 并行 job

复用 `scripts/ci/pipeline.sh`，以共享阶段定义/脚本对齐 GitHub jobs；不要求所有工作串行跑在同一进程。顺序为根 npm ci → 严格契约与有效边界图 → 按依赖图 build → 维护单测 → 临时 PG 迁移/元数据/schema/RLS → 维护 E2E → 双 Next 原工件与基础真实 browser。独立 WASM/宿主目标可并行，但最终 required 聚合 MUST 等待所有被 profile 要求的 jobs。

`check:ci` 去除 warn-only；ERR=1、配置/IO/子进程/非法报告非零均阻断。存量 baseline 只缩小；模板 validate 独立列资产范围和 notApplicable，不算产品覆盖。GitHub branch/tag 触发和最终 required job 名称在实施时核对，不能假定当前 main-only 的 workflow 自动覆盖其它目标分支。仓库保护规则若不能在代码证明，验收记录配置证据，不宣称本次已阻止合并。

required E2E 初始化错误直接失败；禁止 available=false 后在 it 中 return。本地显式 optional 可报告 unavailable/skipped，但不是发布证明。采用 expect.hasAssertions/expect.assertions 或真实匹配器计数，报告逐例实际断言与预期/实际 case 集合；Jest numTotalTests 不等于断言数。保留整套维护单测及公开历史排除清单，不能删负例或运行子集却声称全量。

现有 verify-from-zero 会重建临时库，不把它描述成生产只读检查。重建角色与非绕过 RLS 的应用角色分离；只有允许前缀的隔离库能重建。required 模式使用 DB_SYNCHRONIZE=false，防 AppModule 自动修表掩盖迁移错误。本次未运行此路径。

双前端保留现有 Next build。复用 locale-routing 的合法路由用例但区分 mock SSO；新/升级基础 smoke 使用锁定仓库浏览器依赖、构建后的 start、隔离真实 API/PG，覆盖两入口登录/页面读取/403与依赖失效，不使用系统全局 Playwright 或 demo 结果证明真实链。08的完整工作台与09候选预览联合验收后置；基础 smoke 不等待这些界面开发才允许前段隔离构建。

### 4. manifest 比较必须服从生产实体注册

以 `APP_ENTITIES` 及 `PLATFORM_CORE_ENTITIES` 为注册闭包，构建独立 metadata 导出入口，不启动 AppModule、模型或服务；采用生产 naming strategy、继承/嵌入/拥有端关系/连接表。提交 manifest 位置不变；现有 schema-manifest 命令保留兼容入口，实施时用真实元数据替换正则推断。CLI 的 --root 路径只作兼容诊断，不能成为另一个独立真源。

临时生成规范化结果与提交清单只读比较；时间戳/绝对路径不进入内容摘要。验证 verify-from-zero 的 glob 经 re-export 加载得到的实体集合与 APP_ENTITIES 完全相等；不先断言它必然漏所有 libs，但不采信未经对拍的 glob。迁移后 PG catalog 比较列类型/空值/默认/主外键/索引与独立 RLS 角色/策略断言。动态或历史非 ORM 对象列明确来源及维护范围，不宽泛忽略额外表。保留成对、狭窄默认值记号等价，保存原 SQL；不 synchronize 或覆盖已提交清单来消差异。

### 5. 缓存只修实际接口和真实消费者

保持 CacheService.get/set/del/orgKey 的兼容面；Keyv Redis adapter 待新增并锁定，与当前 Nest cache 3/cache-manager 7 stores 适配。driver 仅 redis/memory，未知值拒绝；Redis 初始化/运行故障明确 unavailable，可丢只读缓存只有已批准真实 DB bypass，不能静默切 memory 后报 Redis 已接通。

内部 TTL 毫秒，CACHE_TTL 秒只在配置入口转一次；修改实际组织服务的300调用为明确毫秒或兼容秒包装，并测试默认/显式 TTL。两实例直接连接共享 Redis，避免独立本地前置层导致删后 stale；现有精确 del 的跨实例效果必须真测。没有生产 invalidatePattern 调用证据，不新增复杂 namespace generation；保留兼容方法但对未支持 pattern 明确抛错而非空成功。memory 明示单实例范围，不满足 Redis验收。缓存不能授权成员/角色/有效版本；任何权限真相仍由可信身份与 PG 解析。

### 6. 扩展既有证据存储，不再以“新鲜”作为可信

待新增/升级 `BuildVerificationEvidence` 最小字段：evidenceVersion、runnerIdentity、runId、sourceSha、inputDigest、artifactDigests、platformTarget、toolchainVersions、suiteVersion、expectedCases、executedCases、逐例 assertionCount/result、failed/skipped/unavailable、原始日志摘要与完成时间。状态由受控 runner 和平台核验推导，不采信请求的 suiteSummary.success、ranBy、ranAt 或任意 digest 字符串。

复用 ReleaseTestEvidenceService 与 `POST /api/builder/test-evidence`；写入授权分离为平台受控 runner 入口，普通 app:release:validate 不能凭自述生成可消费证据。平台验证原始报告/工件引用及实际摘要、runner/run 归属与完整集合；失败、空套件、缺case/零断言、skip、wrong subject拒绝。对现有实体新增必要 subject/来源字段，旧行留诊断但不回填 fabricated provenance，不改变现有业务安装事务。

在既有 ReleaseTestEvidencePort 上待新增 `findForSubject(subject, requiredSuites)`，`findFresh` 只留诊断兼容，不用于生产 G4。subject 的 sourceSha/inputDigest/artifactDigests 由平台与冻结 candidateDigest 建立绑定；年龄可以是批准 policy 的附加限制，不能继承无依据24h作充分条件。09消费这个只读端口计算完整 G4/总 GateDecision；无可信实现返回 unavailable，RELEASE_G4_RUN_TESTS=false不能 passed。本 change不承诺当前模型评测已真实执行。

记录器修正 Jest report 输出/读取的 workspace绝对或repo相对路径，防 API cwd 写出与根 cwd 读取不一致或旧文件复用；必须原子产生本次报告。缺 token 的本地文件可诊断，但 required 注册/消费没完成必须不可用，不以退出0宣布闭环完成。凭据只服务端配置，不写入报告或缓存。

### 7. 测试原工件，readiness复用实际引擎

待新增 `DeploymentArtifactManifest` 绑定 sourceSha/inputDigest、API/两个前端原工件 digest、Rust target/binary、原子 manifest与逐 module digest、迁移集合、required工程证据及上一安全工件引用。平台重算 bytes摘要，测试后不重建不同字节再部署。Next要求干净重建可解释，不承诺所有打包元数据位级重复；WASM同锁工具链同字节仍严格要求。

现有 /health 保持存活；待新增 capability readiness 通过 WASM_ENGINE 的可适配 health接口复用 Wasmtime hello/ping，核 binary/module digest、protocol/version及profile要求的 PG/RLS/Redis。错误目标、缺宿主、漂移、required依赖不可用返回非就绪；只有平台已批准的无原子 profile 可不要求宿主，不可从运行失败临时推导豁免。不自动改引擎；V8对拍和显式回退遵守00与现有审计契约。

标签 workflow 当前仅发说明，没有实际 deploy消费者证据，不称本次已发现部署攻击。说明可继续发布，但必须标非可部署证明；任何未来可部署工件入口需 exact SHA 的 required结果、受控签名/独立部署批准。cross build上传不等于目标执行，仅发布原生或经批准等价执行验收的目标集。

候选冻结 → 真实测试/评测 → 独立审批 → 签名未公开工件 → 最终GateDecision → published → activation。工程证据在未published时可生成读取，避免03/05/09循环。发布/激活权在平台；03成功不替代09真实评测，也不开放A1/A2自治。

## Migration / Rollback / Risks

先批准依赖矩阵、required套件/profile与subject接口，保留旧命令/诊断记录；逐段在隔离副本完成构建与负例，再接真实临时依赖和readiness，最后独立复核工件及管线聚合。旧 pending change的warn/旧路径场景由整合者在实施归档时消解，不本次直接修改。

严格门禁可能暴露现有导入/历史E2E债务，必须修具体接口或公开未覆盖范围，不扩大baseline。元数据加载可能有副作用，独立入口禁止AppModule启动与synchronize。Redis adapter版本/浏览器依赖待审批；真实PG/Redis部署版本、GitHub保护配置、目标等价环境尚未知，必须填实际验收。

失败保留上一已测试安全工件；可丢缓存可回到批准的显式memory/真实DB bypass，不恢复旧store静默兜底或空失效。不能回退到warn-only、空跑、旧报告、自动换引擎来凑绿。代码工件回滚不意味着安装/数据回退安全，后者由06的兼容判定负责；09未真实验收时生产新发布与自治保持不放行。
