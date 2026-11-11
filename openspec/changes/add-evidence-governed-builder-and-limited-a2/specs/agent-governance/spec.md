## ADDED Requirements

### Requirement: Verified Feedback Provenance at the Builder Consumer

平台 SHALL 在既有反馈/topic 能力上核验可信组织、用户、安装、实际使用 releaseDigest 与 trace/tool 事件归属，记录核验来源与状态；客户端提供的上下文 MUST 只作提示。正文 MUST 脱敏后保存，失败不存正文；实际 Builder 消费路径 MUST 将反馈与指标说明标记为 untrusted，不能仅有未调用的包装函数。去重 MUST 保持组织/安装/screen 边界，保留真实来源与频次，不把所有 NULL 正文合并或采信自报 count。

#### Scenario: Verified feedback becomes topic evidence
- **GIVEN** 已授权用户在可信安装版本下反馈，引用属于该作用域的真实事件
- **WHEN** Builder 读取并归并议题
- **THEN** 平台 MUST 保存使用版本、核验事件、脱敏状态和可追溯来源，并在实际模型输入标为不可信数据
- **AND** 同范围重复反馈 MUST 更新可核验计数，手工无 trace 反馈只记录能够核验的上下文，不补造工具事件

#### Scenario: Forged evidence and masking failure do not become trusted facts
- **GIVEN** 反馈引用其它组织/安装事件、不能证明的旧版本，或脱敏失败、正文要求发布/扩权
- **WHEN** 平台记录或消费反馈
- **THEN** 跨范围引用 MUST 拒绝，无法核验的历史关联 MUST 标未验证/冲突，脱敏失败 MUST 不存正文
- **AND** 正文指令 MUST 不扩大工具/策略权限，缺正文反馈 MUST 不因 NULL 去重而丢失独立来源

### Requirement: Issued Builder Principal and Candidate-Only Tool Authority

平台 SHALL 由可信授权入口签发绑定发起人、组织/安装、piagent-builder profile 与候选 namespace 的主体；普通 body/header/模型/进程工具列表 MUST 不能声明用户的 Builder 权限。Builder MUST 仅经唯一 Registry 使用该候选范围内显式允许的既有 builder_* 工具；未声明 allowedAgents 的非 Builder 工具 MUST 不向 Builder 默认开放。Builder/候选环境 MUST 无生产业务写、approve/publish/activate/policy、宿主文件/shell或生产密钥能力，预览只消费冻结候选与可撤销范围凭据。未发布经验 MUST 不影响其他会话。

#### Scenario: Authorized Builder uses the existing tool gateway
- **GIVEN** 平台为授权发起人签发受限 Builder 主体与候选范围
- **WHEN** Builder 经现有 MCP/Registry 提交 Delta、请求校验或预览
- **THEN** 平台 MUST 保留发起人和 Agent 两个身份，限制到同一 AppDraft/候选，返回真实 job 状态或证据
- **AND** 写工具 MUST 沿用确认要求，模型不得自行确认；已有 MCP 投影与 direct 兼容路径 MUST 复用同一判定

#### Scenario: Profile spoofing and implicit tool access are denied
- **GIVEN** Runtime 自报 Builder，或 Builder 请求未显式许可的 erp_module_export 并传服务器 dir/out，或候选凭据请求生产管理能力
- **WHEN** 调用工具或资源入口
- **THEN** 平台 MUST 在副作用前拒绝并记录真实拒绝，不因缺 allowedAgents、有效普通权限/确认或隐藏工具 URL 放行
- **AND** Builder 被禁用后 MUST 撤销候选授权；人工草稿入口与历史数据保留，但不能恢复生产旁路

### Requirement: Candidate-Bound A1 Evolution Lineage Using Existing Jobs

平台 SHALL 复用现有 PG jobs/type registry/event 接线，维护反馈、topic、Delta/草稿修订、platformVersion/evolutionScope、冻结 candidateDigest、真实测试评测/预览、审批、签名制品、最终 GateDecision、发布、实际安装修订和效果窗口的不可变关联。实例演进范围/版本 MUST 消费既有实例进化契约并由平台核验；缺绑定不得发布。阶段状态 MUST 来自实际结果，完成观察前不得标反馈解决；阶段请求摘要、租约 fencing、幂等、预算/取消与重启恢复 MUST 复用前置运行时/发布/安装基础，不新增任务引擎。

#### Scenario: A1 completes only with a real effect window
- **GIVEN** 冻结候选绑定当前平台/实例范围，并已通过同摘要真实测试评测与预览
- **WHEN** 独立真人批准，平台签名未公开制品并取得最终 GateDecision 后 published 和实际激活，效果窗口符合验收
- **THEN** 工作台 MUST 能从反馈追到全部引用与实际使用版本，才标 completed/反馈解决
- **AND** 候选评测 MUST 不要求先 published；任何 diff 修改 MUST 生成新修订并重新取证/批准

#### Scenario: Pending or legacy evidence cannot complete the chain
- **GIVEN** 只有计划、候选、待批准状态，或历史记录缺版本/证据，或指标不可用
- **WHEN** 工作台或资格服务读取链路
- **THEN** 平台 MUST 显示实际 pending/blocked/unavailable/legacy_unverified，不补造成功、发布、版本或效果
- **AND** 必需真实评测缺失 MUST 不允许生产自治，旧稳定安装可继续确定性运行

#### Scenario: Cancellation and restart preserve committed facts
- **GIVEN** 阶段被取消/租约丢失或提交结果未知，随后 worker 重启/重放
- **WHEN** 恢复链路
- **THEN** 平台 MUST 查实际结果并以持久请求摘要和 fencing 阻止重复逻辑发布/激活与终态覆盖
- **AND** 已提交变化 MUST 保留审计并转受控恢复，不能宣称取消撤销了已提交安装事务
