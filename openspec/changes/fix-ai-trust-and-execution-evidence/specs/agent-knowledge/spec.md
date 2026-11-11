# 知识与技能的可信命名空间补充

## ADDED Requirements

### Requirement: 知识和技能版本操作使用可信完整命名空间

平台 SHALL 以 `(organizationId, scope, scopeId, knowledgeKey)` 为知识命名空间，并以组织或平台归属加 skillKey 为技能命名空间；版本分配、来源读取、历史、发布替换及回滚每一步 MUST 采用完整谓词与可信主体授权。global MUST 规范为 NULL 组织/范围 ID，仅独立平台权限可管理；组织 scopeId MUST 规范为本组织，部门/个人 ID MUST 核验同组织成员及范围权限。查询到知识 MUST NOT 被当作已经送入或使用的模型引用证据。

#### Scenario: 自身范围与版本可用
- **WHEN** 用户在获授权的组织/部门/个人范围读取或提交知识版本，或注册组织技能版本
- **THEN** 平台 SHALL 仅访问该完整命名空间，允许不同组织各自存在同名版本
- **AND** 结果 SHALL 携带真实版本/归属/内容摘要，不凭检索列表声称模型已使用

#### Scenario: 跨组织或伪造范围拒绝
- **WHEN** 用户提交他组织 entryId、他人 scopeId、伪造组织或技能归属以查询、发布或回滚
- **THEN** 每个来源查询与写步骤 MUST 拒绝或返回一致不可访问结果，不泄露正文/标题
- **AND** 他域内容、版本与 published 状态 MUST 保持不变

#### Scenario: global 管理独立授权
- **WHEN** 普通组织管理员和获独立平台知识权限的身份分别申请 global 管理
- **THEN** 只有平台身份 SHALL 能管理规范 global 命名空间；获准租户 SHALL 只读已发布 global 知识
- **AND** 自报平台角色、通用 system:manage 或 app:release:approve MUST NOT 授予 global 管理

### Requirement: 同域版本串行化与知识RLS精确拒绝

平台 SHALL 在现有知识/技能表补规范归属 CHECK、包含组织的 NULL 安全版本唯一约束、知识每域单一 published 唯一约束及持久命名空间锁。发布/回滚 MUST 在同一事务核对同域已审核来源、分配版本、仅替换本域状态；回滚只追加带 sourceEntryId/sourceVersion 的新版本，不改旧正文。已有提议、独立审核、敏感检查、Release 版本绑定要求 MUST 保留。知识/技能已有 RLS SHALL 收紧为租户只读已发布 global 知识；global 技能 MUST 只按既有状态及版本绑定规则开放可用版本，不返回草稿或历史，未有可信消费上下文时 MUST 拒绝其租户读取。平台 SHALL 使用独立管理策略；USING/WITH CHECK MUST 拒绝越组织写入，缺组织上下文的租户请求 MUST 被拒绝。生产角色 MUST 非 owner、非 superuser、无 BYPASSRLS，专项策略/迁移缺失 MUST 阻断就绪。

#### Scenario: 合法发布与回滚原子追加
- **WHEN** 同命名空间经独立审核及敏感检查的新内容或历史回滚提交
- **THEN** 事务 SHALL 分配新版本，仅 supersede 自身旧 published，并记录回滚同域来源
- **AND** 历史正文与其他命名空间 SHALL 保持不变；检索 SHALL 仍遵守当前版本绑定

#### Scenario: NULL与首次并发由真库约束
- **WHEN** 真 PostgreSQL 上两个实例首次并发发布同域知识，或提交重复 global/技能 key-version
- **THEN** 平台 SHALL 串行化或明确冲突，已提交版本 SHALL 唯一且知识每域仅一条 published
- **AND** NULL MUST NOT 放宽唯一限制，不同租户合法同名版本 SHALL 互不冲突

#### Scenario: 全局未发布读取和失败事务拒绝
- **WHEN** 租户尝试 SELECT global 知识 draft/历史或技能草稿/历史、伪造平台 GUC、缺可信上下文或跨组织写入，或发布/回滚事务任一步失败
- **THEN** 平台/数据库策略 MUST 拒绝越界访问，失败事务 MUST 全部回滚并保留旧 published
- **AND** 不明归属/重复旧行 MUST 隔离修复，不自动设为 global，不撤 RLS/唯一约束回退；策略未就绪或绕过角色 MUST NOT 通过专项验收
