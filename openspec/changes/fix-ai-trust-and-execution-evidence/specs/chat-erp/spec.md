# Registry 事实生命周期与早期生产拒绝

## ADDED Requirements

### Requirement: Registry全路径产生真实持久执行证据

所有受控 direct/MCP/会话工具执行 SHALL 经既有 Registry；Registry SHALL 对 received、工具/profile/参数/应用上下文/权限/数据范围/确认拒绝、execution_started 与真实结果产生追加持久事件。事件 MUST 关联可信稳定 userId/组织/适用安装、会话/turn、tool/version、attemptId/seq、实际规范 argsDigest、判定、confirmationId、结果码/摘要/授权引用及时间；email MUST NOT 代替稳定主体 ID。摘要 MUST 在脱敏前复用共享 canonical JSON/SHA-256；未判定权限 SHALL 标 not_evaluated。现有共享范围和确认硬拒 MUST 保留，MUST NOT 建第二授权路径；客户端或模型 MUST NOT 写改删证据。

#### Scenario: 确认后的真实结果可核对
- **WHEN** 获授权且已确认的调用实际完成
- **THEN** 开始与结果事件 SHALL 使用相同 attemptId、稳定用户、真实 argsDigest 与 confirmationId
- **AND** 投影 SHALL 可核对实际输出或业务记录，重复投影 MUST NOT 再制造成功

#### Scenario: 执行前各类拒绝有事实
- **WHEN** 已认证调用因未知工具/profile、参数、应用上下文、权限、声明的数据范围或确认检查失败
- **THEN** 对应拒绝 SHALL 留真实候选摘要、可信主体和阶段/原因，工具 SHALL 零次执行
- **AND** 未评估权限 SHALL 为 not_evaluated；无法解析请求字节 SHALL 由入口安全审计记录 raw_invalid/requestDigest，不伪造有效 argsDigest

#### Scenario: 运行异常和证据不可用不制造成功
- **WHEN** 工具抛异常、执行前事件持久化失败，或执行后结果事件持久化失败
- **THEN** 真实异常 SHALL 形成 execution_failed；执行前证据故障 MUST 拒绝 invoke；执行后故障 SHALL 保留 attemptId 并标 outcome_unknown/待核实
- **AND** MUST NOT 用模型文案补 success、宣称副作用已回滚或盲重试写；伪造证据 SHALL 被拒绝

### Requirement: 计划与历史投影不得推测工具成功

会话与页面 SHALL 区分 proposed/pending_confirmation 和实际 Registry 尝试；MUST NOT 从 plan.trace.tools、会话完成、模型文字或工具名列表生成执行成功/permissionOk=true。成功事实 trace SHALL 仅引用真实 execution_succeeded 的 attemptId/eventId；无真实来源旧记录 SHALL 为 legacy_unverified，缺可核实终态 SHALL 为 outcome_unknown，二者 MUST NOT 进入成功统计或发布证据。

#### Scenario: 真实结果形成唯一事实来源
- **WHEN** 只读或确认后的工具真实成功并生成计划
- **THEN** 会话 SHALL 引用 Registry 结果事件并形成一致投影
- **AND** 事实来源 SHALL 可查真实结果，不因历史重放新增执行成功

#### Scenario: 待确认和旧推测记录不算执行
- **WHEN** 写请求仅返回计划，或读取旧 trace 推测 success/只有 started 的历史
- **THEN** 待确认计划 SHALL 保留 actionId 且 invoke/成功记录均为 0；旧推测与未知结果 SHALL 明确标未核实
- **AND** 页面、审计与统计 MUST NOT 显示这些状态为已执行成功或发布通过

### Requirement: 生产候选与自治放行拒绝非真实证据

平台 SHALL 默认拒绝生产新候选 publish/activate 及 A1/A2 放行，并保持 A2 关闭，直到受控 runner 和实际必需证据经验收。调用方 caseResults/通过标志、计划 trace、非空 URL、仅新鲜但未绑定候选的测试缓存、policy 扫描记录 MUST NOT 构成放行证据；missing/unavailable/skipped、空套件、混摘要 MUST NOT PASS。后续证据 MUST 绑定冻结 candidateDigest，不要求先 published；顺序 SHALL 为冻结候选→真实测试评测→审批→签名未公开工件→最终 GateDecision→published→activation。A2 SHALL 另等有限自治治理与批准，Agent MUST NOT 自改策略解锁。

#### Scenario: 隔离候选和既有稳定业务保持可用
- **WHEN** 闸门尚未验收，既有稳定安装执行确定性业务，或独立非生产数据/凭据环境评测冻结候选
- **THEN** 符合既有权限的业务与隔离开发 SHALL 继续，候选 SHALL 无需 published 就能评测
- **AND** 隔离结果或文档提交 MUST NOT 自动解锁生产/A2

#### Scenario: 自报和未就绪闸门拒绝所有生产入口
- **WHEN** HTTP、内部调用或后台策略以旧开关=true、自报/空/混候选/缺必需证据申请生产候选发布、激活或自治资格
- **THEN** 平台 MUST 拒绝且在副作用前记录可信拒绝原因，保持 A2 关闭
- **AND** 人工批准、应急标记、程序回退或缺指标的扫描 success MUST NOT 绕过该拒绝；真实 runner 未验收 MUST NOT 放行自治
