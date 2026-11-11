# ai-native-architecture 控制面边界

## ADDED Requirements

### Requirement: 确定性业务与模型宿主的可检查隔离

平台 SHALL 将业务事实、权限、数据范围、规则、状态和提交判定保留在不依赖模型的确定性业务用例中。运行时 AI SHALL 仅在受控 Agent Host 经服务端模型端口做理解和规划；生产 Runtime MUST NOT 包含设计时 Jev。`libs/agent-kernel` SHALL 保持无外部 IO 的协议/上下文/预算逻辑，MUST NOT 因 kernel 名称取得业务仓储、模型网络或发布能力。模型计划 MUST NOT 被当作命令提交事实。

#### Scenario: 人工与工具使用相同确定性用例

- **GIVEN** 相同可信身份、有效版本、对象状态和命令输入
- **WHEN** 人工 REST 或经授权的 Registry 工具请求同一业务能力
- **THEN** 两者 SHALL 调用相同公开应用用例，由确定性规则与事务决定结果
- **AND** 模型只在 Host 的服务端适配器被调用，业务用例 SHALL 不依赖模型结论决定授权或状态

#### Scenario: 模型故障或建议跳过规则不影响业务判定

- **WHEN** provider 超时/被禁用，或模型建议跳过业务规则
- **THEN** 确定性人工路径 SHALL 保持原规则；Host SHALL 明确不可用或回到可见的规则/人工路径
- **AND** 依赖检查 SHALL 阻断业务用例对模型/Host/Jev 实现的引用，平台 MUST NOT 伪造提交成功

### Requirement: 四角色的可信能力来源与部署模式分离

平台 SHALL 复用现有身份与 BusinessAppExecutionContext，按每次调用的可信主体解析 Runtime Operator、Builder、HumanApprover 与 ReleasePolicyService 的能力。部署 `runtimeProfile` MUST NOT 被当作 agentProfile。Runtime Operator SHALL 只请求用户/安装获权业务工具；Builder SHALL 只提议草稿/Delta与隔离候选，MUST NOT 持有生产业务写、批准、签名、publish、activate、策略修改或宿主/源码部署凭据。HumanApprover SHALL 来自可信人类职责；ReleasePolicyService SHALL 是平台授权的逻辑服务而非 Agent 工具。请求体、模型或进程列表配置 MUST NOT 自授调用 profile、审批职责或发布权。

#### Scenario: 同实例双 profile 使用同一可信主体判定

- **GIVEN** 同一实例内平台已分别认证 runtime 与 builder 主体
- **WHEN** 两主体请求工具列表或工具执行
- **THEN** 列表 SHALL 是各主体授权工具集的子集，Registry SHALL 按同一可信 profile/身份再次判定
- **AND** 人类审批与平台发布执行 SHALL 分别记录实际人类和服务主体，不归属于模型自报身份

#### Scenario: 自报 role 或跨 profile 不能扩权

- **WHEN** 调用者自报 security/Builder/已批准，或以 standalone 部署模式请求 Builder/发布能力
- **THEN** 平台 SHALL 忽略其作为授权事实的含义；未知或越界主体 SHALL 在副作用前被拒绝
- **AND** 进程级 AGENT_HOST_PROFILE 或 API 路径名 MUST NOT 替代每次请求的可信能力来源

### Requirement: Registry 的最小 DI 端口与唯一业务接缝

Agent 业务能力 SHALL 唯一经过 AgentToolRegistry 与已注册适配器；外部 Host 的 MCP 传输 SHALL 复用同一 Registry 判定，不建立第二条策略路径。Host SHALL 仅持有模型/上下文/工具与会话持久化所需端口，MUST NOT 持有业务仓储、内部业务命令或批准/签名/发布/激活实现。Registry SHALL 使用已有模块/反馈端口与新增的最小提议/候选门面，MUST NOT 注入完整 ReleasesService 或其他含禁止方法的对象。TypeScript 类型收窄 MUST NOT 被视为运行对象能力已收回；项目、目录及组合根边界 SHALL 可自动检查。

#### Scenario: 最小门面适配现有运行实现

- **WHEN** API 组合根绑定 Host、Registry 和提议/候选适配器
- **THEN** Registry SHALL 仅得到受权提议/验证/候选预览方法，Host SHALL 经 Registry/MCP 请求能力
- **AND** 会话/轮次 Repository SHALL 可以由 Host 使用，业务命令事务 SHALL 位于共享应用用例，不在模型循环中持有长事务

#### Scenario: 完整发布对象或兼容壳掩盖越界被拒

- **WHEN** Host 注入业务仓储，或 Registry 通过 Pick/兼容 export 得到含 approve/publish/activate 的完整服务对象，或模型发明 SQL/工具
- **THEN** 目录与 DI 断言 SHALL 阻断越界接线，Registry SHALL 拒绝未注册请求
- **AND** 检查 SHALL 追踪到真实实现 owner，MUST NOT 因 apps/api 文件只是兼容壳而漏报或直接执行替代服务

### Requirement: 非循环的候选证据与有效版本权威端口

平台 SHALL 为冻结候选、Registry 执行事实、真实测试/评测、可信审批、签名工件、最终 GateDecision 和有效 ReleaseContext 指定唯一权威生产者及版本化端口。生产治理顺序 SHALL 为 `candidateDigest → 真实测试/评测 → 可信审批 → 签名未公开工件 → 最终 GateDecision → published → activation`；评测/预览 SHALL 可读取隔离的未 published 冻结候选。有效运行版本 SHALL 由安装/激活解析，不由候选摘要或 URL/packageId/latest 决定。缺必需证据或真实评测时生产放行与自治 MUST 被拒绝，既有安全稳定安装 SHALL 可继续确定性运行。

#### Scenario: 未发布候选可以产生同摘要证据

- **GIVEN** 服务端冻结修订、candidateDigest 和隔离读取授权
- **WHEN** runner 执行真实测试/评测，随后审批、签名未公开工件和最终 GateDecision 均核验同摘要
- **THEN** 平台 SHALL 无须提前创建 published Release 即可完成候选验收，再按门禁决定 publish 和 activation
- **AND** 页面、命令与 Host SHALL 读取安装核验的有效 ReleaseContext，不误用候选或目录 latest

#### Scenario: 自报成功或缺证据不能最终放行

- **WHEN** 只有 Agent trace、caller passed、测试计划、时间新鲜但未绑定候选的测试记录、preview URL 或被跳过的必需执行
- **THEN** 消费者 SHALL 标明 missing/unavailable/skipped 或待核验，最终 GateDecision SHALL 拒绝生产放行
- **AND** 未完成真实门禁时生产新发布及生产自治 SHALL 保持关闭；隔离夹具 MUST NOT 被登记为生产 passed

#### Scenario: 候选改变或版本未知使旧凭证不可复用

- **WHEN** 候选内容/依赖改变、证据指向另一摘要或消费者不支持契约主版本
- **THEN** 平台 SHALL 生成新候选并失效旧证据/审批，或在副作用前明确拒绝未知版本
- **AND** MUST NOT 用签名、已 published 状态、URL 或兼容开关补齐未知事实

### Requirement: 保留主体栈与持久真源的有依据 ADR

架构实施 SHALL 保留 Next/React/Nest/TypeScript、PostgreSQL/TypeORM、Nx/npm 及根唯一 npm 锁，以实际 workspace 与端口兼容推进；换框架/ORM/包管理器 SHALL 另立有依据的批准决策，不与边界整改捆绑。版本记录 SHALL 区分包范围、锁定快照与部署实测。PG SHALL 保留业务、安装、批准、关键幂等/任务和执行证据的持久真源，并复用已有 RLS、数据范围、PG jobs 与身份原语。Redis SHALL 只承担可丢缓存/缓冲/辅助唤醒；cache-manager 接线 SHALL 使用版本兼容的 Keyv stores 或显式 memory，MUST NOT 静默转 memory 后宣称多实例共享。浏览器 MUST NOT 持有模型凭据。

#### Scenario: 保留栈和模式明确的缓存渐进迁移

- **WHEN** 实施边界接缝或丢弃缓存后恢复业务/发布读取
- **THEN** 平台 SHALL 沿用已有框架/ORM/工作区并从受权持久真源恢复，缓存模式与版本 SHALL 可观测
- **AND** 缓存共享验收 SHALL 使用真实双实例、TTL/失效证据，版本验收 SHALL 记录同源码/锁摘要的实际结果

#### Scenario: 锁声明或单机缓存不能冒充部署事实

- **WHEN** 未执行运行验证、Redis 未就绪，或关键批准/幂等只有缓存记录
- **THEN** 平台 SHALL 明确未验收/配置模式并拒绝缺持久依据的关键操作
- **AND** MUST NOT 将旧评估版本、目标文档或单机 set/get 当当前部署事实，MUST NOT 为接模型而内联 NEXT_PUBLIC 模型密钥

### Requirement: 纯计算原子与单生产引擎的失败策略

Rust/WASM SHALL 限于既有 calculation/query、冻结 ABI、零能力与准入范围，MUST NOT 承担业务事务、command/effect、整域或新工作流。一个生产部署单元 SHALL 预先指定一个经批准且 ready 的执行引擎；Wasmtime SHALL 是目标生产引擎，V8 SHALL 仅用于隔离对拍或明确获准的存量部署。引擎配置 SHALL 枚举校验；未知值、摘要/握手不符、宿主未就绪或对拍差异 MUST 明确拒绝相关能力或切换。失败调用 MUST NOT 自动切换引擎或内置实现；正式原子准入、资源、输出、审计和吊销判据 SHALL 全部保留。

#### Scenario: 已核准单引擎执行与隔离对拍分开

- **GIVEN** 宿主/模块摘要、协议/版本 readiness 与既有准入已真实验收
- **WHEN** 指定部署执行冻结计算原子，或隔离环境对拍同一模块
- **THEN** 生产 SHALL 只用指定引擎，对拍 SHALL 留存双方真实结果且不成为生产自动备用
- **AND** 不依赖原子的业务能力 SHALL 可以在原子不可用时保持确定性服务

#### Scenario: 未知配置或引擎故障不转 V8 兜底

- **WHEN** ATOMIC_ENGINE 值未知、宿主缺失、协议失败、模块 trap/超预算/吊销，或生产开启自动 fallback
- **THEN** 平台 SHALL 拒绝配置、相关调用或切换并给出可诊断原因
- **AND** MUST NOT 以 V8/内置结果替代被拒调用，MUST NOT 为提高可用性扩大原子 IO 或业务权限

### Requirement: 既有拓扑与实例蓝图演进及源码交付的分离

平台 SHALL 保持已落地的 apps/libs 模块化拓扑，并复用 shared/dedicated/standalone 契约；实例独立部署 MUST NOT 被解释为每客户 fork 平台代码。业务域默认 SHALL 编译期打包，域内演进 SHALL 复用 Blueprint/Delta 和获准少量原子，不热更域代码。微服务/Kubernetes/ORM 换代 SHALL 需要独立实测依据与 ADR。源码 Agent SHALL 使用外围独立开发身份，经 PR、隔离构建/真实测试、独立批准、签名未公开进程工件和批准部署推进；Runtime Operator/Builder MUST NOT 热改生产源码或持有这些凭据。deploy、publish、activate SHALL 分别治理，安全回退 MUST NOT 恢复旧授权/证据/引擎旁路。

#### Scenario: 实例演进与外围源码交付各走其链

- **WHEN** 实例提出 Blueprint Delta，或独立开发 Agent 提交平台源码 PR
- **THEN** 前者 SHALL 走候选/发布/安装链，后者 SHALL 绑定源码 SHA、依赖锁、真实测试和签名进程工件经独立审批部署
- **AND** 本项 SHALL 不要求重做三 app 拆分，进程 deploy MUST NOT 自动成为业务 publish 或 installation activation

#### Scenario: 热改、混入平台 policy 或不安全回退被拒

- **WHEN** Runtime/Builder 请求 shell/git/部署密钥、把平台源码/工具契约/policy 混入实例 Delta，或回退企图恢复无批准发布与未知版本/自动引擎兜底
- **THEN** 平台 SHALL 在副作用前拒绝，保留当前安全安装、持久证据与拒绝门
- **AND** 源码回滚、元数据回退与数据补偿 SHALL 分别核验兼容证据；无依据服务化 MUST NOT 捆绑在本项边界实施
