## ADDED Requirements

### Requirement: AI Content Provenance

每份 AI 生成或 AI 辅助内容 SHALL 记录来源：生产者、agent/model、prompt/template 引用、
生成任务、时间、内容哈希与父内容。溯源 MUST 可查询，MUST NOT 明文保存敏感 prompt。
编辑/重新生成 MUST 形成新的内容版本/父链，MUST NOT 覆盖历史溯源。

#### Scenario: 生成内容可追溯

- **WHEN** Agent 生成一份教案
- **THEN** 系统 SHALL 写入 provenance（agent/model/task/contentHash）
- **AND** 按内容/资产 SHALL 能查到来源链

#### Scenario: 编辑后父链

- **WHEN** 教师编辑 AI 生成内容并保存新版本
- **THEN** 新版本 SHALL 关联父内容
- **AND** 旧版本溯源 MUST 保留

### Requirement: Explicit and Implicit Labels

AI 生成内容 SHALL 支持显式标识（页面/播放器/导出文件可见）与隐式标识
（元数据/水印/内容 ID）。标识 MUST 版本化，并记录应用/校验状态。
未按要求应用标识的内容 MUST NOT 发布或导出。

#### Scenario: 页面显式标识

- **WHEN** 用户查看 AI 生成内容
- **THEN** 页面/播放器 SHALL 显示“AI 生成”标识
- **AND** 标识文本/版本 SHALL 可配置

#### Scenario: 隐式标识

- **WHEN** 内容被下载/导出
- **THEN** 文件元数据/水印 SHALL 包含标识
- **AND** 标识 SHALL 可校验

### Requirement: Label Preservation

标识/水印 MUST 在转码、导出、分享、离线缓存等环节保留或重新应用。
任一环节校验失败 MUST 阻断该输出或标记 `label_missing`，MUST NOT 静默放行。

#### Scenario: 转码后保留

- **WHEN** 视频转码为 HLS/MP4
- **THEN** 输出 MUST 保留显式/隐式标识
- **AND** 校验失败 SHALL 阻断发布

#### Scenario: 离线包

- **WHEN** 生成离线内容包
- **THEN** manifest/文件 MUST 包含标识信息
- **AND** 客户端校验 MUST 能识别

### Requirement: Content Safety Providers

平台 SHALL 提供可插拔内容安全 provider，对输入与输出执行检测。
结果 MUST 为 `pass/warn/fail`；`fail` MUST 阻断；`warn` MUST 人工确认；
provider 异常/超时 MUST 按 fail-closed 处理。

#### Scenario: 检测失败

- **WHEN** 内容安全检测返回 `fail`
- **THEN** 内容 MUST NOT 发布
- **AND** 作者 SHALL 收到原因/证据

#### Scenario: 检测警告

- **WHEN** 检测返回 `warn`
- **THEN** 必须有授权人工确认
- **AND** 未确认 MUST NOT 通过

### Requirement: Human Final Review Gate

AI 生成内容 SHALL 经过“机器检测 → 人工复核 → 终审”卡点；
未整体通过 MUST NOT 发布、归档为正式内容或作为正式成绩依据。
作者 MUST NOT 自我终审（可配置四眼原则）。

#### Scenario: 未终审发布被拒

- **WHEN** 内容仍有待处理终审步骤
- **THEN** 发布 SHALL 被拒绝
- **AND** 错误 SHALL 指明当前步骤

#### Scenario: 越权终审

- **WHEN** 非授权用户尝试终审
- **THEN** 操作 SHALL 返回 403
- **AND** 状态 MUST NOT 改变

### Requirement: AI Score vs Human Score

AI 评分与教师评分 MUST 分开记录与展示。未终审的 AI 评分 MUST 标记为参考分，
MUST NOT 作为正式成绩、学术评价或纪律处分依据归档。
状态 MUST 支持 `ai_only` / `teacher_confirmed` / `appealed` / `final`。

#### Scenario: AI 参考分

- **WHEN** 测评只产生 AI 评分
- **THEN** 学生端 SHALL 显示“AI 参考分”
- **AND** MUST NOT 作为正式成绩归档

#### Scenario: 教师确认

- **WHEN** 教师确认/修改评分
- **THEN** 记录 AI 分、人工分、修改人与时间
- **AND** 状态 SHALL 进入 `teacher_confirmed`/`final`

### Requirement: Appeals and Policy Confirmation

学生 SHALL 能对 AI 评分/内容发起申诉，申诉 MUST 强制转人工复核。
学生首次使用或评分规则版本变更时 MUST 确认知悉 AI 评分的参考性质与教师评分规则；
确认 MUST 记录版本/时间/用户。

#### Scenario: 申诉

- **WHEN** 学生对 AI 评分发起申诉
- **THEN** 状态 SHALL 变为 `appealed`
- **AND** 必须人工复核后才能 `final`

#### Scenario: 规则确认

- **WHEN** 评分规则版本更新后学生首次查看
- **THEN** 系统 SHALL 要求确认
- **AND** 未确认 MUST NOT 将 AI 分展示为正式结果

### Requirement: Traceability and Audit

生成、标识应用/校验、检测、终审、评分确认、申诉、修改 MUST 写入审计，
包含内容/任务/操作者/时间/结果。审计 MUST 可查询且防篡改（配合审计链）。

#### Scenario: 全链路追溯

- **WHEN** 管理员查询一份 AI 内容
- **THEN** 结果 SHALL 包含生成来源、检测、复核、标识与评分状态
- **AND** 关键动作 SHALL 有审计记录

### Requirement: Backward Compatibility

本能力 MUST NOT 改变非 AI 内容、旧审批/评分流程与既有知识库敏感信息检测。
旧内容 MAY 标记 `legacy/unlabeled`，MUST NOT 因未回填而阻断读取；
发布策略可按内容类型/租户配置。

#### Scenario: 旧内容读取

- **WHEN** 读取未标记的旧内容
- **THEN** 内容 SHALL 正常返回
- **AND** 标记为 legacy/unlabeled

#### Scenario: 非 AI 内容

- **WHEN** 人工创作内容未声明 AI 治理
- **THEN** 不强制标识/检测
- **AND** 原发布流程保持不变
