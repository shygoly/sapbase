# 工作台草稿 Patch 增量规范

## MODIFIED Requirements

### Requirement: Publish Pipeline for Patches
The system SHALL apply patches through a defined pipeline before schema changes are persisted.

For the human-AI workbench, Apply and Versioned Save MUST execute in the platform's trusted draft namespace against expectedRevision; the browser SHALL only propose, preview and submit patches, never hot-edit production schemas or claim publication/activation. The platform SHALL reuse existing server-side Patch/Delta application and draft lifecycle, return a new draft revision/snapshot with platform-computed digest and trusted actor/context audit, and preserve existing Patch shape, scope/operation enumeration and metadata extraction requirements. Unsupported operations MUST still fail explicitly. Draft success MUST NOT grant approval, signing, publish or activation; production changes require candidate-bound real evidence and independent release governance.

#### Scenario: Pipeline sequence before schema persistence
- **WHEN** a patch apply action is triggered (after AI or human produces the patch)
- **THEN** the system SHALL run: Validator -> Dry Run -> Apply -> Versioned Save
- **AND** Validator SHALL reject invalid patches and assign security level
- **AND** Dry Run SHALL simulate application without writing
- **AND** Apply SHALL modify schemas via the patch executor
- **AND** Versioned Save SHALL create a new schema version with patch metadata
- **AND** workbench schemas and schema versions SHALL be draft-scoped, with success shown only after the platform accepts expectedRevision and persists the revision; production releaseDigest MUST remain unchanged

#### Scenario: Publish status does not imply schema applied
- **WHEN** module lifecycle status is set to published
- **THEN** the system SHALL NOT claim schema changes were applied unless the patch pipeline completed successfully
- **AND** if pipeline completion is decoupled from lifecycle status, the system SHALL keep these states explicit and non-ambiguous
- **AND** a completed draft pipeline MUST NOT be presented as published or effective in production

#### Scenario: Browser success and stale revision cannot persist production changes
- **WHEN** browser preview reports success or a patch is labelled L1, but expectedRevision is stale, the operation is unsupported or any platform pipeline stage fails
- **THEN** the platform MUST reject persistence without a successful draft revision or production modification
- **AND** the workbench SHALL retain the proposal and show a real failure/conflict; client actor/securityLevel/confirmed MUST NOT supply platform authorization or publication rights

## ADDED Requirements

### Requirement: 工作台批量Patch原子累计草稿修订

平台 SHALL 将工作台有序Patch批次适配到既有Delta/可信草稿服务，基于同一基线顺序累计，后续Patch MUST 读取前序结果。全部目标/权限/引用/依赖及expectedRevision MUST 经服务端校验，以锁/CAS和事务一次追加带父revision、完整快照/权威digest、patchIds及可信审计的新revision；任一失败全批不落，不接受客户端最终快照为真源。编译预览工件 SHALL 隔离生成并绑定成功revision，不覆盖已公开包。requestId/请求摘要 MUST 持久保存且重放前重新授权，同key同摘要返回同结果、同key不同摘要拒绝；合法草稿回退只追加revision不覆写历史，生产回退仍归安装治理。

#### Scenario: 有序累计一次提交并可重放
- **WHEN** P1新增字段且P2依赖它更新展示，全部校验通过并提交批次
- **THEN** 平台 SHALL 一次保存保留原字段及P1/P2累计结果的新revision、父revision及patchIds，生产digest不变
- **AND** 同requestId/同摘要重启后重放 SHALL 再授权并返回同一结果，不重复生成revision

#### Scenario: 中间失败或冲突全批拒绝
- **WHEN** 后序Patch验证/持久化失败、依赖成环、expectedRevision竞争失败、幂等key换摘要或请求覆写历史
- **THEN** 平台 MUST 拒绝/回滚全批，不留下前序字段、部分成功revision或公开工件覆盖
- **AND** 工作台 MUST 显示真实拒绝；合法回退只能追加草稿revision，不能本地热改生产Registry
