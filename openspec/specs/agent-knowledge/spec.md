# agent-knowledge Specification

## Purpose
TBD - created by archiving change add-agent-knowledge-and-eval. Update Purpose after archive.
## Requirements
### Requirement: Versioned Knowledge Entries

系统 SHALL 以只追加版本的方式管理 `KnowledgeEntry`，每条知识有 scope、版本与状态。

#### Scenario: Knowledge version is appended
- **WHEN** 发布一条知识的新版本
- **THEN** 系统 MUST 新增一行 `agent_knowledge_entries`
- **AND** MUST NOT 原地修改旧版本内容

#### Scenario: Scope restricts visibility
- **WHEN** 知识 scope 为组织、部门或个人
- **THEN** 系统 MUST 只对对应范围用户可见
- **AND** 全局知识 MUST 由平台发布并对所有组织可见

#### Scenario: Old version is superseded
- **WHEN** 同一 `scope + scopeId + knowledgeKey` 的新版本发布
- **THEN** 旧 active 版本 MUST 标记为 `superseded`
- **AND** 旧版本 MUST 仍可按历史查询

### Requirement: Knowledge Publish Workflow

知识 SHALL 经过提议、审核、发布后才可被 PiAgent 使用。

#### Scenario: Draft is not searchable
- **WHEN** 知识处于 `draft` 或待审核状态
- **THEN** Runtime 检索 MUST NOT 返回该知识
- **AND** 模型 MUST NOT 在回答中引用它

#### Scenario: Author cannot approve own knowledge
- **WHEN** 知识起草人尝试批准自己起草的知识
- **THEN** 系统 MUST 拒绝
- **AND** 必须由其他有权限的人批准

#### Scenario: Rollback republishes old content
- **WHEN** 管理员回退知识版本
- **THEN** 系统 MUST 用旧版本内容发布一个新版本
- **AND** MUST NOT 修改历史版本行

### Requirement: Sensitive Information Gate

知识发布前 SHALL 执行敏感信息检查，检测异常时 fail-closed。

#### Scenario: Unconfirmed sensitive content blocks publish
- **WHEN** 知识正文、changelog 或示例数据中检测到手机号、证件号、姓名或合同片段
- **THEN** 系统 MUST 要求逐条确认“通用名称/已脱敏”
- **AND** 未确认时 MUST 拒绝发布

#### Scenario: Detector failure blocks publish
- **WHEN** 敏感信息检测组件异常或降级
- **THEN** 系统 MUST 拒绝发布
- **AND** MUST NOT 静默放行

### Requirement: Release-Bound Knowledge Retrieval

Runtime 回答 SHALL 只使用当前 Release 绑定且对用户可见的已发布知识，并记录知识版本。

#### Scenario: Answer cites knowledge version
- **WHEN** PiAgent 使用知识回答
- **THEN** 回答 MUST 带 `[kn:<id>@<version>]` 引用
- **AND** 审计 MUST 记录 `knowledgeVersion`

#### Scenario: Unactivated knowledge is hidden
- **WHEN** 用户询问只存在于未激活 Release 的知识
- **THEN** PiAgent MUST 回答当前版本没有该内容
- **AND** MUST NOT 泄露未激活版本的内容或路线图

