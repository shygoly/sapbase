# PiAgent Runtime 消费者接线增量

## ADDED Requirements

### Requirement: 正式意图依赖注入与真实 Provider 路由证据

平台 SHALL 在正式 Agent 会话的 Nest DI 中将既有 INTENT_PARSER 接至 Hybrid 与已注册服务端 provider adapter，保留规则优先路径。模型 SHALL 仅作为外围 Agent Host 的理解/提议能力，业务 Kernel MUST 保持确定性且不包含 Jev。adapter MUST 消费平台固定配置版本与服务端凭据引用，不向客户端、Envelope、事件或日志暴露密钥；每次模型步骤 MUST 关联 turn、route/reason、provider 请求标识、模型标识/可得版本、adapter 版本和实际 usage/来源。旗标、模型实体或拒绝文案 MUST NOT 作为真实模型调用证据；未验证协议/用量限额能力 MUST 不启用。

#### Scenario: 非规则意图经实际模型端口完成
- **GIVEN** 当前用户与安装/有效版本已核验，规则不匹配但入选工具支持所需查询
- **WHEN** 正式 Agent 会话解析该请求
- **THEN** Hybrid SHALL 经注册 adapter 发起真实模型请求，校验结构化意图后交同一 selector/Registry
- **AND** 同一 turn SHALL 可追溯固定配置、adapter、provider requestId 与实际 usage 来源

#### Scenario: 规则快路有真实零模型调用证据
- **GIVEN** 请求命中已冻结的规则且工具属于当前 turn 子集
- **WHEN** Hybrid 解析请求
- **THEN** 平台 SHALL 记录 route=rule 和该步骤模型调用数零，仍执行同一权限、预算与工具校验

#### Scenario: 模型或协议不可用不伪装智能成功
- **GIVEN** 模型关闭、引用缺失、超时、结构化输出非法或无法强制用量上界
- **WHEN** 请求需要模型理解
- **THEN** 平台 MUST 明确返回不可用/未完成并可引导同权限链的规则查询或人工表单
- **AND** MUST NOT 编造答案、报告模型成功、静默换 provider 或放宽工具能力

### Requirement: 同一持久轮次的权威 Envelope 与实际记忆消费

平台 SHALL 用持久 turn.id 编译并保存必要脱敏 ContextEnvelope 快照及统一 canonical hash，贯通模型、selector、既有 MCP 平台引用与 Registry/Command 执行上下文。稳定 user/org/当前权限和会话有效性 MUST 来自平台身份；安装 MUST 经 X-App-Id 与平台服务核验，有效 ReleaseContext MUST 复用唯一版本解析器。页面/对象 MUST 从固定版本 Schema 与同一权限/数据范围 QueryService 回读，含 expectedVersion、状态、allowedActions 和允许可见权限原因。必要历史 MUST 保留 turn/release provenance；知识/技能 MUST 按已发布、租户/作用域和固定版本实际检索，回答引用 MUST 属于本次实际提供的片段，不得自动列满查询条目。客户端提示、旧历史、仅 hash 或随机不同 turnId MUST NOT 取代权威上下文。

#### Scenario: 当前对象及实际检索进入同轮所有消费者
- **GIVEN** 用户选中当前有效应用可见记录，检索召回一个已发布且有权限的固定知识片段
- **WHEN** 用户请求查看或解释这条记录
- **THEN** 模型与 selector SHALL 消费相同 turn.id/快照/hash、对象版本/动作及必要脱敏历史，Registry SHALL 消费对应可信安装/ReleaseContext
- **AND** 平台 SHALL 保存实际 entryId/version/digest/source 并只接受本轮真实输入片段的引用

#### Scenario: 伪造或越界上下文和引用拒绝
- **GIVEN** body/提示词声明他人身份、另一安装、隐藏记录、伪造 allowedActions 或未召回/未发布知识
- **WHEN** 编译上下文、恢复既有 conversation 或校验引用
- **THEN** 平台 MUST 拒绝越界目标/跨安装会话并不采信身份与动作覆盖，未实际输入的引用 MUST 无效
- **AND** MUST NOT 将受禁内容送模型、泄露 Protected 定义或用 NULL/latest 兜底为生产事实

#### Scenario: 固定版本执行资格改变
- **GIVEN** turn 已绑定某 Release，但用户当前路由/安装修订/数据代际的执行资格变化
- **WHEN** 平台准备确认或执行旧动作
- **THEN** 平台 MUST 按唯一 ReleaseContext 判定返回明确 stale/不可执行，新 turn 重新回读和确认
- **AND** MUST NOT 静默在新版本执行旧参数或把旧历史结果当当前事实/授权

### Requirement: 全链持久预算与中断接缝

平台 SHALL 持久保存每 turn 的 policyVersion、累计 token/tool 已耗与预留额度及绝对 deadlineAt，独立于模型强制执行。provider/检索/selector/MCP/Registry/工具与既有 JobContext MUST 共享 TurnControl 和合成 AbortSignal；模型前 MUST 保守计入输入并限制输出，工具认领前 MUST 检查状态、累计次数与剩余期限。usage MUST 记录实际来源，不得缺失填零；无法验证硬上界的 adapter MUST 不启用。重连、重启、编辑、幂等命中和确认等待 MUST NOT 重置预算/deadline；等待策略调整 MUST 来自批准的版本化 policy，不得暗中停表或无限续期。

#### Scenario: 剩余额度内真实结算
- **GIVEN** 一个具有已验证计数/usage 能力的 provider 及有效 turn 预算
- **WHEN** 检索、模型步骤和工具认领执行
- **THEN** 平台 SHALL 调用前预留、调用后按真实 usage 结算并关联 turn，局部 timeout SHALL 不超过剩余绝对期限
- **AND** worker 重建或授权结果恢复 SHALL 保留已耗与预留状态而非重新初始化

#### Scenario: 预算或取消阻止后续步骤
- **GIVEN** 任一额度耗尽、deadline 已过、取消已成功或用量能力不可验证
- **WHEN** 模型/工具晚到结果或 worker 重领试图推进
- **THEN** 平台 MUST 传播中断并禁止新模型请求/工具认领，返回已完成真实部分与未完成/不可用原因
- **AND** MUST NOT 忽略未知 usage、重置额度或宣称中断已回滚先前提交的业务事实

### Requirement: 执行中持久 SSE 与安装授权游标

平台 SHALL 在参数/身份/安装/会话预检后且模型/工具尚未完成前 flush turn.start，随后边执行边持久后推送既有 SSE 事件，不得仅结束后输出事件数组。每帧 MUST 带 turnId、stateRevision 与持久 turnId:seq 游标；工具事件 MUST 关联真实 Registry sourceEventId/toolCallId，不从 plan.trace 或 job 成功生成执行事实。回放/历史/订阅 MUST 验证 user/org/installation/turn 归属并对拍序号，至少一次投递按 id 去重，MUST NOT 重跑动作。计划 MUST 完整经过封闭 interaction-plan 校验；未知事件 SHALL 忽略并记录，不授予能力。

#### Scenario: 首事件先于阻塞完成且重连仅回放
- **GIVEN** 请求已通过预检，模型或工具被受控阻塞
- **WHEN** HTTP 客户端建立流并在接收部分事件后断线，用同一授权 turn 游标重连
- **THEN** 客户端 SHALL 在阻塞未完成前收到 turn.start，解除阻塞后收到持久真实结果与明确状态
- **AND** 恢复 SHALL 对拍回放/订阅 seq、去重事件，不另跑模型/写命令

#### Scenario: 越界游标非法计划或慢连接
- **GIVEN** 游标属于另一用户/安装、恢复参数冲突、计划含未知 kind 或连接背压超界
- **WHEN** SSE 网关处理请求或输出
- **THEN** 平台 MUST 拒绝越界/冲突游标与整份非法计划，慢连接 SHALL 有界关闭但保留授权可恢复事件
- **AND** MUST NOT 泄露敏感正文或以 HTML/SQL/任意 URL 文本旁路计划能力限制

### Requirement: PG Job 驱动下同轮 CAS 与待确认恢复

平台 SHALL 复用 PG jobs 驱动/lease/中断基建并以 Agent turn 持久状态作为 Agent 真源，保存必要脱敏 message/Envelope/validatedPlan/pendingAction、预算及状态修订。每次推进 MUST 在带 RLS 的短事务以预期状态/revision/当前驱动资格 CAS 并追加事件；网络模型、人工等待和 SSE 连接 MUST 不持有全请求 DB 事务，也不得跳过租户上下文裸查询。waiting_confirmation MUST 不算 completed；cancelled/timed_out/failed/interrupted 终态 MUST 不被晚到完成覆盖。恢复 MUST 对账原 turn、期限/版本/命令事实，不将 Redis/内存或 job.succeeded 当 Agent/业务成功依据。

#### Scenario: 进程与 Redis 重建后恢复同一待确认修订
- **GIVEN** 原 turn 等待确认且动作期限/版本资格仍有效，进程重建并丢失 Redis
- **WHEN** 同一授权用户恢复会话
- **THEN** 平台 SHALL 从 PG 返回原 turnId/action revision/脱敏计划/剩余额度，仅有效驱动资格可推进
- **AND** SHALL 保持短租户事务，MUST NOT 重跑模型、自动签发确认或把等待标为成功

#### Scenario: 取消与完成竞态不能覆盖终态
- **GIVEN** 用户按 turnId/expectedStateRevision 的取消 CAS 已成功
- **WHEN** 晚到完成或旧 worker 尝试更新/认领下一工具
- **THEN** 条件更新 MUST 不覆盖 cancelled，新工具认领 MUST 为零
- **AND** 取消前已提交命令 SHALL 仅作真实结果对账，MUST NOT 声称业务已撤销

#### Scenario: lease 重领遇未知写或失效动作
- **GIVEN** job lease 回收重新排队、写结果未知、动作过期或版本执行资格失效
- **WHEN** 新 worker 处理原 turn
- **THEN** 平台 MUST 先查持久命令/真实事件并暴露 interrupted/reconcileRequired 或过期，失效内容仅可授权历史展示
- **AND** MUST NOT 无证据重写、无限续期、恢复弱绑定旧 token 或用 job 成功替代工具证据
