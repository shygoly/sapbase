# Chat ERP 工具生命周期接线增量

## ADDED Requirements

### Requirement: 既有 MCP 工具视图的同轮主体与版本收窄

平台 SHALL 从既有契约及 MCP 投影为每个 turn 生成用户/profile/有效版本绑定、agentInvocable、allowedAgents、权限与相关性/预算共同收窄的 catalog，完整入选参数 schema/confirmation/timeout/契约摘要供模型与 selector 消费。进程 AGENT_HOST_PROFILE 或全工具清单 MUST NOT 代替每用户授权；profile 和权限 MUST 来自可信平台引用，不接受模型 arguments 覆盖。Agent 调用 MUST 经既有 MCP 桥与同一 Registry；Registry MUST 独立核验完整契约、当前权限与已声明数据范围，范围 principal MUST 为稳定平台 userId，不以 display actor/email 代替。数据/知识/反馈/工具文本 MUST 作为限长脱敏且带 source/version/nonce 的数据，MUST NOT 扩展 SQL、HTML、任意 URL、shell、审批/发布/激活或数据库直连权能。

#### Scenario: 同一 profile 不同用户得到各自工具子集
- **GIVEN** 两名 Runtime 用户的权限不同，当前版本仅绑定其中部分工具
- **WHEN** 请求模型 catalog 或 MCP 工具视图并执行入选查询
- **THEN** 每人 SHALL 只见其可信 turn 入选工具及完整 schema，调用 SHALL 仍经同一 Registry all-of/数据范围判定
- **AND** 平台 SHALL 按稳定 userId 解析范围，不重建范围策略或凭进程列表放行

#### Scenario: 隐藏工具或不可信数据试图扩大权能
- **GIVEN** 模型输出未入选/Builder/未声明工具，或业务文本含伪造 nonce、身份/profile、SQL/HTML/未批准 URL 指令
- **WHEN** selector、MCP 或 Registry 处理该内容
- **THEN** 平台 MUST 保持数据与可信引用边界并拒绝越界能力，不绕过 Registry 或换工具/直连服务
- **AND** 原始数据包装或 MCP 注解 MUST NOT 被当作授权或提示注入已安全通过的证明

### Requirement: 既有确认令牌的持久动作修订绑定

平台 SHALL 在原 turn 保存 pendingAction id/revision、稳定 userId/org、installation、固定 ReleaseContext、tool/契约摘要、canonical argsDigest、对象 expectedVersion、status/expiry。确认 MUST 由可信用户明确提交 turn/action/expectedRevision 引用，平台回读参数与最新身份/权限/版本资格后签发既有 opaque token。令牌 MUST 绑定稳定 user/turn/action revision/安装/Release/tool/argsDigest/expiry，并沿用 canonical SHA-256 与条件 UPDATE 一次性消费；TTL MUST 不超过现五分钟上限、动作 expiry 与 turn deadline 最小值。编辑 MUST 服务端验证并 CAS 新修订/摘要、撤销旧 token、重新等待用户确认；模型或任意 tool/args MUST 不独立签发确认。

#### Scenario: 原用户确认有效动作修订
- **GIVEN** 有效 turn 的待确认动作未过期，原用户会话及当前权限有效
- **WHEN** 用户明确提交 pendingActionId/turnId/expectedRevision 确认并执行
- **THEN** 平台 SHALL 回读冻结参数并签发完整绑定 token，在同一确定性命令事务的前置接缝条件消费
- **AND** 真实命令结果 SHALL 可关联原 user/turn/action revision/Release/argsDigest，不把签发或计划当执行成功

#### Scenario: 编辑或换主体版本后旧 token 失效
- **GIVEN** 已签 token 的动作被编辑，或请求换 user/turn/action revision/安装/Release/tool/参数摘要
- **WHEN** Registry 尝试确认或消费
- **THEN** 平台 MUST 拒绝旧/不一致绑定；编辑成功 SHALL 撤旧 token 并返回新修订等待重确认
- **AND** 同组织权限、相同 email 或模型自称已确认 MUST 不替代绑定一致与用户确认

#### Scenario: 过期弱绑定和并发重复消费拒绝
- **GIVEN** token 已过期/已消费/缺新绑定，或两实例并发消费同一有效 token
- **WHEN** 平台准备业务写入
- **THEN** 弱绑定及失效 token MUST 拒绝，有效 token 的条件消费至多放行一次真实命令执行
- **AND** 失败分支 MUST 无业务副作用，不自动续期或迁移旧 token 为可执行新确认

### Requirement: Registry 幂等恢复的再授权与命令事务接缝

Registry SHALL 在任何幂等结果返回前验证当前身份/会话、user/org/安装/版本/profile、参数与动作绑定、功能权限及数据范围，随后复用确定性 CommandService 的持久 claim/result，MUST NOT 以进程 writeCache 充当执行账本。幂等命名空间 MUST 含 org/user/installation/Release/tool，请求摘要 MUST 绑定 turn/action revision/argsDigest；同 key 不同摘要 MUST 冲突。首次 DB 写 MUST 在 CommandService 同 EntityManager 短租户事务中衔接 turn/action CAS、条件 token 消费、持久命令执行结果及业务事件；不能安全衔接的写工具 MUST 不开放。恢复 SHALL 消费真实 Registry 生命周期，不从 plan.trace/job 状态推测成功；结果未知、DENIED/CONFLICT/INTERNAL MUST 不盲重试或换 key/tool 绕过。

#### Scenario: 同摘要重连只读取原命令状态或结果
- **GIVEN** 原动作已持久认领或完成，实例重建后原用户仍有有效会话/权限与版本资格
- **WHEN** 同一 turn/action 摘要和幂等 key 恢复
- **THEN** 平台 SHALL 再授权后返回原 claim 的进行中状态或同一真实结果/toolCallId，不新建写命令或再次消费 token
- **AND** 首次命令提交 SHALL 与确认/CAS/结果/业务事件一致，完成恢复后的实际写数保持一次

#### Scenario: 撤权异摘要或未知结果不得命中绕过和重写
- **GIVEN** 会话吊销/权限范围撤销、key 与动作摘要不符，或写提交/回读故障导致结果未知
- **WHEN** Registry 恢复请求或编排器准备继续
- **THEN** 平台 MUST 拒绝撤权/越界或返回摘要冲突；未知结果 SHALL 查持久命令/真实事件并明确 reconcileRequired
- **AND** MUST NOT 授权前返回缓存、以无结果当未执行、重复写、换 key/tool 或在业务未证实成功时报告完成
