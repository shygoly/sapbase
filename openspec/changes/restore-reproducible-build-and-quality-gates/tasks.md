# 当前工程链收紧任务

只编写提案；以下任务均未实施，须批准后执行。本次不安装依赖、不启动服务、不迁移/部署，不把文档校验视为生产通过。

## 1. 契约与现有资产

- [ ] 1.1 按00架构契约冻结当前 apps/libs 的生产依赖矩阵、纯领域/Node适配目录边界、required suites/profile/目标集；保留已补三内核顺序、error、双Next拆分和Registry入口，不重做拓扑。
- [ ] 1.2 与05/09确认既有ReleaseTestEvidencePort的subject-bound扩展、BuildVerificationEvidence、runner授权及sourceSha/inputDigest/artifactDigests→candidateDigest绑定；冻结缺证据拒绝和未published可测试接口。
- [ ] 1.3 审批唯一npm锁与模板使用清单、Keyv adapter/浏览器待新增锁定依赖、实际TTL兼容、APP_ENTITIES元数据来源与readiness必需依赖，记录未知部署版本/仓库保护配置的验收项。

## 2. 当前构建及CI接线

- [ ] 2.1 补实际消费者直接依赖（尤其API仍直接导入agent-kernel），核对Nx推断/显式targets及包图；根/CI共用build闭包，补dependsOn、outputs与源码/依赖/根锁/编译/工具链输入；保持源码型UI libs的Next编译方式。
- [ ] 2.2 按清单清理确认无消费者的模板项与bun.lock，保留Cargo.lock；校验根npm ci和workspace声明一致，不自动install修锁、不盲升主体主版本、不提交普通产物凑绿。
- [ ] 2.3 收紧已有图checker的结构/节点/必需项目完整性，增加同项目解析后import/export、alias/re-export和browser→Node拒绝规则；边界lint非自动修复且实际范围不可为空，保留现有error及合法迁移适配。
- [ ] 2.4 复用pipeline.sh和GitHub jobs定义共享required阶段与最终聚合：严格check:ci/边界→图构建→实际单测/真库E2E/双Next→证据；明确标签/分支触发与外部保护配置，不以模板skip替代产品阶段。
- [ ] 2.5 修required E2E前置错误传播及逐例断言计数，清理available后early return假passed；冻结维护单测/E2E与历史排除集合，关闭真库/Redis/browser/fault结果缓存，不删负例或选子集冒充全量。

## 3. 真实owner与证据接口

- [ ] 3.1 升级现有schema-manifest兼容入口从APP_ENTITIES真实metadata导出，在临时路径生成规范化比较；核对verify-from-zero实体闭包、迁移PG结构与独立RLS角色/策略，保留狭窄默认等价，不覆盖真源/synchronize修表。
- [ ] 3.2 在API cache装配接Keyv stores，保留platform-core CacheService接口；统一TTL毫秒并修组织服务的实际300调用，明确driver/断连与精确del；未支持invalidatePattern抛错，不新建无消费者namespace系统。
- [ ] 3.3 扩展现有ReleaseTestEvidenceService/实体与写入端点为受控runner证据，校验原始报告/摘要/集合/subject；新增findForSubject兼容端口，旧findFresh记录仅诊断，普通validate权限自报和禁G4执行不得PASS；09消费端完整门禁后置。
- [ ] 3.4 升级ci记录器的workspace输出/读取路径、本次run来源/实际断言/工件引用与注册状态；缺token或注册未完成仅本地诊断，不作required成功，禁复用旧JSON/自报时间/ranBy补来源。
- [ ] 3.5 新增DeploymentArtifactManifest生成/核验及capability readiness（待新增接口），复用WasmEngine/Wasmtime health，平台重算binary/module/应用/迁移摘要；标签说明与部署许可分离，交付只用已测原工件和批准目标。

## 4. 拒绝集与真实验收

- [ ] 4.1 在隔离副本执行冷npm ci/拓扑build、缓存恢复与输入变更回归；实际lint验证非法项目/内部目录/alias/re-export/browser、缺图/空图/遗漏范围，以及契约错误/非法报告退出非零。
- [ ] 4.2 在允许前缀的真实临时PG执行既有重建/verify-from-zero和冻结E2E，DB_SYNCHRONIZE=false；注入连接/迁移/缺表/角色/RLS前置失败、缺case/零断言与metadata/清单漂移，记录ledger、实际case/断言与原SQL，不使用真实用户库。
- [ ] 4.3 在真实Redis双独立实例验证共享、默认/显式TTL、跨实例精确del、断连及未知driver；显式memory作独立对照且不算RedisPASS，unsupported pattern必须拒绝，记录实际adapter/服务版本与检查。
- [ ] 4.4 对两个完整Next原工件用锁定浏览器执行基础登录/路由/真实API读取/403和依赖故障smoke；复用既有locale用例并分离mock SSO，输出subject/工件digest/case/断言/trace，不将08/09未实现界面用mock冒充。
- [ ] 4.5 在拟交付目标原生或批准等价环境执行锁定Rust测试及宿主握手；验证错SHA/空或失败报告/伪runner/旧subject/缺binary/错digest/协议错版/未测试target/required依赖失效拒交付，保留上一安全工件，cross上传不算测试。

## 5. 独立复核出口

- [ ] 5.1 独立复核全部真实日志、版本、集合/实际断言、runner及原工件摘要和required聚合决定；实施验收后更新既有工程/包管理/技术栈/元语/project真源相关段落并消解旧pending场景，不制造平行权威docs。与05/06/09确认候选→测试评测→审批→签名未公开工件→最终GateDecision→published→activation；无09真实评测不得放行生产新发布或自治，03完成不授权A1/A2。

## 命令存在性与本次限制

当前根已存在 `build`、`build:libs`、`build:web`、`check:all`、`check:ci`（仍warn-only）、`lint:boundaries`（已含browser）、`check:boundaries`、`ci`、`ci:record-evidence`、`wasm:test`、`wasm:reproducible`、`test:locale-routing:e2e`。API已存在build/test/test:e2e；两前端已存在build/start/typecheck。不能把名称存在等同真实可用或强制门禁；pipeline未被GitHub调用且API lint含--fix。

现有真库脚本是在apps/api cwd调用既有ts-node的 `scripts/rebuild-database.ts --db=<允许前缀临时库>` 与 `scripts/verify-from-zero.ts --db=<允许前缀临时库>`，不是新增package script。schema命令真实位置为 `node scripts/meta/schema-manifest.typeorm.mjs`，当前--root默认apps/api/src且只做文本推断。浏览器现有locale脚本含dev/global/mock范围，不能声称完整生产smoke已存在。

`findForSubject`、BuildVerificationEvidence、DeploymentArtifactManifest、capability readiness、冷构建/缓存集成/工件smoke正式入口及新增Keyv/browser依赖均待批准实施；最终命令名在实现时登记，不虚构当前命令。本次只执行既有边界纯函数node tests与语法检查、OpenSpec validate；无真实PG/Redis/Rust引擎/browser/模型或冷构建执行证据。
