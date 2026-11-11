## ADDED Requirements

### Requirement: Canonical Required Engineering Stage Decision

系统 SHALL 复用现有pipeline及GitHub jobs形成共同required阶段契约与最终聚合决定，在构建/测试前完成严格check:ci与实际边界检查，并完成依赖拓扑build、维护单测、真实临时PG迁移/schema/RLS及E2E、双Next完整build和构建后基础真实浏览器冒烟。required前置异常、ERR/配置/IO/子进程/报告错误、空套件、缺必測case、零断言、skip或超时 MUST 失败，不得early return假passed；显式optional与模板不适用 MUST 单列且不得算产品覆盖。报告 MUST 记录sourceSha/inputDigest、实际版本、预期/实际suite与case集合、逐例真实断言、失败/跳过与原始日志。全量维护单测入口及历史排除范围 MUST 如实保留，不得删负例或选子集冒充全量。

#### Scenario: required阶段真实执行后聚合
- **WHEN** 严格契约/边界、拓扑构建、真实临时依赖与非绕过RLS应用角色就绪，维护套件和双Next完整工件的浏览器smoke实际执行
- **THEN** 最终工程决定 MUST 等待所有profile必需jobs并核对集合、逐例实际断言与原工件摘要
- **AND** 浏览器 MUST 使用锁定依赖及真实隔离API/PG，mock SSO/模板/历史排除 MUST 独立标明而非扩大覆盖声明

#### Scenario: RLS前置或契约错误不得空跑洗绿
- **WHEN** DB不可达、迁移/schema/所需角色失败，或check:ci有ERR、边界缺图、报告非法、必測case零断言
- **THEN** required阶段 MUST 非零退出，最终结果 MUST 为failed或unavailable而非passed
- **AND** MUST NOT 追加warn-only、available后return、扩大baseline或借模板skip补成功，未执行断言 MUST 记录为零

#### Scenario: 编译或mock不能替代真实浏览器链
- **WHEN** 只有tsc/Next build通过，浏览器未运行、工件SHA不符、必需API不可用，或403/失效请求被demo/mock替代
- **THEN** 基础smoke MUST failed或unavailable，不得成为真实前端链证据
- **AND** 08工作台/09候选评测未完成 MUST 不被本基础工程PASS覆盖，前段隔离开发可继续但不获生产许可

### Requirement: Runtime Entity Registration Bound Schema Comparison

schema验证 SHALL 使用与生产APP_ENTITIES及平台注册点相同的TypeORM metadata闭包，与提交manifest及迁移后真实临时PG三向比较，覆盖继承/嵌入/拥有端关系/连接表、列类型/空值/默认/主外键/索引及独立RLS角色/策略。兼容re-export或目录glob MUST 不成为未经对拍的替代真源；非实体对象 MUST 有明确来源及范围。CI MUST 临时生成规范化清单只读比较，保留狭窄成对默认记号等价及原SQL，MUST NOT 覆盖提交真源、连接真实用户库或synchronize修库凑绿。

#### Scenario: 实际注册闭包与迁移结构相同
- **WHEN** 独立metadata入口加载实际APP_ENTITIES且在允许前缀的临时PG完成批准迁移，对拍提交manifest和现有verify-from-zero
- **THEN** 注册实体集合、表列/约束与声明非实体对象 MUST 按契约一致，报告 MUST 保留ledger与原始SQL
- **AND** 时间戳/本机路径 MUST 不进入语义摘要，生成器 MUST 不启动AppModule或真实模型

#### Scenario: 兼容壳漏实体或清单漂移拒绝
- **WHEN** 只扫描apps/api装饰器漏掉libs中的真实实体，metadata注册集合不符，或manifest/PG缺列、索引、RLS或有未声明对象
- **THEN** 验证 MUST 指出真实owner/结构差异并非零退出
- **AND** 表数相同、正则推断、宽泛忽略或自动修schema MUST NOT 形成通过

### Requirement: Explicit Compatible Cache Driver and Observed TTL

CacheService SHALL 保留get/set/del兼容面并由API装配使用与锁定Nest cache 3/cache-manager 7兼容的Keyv stores，或明确memory模式；driver MUST 限redis/memory，TTL MUST 在边界统一毫秒并覆盖实际组织消费者。Redis声明但不可用 MUST 明确failed/unavailable，MUST NOT 静默memory；只读可丢缓存的真实DB bypass MUST 显式批准。双实例共享/TTL/精确删除 MUST 有真实Redis证据；未支持invalidatePattern MUST 明确拒绝而非空成功，不要求无消费者namespace系统。缓存 MUST NOT 充当身份权限、审批、有效版本、业务事实或幂等真源。

#### Scenario: 双实例共享与精确失效生效
- **WHEN** A/B独立实例连接同一真实Redis，实际消费者写入默认/显式TTL、另一实例读取并执行精确del
- **THEN** 值 MUST 跨实例可见，删除后两实例 MUST 不命中旧值，TTL到期 MUST 无值
- **AND** 报告 MUST 记录实际driver/adapter/Redis版本和真实检查，不把300毫秒误报成五分钟

#### Scenario: 断连与不支持模式明确拒绝
- **WHEN** driver未知、Redis连接/运行失效或调用未支持pattern
- **THEN** 初始化/操作 MUST 明确失败、unavailable或不支持，required共享缓存readiness MUST 不通过
- **AND** MUST NOT 静默memory、空失效成功或清空其它scope；批准的只读DB bypass MUST 仍返回真实数据

#### Scenario: memory限定本地能力
- **WHEN** 平台明确选择不需要共享缓存的memory profile
- **THEN** 实际driver及单实例范围 MUST 可见且支持操作可验收
- **AND** memory结果 MUST NOT 满足Redis双实例验收或绕过权威PG/身份校验

### Requirement: Trusted Subject Bound Engineering Test Evidence

系统 SHALL 扩展既有CI记录器、ReleaseTestEvidenceService和端口，以平台受控runner产生并核验工程证据；证据 MUST 绑定sourceSha/inputDigest/原工件摘要/目标、runner/run、套件版本、预期/实际case、逐例真实断言与原报告摘要。平台 MUST 验证报告来源、完整集合及字节，不采信body的success/ranAt/ranBy/digest或仅按org/app/时间的新鲜行。旧findFresh记录 SHALL 仅诊断，生产消费 MUST 使用匹配subject和required suites的端口；无实现、禁执行、注册缺失、失败/空跑/跳过 MUST 不成为G4 passed。本工程证据 MUST 可绑定冻结candidateDigest并在未published时读取，完整候选评测/最终GateDecision由专属发布门禁消费，不接模型自报。

#### Scenario: 受控本次报告匹配冻结候选
- **WHEN** 受控runner完成必需套件并核验原报告/原工件，平台按批准source/input/artifact映射到冻结candidateDigest读取证据
- **THEN** evidence reader MUST 返回匹配的真实结果与来源，不要求先有published Release
- **AND** Jest输出和记录器读取 MUST 指向本次同一workspace报告，不从旧JSON补成功

#### Scenario: 新鲜自报或错subject拒绝
- **WHEN** 普通validate调用者提交任意摘要/未来时间/成功summary，旧行无来源、报告错SHA/候选、缺case/断言，或RELEASE_G4_RUN_TESTS=false
- **THEN** 可消费工程证据 MUST 拒绝或标failed/unavailable，G4 MUST NOT 因存在记录或测试被禁而passed
- **AND** 年龄限制仅可来自批准policy且不能替代subject、来源与真实执行校验

#### Scenario: 本地诊断不是注册完成
- **WHEN** 记录器无runner授权token、API注册失败或证据服务尚未实现，只留下本地JSON/test-double
- **THEN** 本地结果 MUST 标诊断或unavailable，required消费 MUST 不通过
- **AND** MUST NOT 伪造runner/断言/模型测试，凭据 MUST 不进入报告、缓存或浏览器

### Requirement: Exact Tested Artifacts and Capability Readiness

可交付单元 SHALL 使用平台重算的同sourceSha/inputDigest原工件清单，绑定API、双Next、Rust目标binary、原子manifest/module、迁移集合、可信required工程证据及上一安全工件引用。能力readiness MUST 区分/health存活与所需PG/RLS/Redis/引擎握手、protocol/version及字节一致，复用现有Wasmtime health而不重造引擎；未测试目标、缺工件、摘要漂移或required依赖失效 MUST 拒交付/接流量且不自动换引擎。标签说明 MUST 不代表部署许可；可部署入口 MUST 消费exact SHA证据和平台独立批准/签名。工程PASS MUST 不替代真实候选评测或授权自治。

#### Scenario: 已测原工件符合required能力
- **WHEN** 同subject工件清单和可信required报告匹配，目标原生或批准等价执行验收完成，所需能力与平台部署批准/签名就绪
- **THEN** 平台 MUST 重算应用/binary/module/迁移摘要并使用被测试的同一工件
- **AND** /health MUST 保持存活语义，capability readiness MUST 通过真实握手而非配置自述确定就绪

#### Scenario: 标签或存活不能掩盖缺工件
- **WHEN** 标签无exact SHA证据、cross只上传未执行、binary缺失/错目标、协议错版、摘要漂移或required依赖不可用
- **THEN** 可部署核验/readiness MUST 明确拒绝并保留上一安全工件，即使Node存活
- **AND** MUST NOT 用其它SHA报告、自动换引擎或临时豁免profile凑绿；单纯说明发布 MUST 标非部署证据

#### Scenario: 工程决定不越过最终候选门禁
- **WHEN** 冻结候选已完成工程测试但真实评测/总门禁尚缺
- **THEN** 生产新发布与自治 MUST 不放行，03的格式/工程PASS MUST 不替代09实际结果
- **AND** 顺序 MUST 保持候选冻结→真实测试评测→独立审批→签名未公开工件→最终GateDecision→published→activation，隔离前段开发不因尚未published而阻断
