# DOMAIN.md — 领域数据契约

> **机器可校验的领域契约**。改任何 `biz_` / `app_` / `agent_` / `sys_` 表、实体或
> `app-*` / `domain-*` 服务前，先读本文件对应 `##` 小节（按聚合切片读取，勿全文加载）。
> 改动涉及表关系 / 级联 / 公式 / 状态词汇时**必须**同步对应小节，并跑
> `node scripts/meta/check-domain-doc.mjs`。
> 表格与 YAML 块的格式契约见「附录：格式契约」。
> 文中相对路径除特别说明外均相对仓库根。
> 列名以 `contracts/schema-manifest.json` 的实际 camelCase 为准（sapbase 当前 TypeORM 默认命名）。
> 本文件采用期的关系强制点先登记 `none` 并注明原因；后续补 FK/服务断言时再替换为 `db-fk` / `service`。

---

## 覆盖矩阵

| 表 | 小节 |
|---|---|
| organizations | 平台与租户 |
| users | 平台与租户 |
| departments | 平台与租户 |
| roles | 平台与租户 |
| permissions | 平台与租户 |
| invitations | 平台与租户 |
| organization_members | 平台与租户 |
| organization_activities | 平台与租户 |
| settings | 平台与租户 |
| brand_configs | 平台与租户 |
| menu_items | 平台与租户 |
| notifications | 平台与租户 |
| audit_logs | 平台与租户 |
| app_installations | 应用安装 |
| app_installation_revisions | 应用安装 |
| agent_confirmation_tokens | 应用安装 |
| blueprint_records | Blueprint 运行时 |
| blueprint_journal_entries | Blueprint 运行时 |
| blueprint_approvals | Blueprint 运行时 |
| blueprint_doc_counters | Blueprint 运行时 |
| blueprint_suggestion_logs | Blueprint 运行时 |
| ai_modules | AI 模块 |
| ai_module_definitions | AI 模块 |
| ai_module_reviews | AI 模块 |
| ai_module_tests | AI 模块 |
| ai_models | AI 模块 |
| module_registry | 模块注册 |
| module_capabilities | 模块注册 |
| module_configurations | 模块注册 |
| module_relationships | 模块注册 |
| module_statistics | 模块注册 |
| atomic_contracts | 原子运行时 |
| atomic_implementations | 原子运行时 |
| atomic_module_manifests | 原子运行时 |
| workflow_definitions | 工作流 |
| workflow_instances | 工作流 |
| workflow_history | 工作流 |
| workflow_auto_suggestion_logs | 工作流 |
| outbox_events | 基础设施 |
| outbox_deliveries | 基础设施 |
| plugins | 基础设施 |
| app_drafts | 发布生命周期 |
| app_change_proposals | 发布生命周期 |
| app_releases | 发布生命周期 |
| app_release_items | 发布生命周期 |
| app_release_activations | 发布生命周期 |
| app_release_approvals | 发布生命周期 |
| app_release_events | 发布生命周期 |
| app_user_release_views | 发布生命周期 |
| agent_conversations | PiAgent 会话 |
| agent_turns | PiAgent 会话 |
| agent_tool_calls | PiAgent 会话 |
| agent_knowledge_entries | Agent 知识与评测 |
| agent_skill_versions | Agent 知识与评测 |
| agent_eval_cases | Agent 知识与评测 |
| agent_eval_runs | Agent 知识与评测 |
| agent_feedback | Agent 知识与评测 |
| agent_feedback_topics | Agent 知识与评测 |
| release_automation_policies | 发布自动化 |
| release_automation_runs | 发布自动化 |

---

## 平台与租户

覆盖表：organizations, users, departments, roles, permissions, invitations, organization_members, organization_activities, settings, brand_configs, menu_items, notifications, audit_logs

平台与租户聚合。`organizations` 是租户根；其余表通过 `organizationId` 归属租户。
`users` 是平台用户；同一用户可属于多个组织，成员关系在 `organization_members`。

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| departments.organizationId | organizations.id | 部门归属组织 | none | 存量 FK 由 TypeORM relation 生成，约束名未固定 |
| departments.managerId | users.id | 部门负责人 | none | 允许为空；离职后先清空负责人 |
| roles.organizationId | organizations.id | 角色归属组织 | none | 角色不能跨组织复用 |
| permissions.organizationId | organizations.id | 权限归属组织 | none | 平台权限使用固定种子 |
| invitations.organizationId | organizations.id | 邀请归属组织 | none | 邀请过期后不可接受 |
| invitations.invitedById | users.id | 邀请人 | none | 审计字段 |
| organization_members.organizationId | organizations.id | 成员归属组织 | none | 用户与组织多对多 |
| organization_members.userId | users.id | 成员用户 | none | 同一组织内用户唯一 |
| organization_activities.organizationId | organizations.id | 活动归属组织 | none | 只追加 |
| organization_activities.userId | users.id | 操作人 | none | 允许为空（系统动作） |
| settings.organizationId | organizations.id | 设置归属组织 | none | 全局缺省值在代码中兜底 |
| settings.userId | users.id | 个人设置 | none | 可为空表示组织级设置 |
| brand_configs.organizationId | organizations.id | 品牌配置归属组织 | none | 每组织一条 active 配置 |
| menu_items.organizationId | organizations.id | 菜单归属组织 | none | 菜单可见性仍由权限判定 |
| menu_items.parentId | menu_items.id | 父子菜单 | none | 自引用；成环由服务层校验 |
| notifications.organizationId | organizations.id | 通知归属组织 | none | 用户级通知带 userId |
| notifications.userId | users.id | 通知接收人 | none | 允许为空表示组织广播 |
| audit_logs.organizationId | organizations.id | 审计归属组织 | none | 审计只追加，业务代码不得删除 |

### 状态词

组织订阅状态、用户状态、邀请状态必须使用代码中的枚举值；禁止在 UI/API/DB 各造一套同义词。

### 不变量

```yaml invariant
id: INV-TENANT-01
tables: [organizations, users, departments, roles, permissions, invitations, organization_members, settings, brand_configs, menu_items, notifications, audit_logs]
desc: 所有租户业务表必须带 organizationId；RLS 是最后拒绝边界，应用层仍必须显式过滤。
trigger: 任意租户数据读写
enforcement:
  - none
db: none
spec: backend/test/rls.e2e-spec.ts
```

---

## 应用安装

覆盖表：app_installations, app_installation_revisions, agent_confirmation_tokens

应用安装聚合。`app_installations` 记录某组织当前安装了哪个 Blueprint 版本；
`app_installation_revisions` 记录安装/升级/回滚历史；`agent_confirmation_tokens` 记录写工具的一次性确认令牌。

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| app_installations.organizationId | organizations.id | 安装归属组织 | none | 组织删除时级联 |
| app_installations.createdById | users.id | 安装人 | none | 审计字段 |
| app_installation_revisions.appInstallationId | app_installations.id | 修订归属安装 | none | 安装删除时级联 |
| app_installation_revisions.organizationId | organizations.id | 修订归属组织 | none | 与安装组织一致 |
| agent_confirmation_tokens.organizationId | organizations.id | 令牌归属组织 | none | 必须与调用上下文一致 |
| agent_confirmation_tokens.appInstallationId | app_installations.id | 令牌绑定应用 | none | 不能跨 app 复用 |

### 不变量

```yaml invariant
id: INV-APP-01
tables: [app_installations]
desc: 同一组织内 appKey 唯一；同一组织内 slug 唯一。
trigger: BusinessAppsService.install()
enforcement:
  - db-unique:uq_app_installations_organization_app_key
  - service:backend/src/business-apps/business-apps.service.ts#install
db: uq_app_installations_organization_app_key
spec: backend/src/business-apps/business-apps.service.spec.ts
```

```yaml invariant
id: INV-APP-02
tables: [app_installation_revisions, app_installations]
desc: 升级/回滚只追加修订记录，不覆盖历史；当前修订指针必须指向本安装的修订。
trigger: BusinessAppsService.upgrade() / rollback()
enforcement:
  - service:backend/src/business-apps/business-apps.service.ts#upgrade
  - service:backend/src/business-apps/business-apps.service.ts#rollback
db: none
spec: backend/src/business-apps/business-apps.service.spec.ts
```

```yaml invariant
id: INV-APP-03
tables: [agent_confirmation_tokens]
desc: 写工具确认令牌一次性、5 分钟过期，并绑定用户/租户/应用/工具/参数摘要。
trigger: AgentToolRegistry.confirm() / invoke()
enforcement:
  - service:backend/src/agent-tools/confirmation-token.service.ts#consume
db: none
spec: backend/src/agent-tools/confirmation-token.service.spec.ts
```

---

## Blueprint 运行时

覆盖表：blueprint_records, blueprint_journal_entries, blueprint_approvals, blueprint_doc_counters, blueprint_suggestion_logs

Blueprint 语义运行时。`blueprint_records` 存业务对象实例，`blueprint_journal_entries` 存记账分录，
`blueprint_approvals` 存审批步骤，`blueprint_doc_counters` 存单据序号，`blueprint_suggestion_logs` 存夜间建议。

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| blueprint_records.organizationId | organizations.id | 记录归属组织 | none | RLS 最后边界 |
| blueprint_journal_entries.organizationId | organizations.id | 分录归属组织 | none | 与记录同组织 |
| blueprint_approvals.organizationId | organizations.id | 审批归属组织 | none | 审批人权限由角色判定 |
| blueprint_doc_counters.organizationId | organizations.id | 序号归属组织 | none | 每组织独立计数 |
| blueprint_suggestion_logs.organizationId | organizations.id | 建议归属组织 | none | 只写建议，不改状态 |

### 不变量

```yaml invariant
id: INV-BLUEPRINT-01
tables: [blueprint_records]
desc: 记录状态迁移必须由 Blueprint 状态机允许；建议日志不得直接改记录状态。
trigger: SemanticRuntimeService.transition()
enforcement:
  - service:backend/src/semantic-runtime/semantic-runtime.service.ts#transition
db: none
spec: backend/src/semantic-runtime/semantic-runtime.service.spec.ts
```

---

## AI 模块

覆盖表：ai_modules, ai_module_definitions, ai_module_reviews, ai_module_tests, ai_models

AI 模块聚合。`ai_modules` 是组织内 AI 生成模块的登记；六步定义在 `ai_module_definitions`；
评审与测试分别在 `ai_module_reviews` / `ai_module_tests`；`ai_models` 是全局模型注册表（**全局表**，无 `organizationId`）。

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| ai_modules.organizationId | organizations.id | 模块归属组织 | none | 模板模块可由平台发布 |
| ai_modules.createdById | users.id | 创建人 | none | 审计字段 |
| ai_modules.reviewedById | users.id | 评审人 | none | 作者 ≠ 评审人 |
| ai_module_definitions.aiModuleId | ai_modules.id | 六步定义归属模块 | none | 一模块一份当前定义 |
| ai_module_reviews.moduleId | ai_modules.id | 评审归属模块 | none | 只追加 |
| ai_module_reviews.reviewerId | users.id | 评审人 | none | 允许为空表示系统评审 |
| ai_module_tests.moduleId | ai_modules.id | 测试归属模块 | none | 测试结果不可手改 |

### 状态词

`ai_modules.status` 与 `ai_module_reviews.decision` 必须使用共享 Schema 中的枚举值。

### 不变量

```yaml invariant
id: INV-AI-01
tables: [ai_modules, ai_module_reviews]
desc: 模块发布前必须有一次 approved 评审；作者不得批准自己的模块。
trigger: AIModulesService.publish()
enforcement:
  - none
db: none
spec: TODO
```

---

## 模块注册

覆盖表：module_registry, module_capabilities, module_configurations, module_relationships, module_statistics

模块注册聚合。`module_registry` 是组织内业务模块；能力、配置、关系、统计都是它的子表。

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| module_registry.organizationId | organizations.id | 模块归属组织 | none | 模块不能跨组织复用 |
| module_registry.createdById | users.id | 创建人 | none | 审计字段 |
| module_registry.aiModuleId | ai_modules.id | 来源 AI 模块 | none | 允许为空（手工模块） |
| module_capabilities.moduleId | module_registry.id | 能力归属模块 | none | 模块删除时级联 |
| module_configurations.moduleId | module_registry.id | 配置归属模块 | none | 模块删除时级联 |
| module_relationships.sourceModuleId | module_registry.id | 关系源模块 | none | 自引用/跨模块 |
| module_relationships.targetModuleId | module_registry.id | 关系目标模块 | none | 不能指向不存在模块 |
| module_statistics.moduleId | module_registry.id | 统计归属模块 | none | 可重建的派生物 |

### 不变量

```yaml invariant
id: INV-MODULE-01
tables: [module_registry, module_relationships]
desc: 模块关系不得自环，且源/目标模块必须属于同一组织。
trigger: ModuleRegistryService.createRelationship()
enforcement:
  - none
db: none
spec: TODO
```

---

## 原子运行时

覆盖表：atomic_contracts, atomic_implementations, atomic_module_manifests

原子运行时聚合。`atomic_contracts` 是原子契约；`atomic_implementations` 是准入实现；
`atomic_module_manifests` 是 Wasm 模块清单快照。

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| atomic_contracts.organizationId | organizations.id | 契约归属组织 | none | 允许为空表示平台契约 |
| atomic_implementations.atomicContractId | atomic_contracts.id | 实现归属契约 | none | 实现哈希由平台重算 |
| atomic_module_manifests.atomicType | atomic_contracts.atomicType | 清单对应契约 | none | 版本范围由服务层匹配 |

### 不变量

```yaml invariant
id: INV-ATOM-01
tables: [atomic_contracts, atomic_implementations]
desc: 原子实现必须通过闸 0/1/2 准入；模块哈希由平台重算，不采信提交方自述值。
trigger: AtomicRegistryService.admit()
enforcement:
  - none
db: none
spec: backend/src/atomic-runtime/atomic-executor.service.spec.ts
```

---

## 工作流

覆盖表：workflow_definitions, workflow_instances, workflow_history, workflow_auto_suggestion_logs

工作流聚合。定义、实例、历史与自动建议日志。

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| workflow_definitions.organizationId | organizations.id | 定义归属组织 | none | 定义可版本化 |
| workflow_instances.organizationId | organizations.id | 实例归属组织 | none | 实例不能跨组织 |
| workflow_instances.workflowDefinitionId | workflow_definitions.id | 实例归属定义 | none | 定义删除前必须处理实例 |
| workflow_history.workflowInstanceId | workflow_instances.id | 历史归属实例 | none | 只追加 |
| workflow_auto_suggestion_logs.workflowInstanceId | workflow_instances.id | 建议归属实例 | none | 只写建议，不改状态 |
| workflow_auto_suggestion_logs.organizationId | organizations.id | 建议归属组织 | none | 与实例同组织 |

### 不变量

```yaml invariant
id: INV-WORKFLOW-01
tables: [workflow_instances, workflow_history]
desc: 实例状态迁移必须由定义中的 transitions 允许；每次迁移追加一条 history。
trigger: WorkflowService.transition()
enforcement:
  - none
db: none
spec: TODO
```

---

## 基础设施

覆盖表：outbox_events, outbox_deliveries, plugins

基础设施聚合。Outbox 是可靠事件投递真源；插件是组织级扩展登记。

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| outbox_events.organizationId | organizations.id | 事件归属组织 | none | 允许为空表示平台事件 |
| outbox_deliveries.eventId | outbox_events.id | 投递归属事件 | none | 一个事件可多次投递 |
| plugins.organizationId | organizations.id | 插件归属组织 | none | 平台插件可由平台安装 |

### 不变量

```yaml invariant
id: INV-OUTBOX-01
tables: [outbox_events]
desc: Outbox 事件必须有幂等键；重复投递不得产生重复副作用；失败必须可见并可重放。
trigger: OutboxService.publish() / OutboxDispatcher
enforcement:
  - none
db: none
spec: backend/src/outbox/outbox.service.spec.ts
```

---

## 发布生命周期

覆盖表：app_drafts, app_change_proposals, app_releases, app_release_items, app_release_activations, app_release_approvals, app_release_events, app_user_release_views

发布生命周期聚合。`app_drafts` 是可编辑工作副本；`app_change_proposals` 是变更提议；
`app_releases` 是不可变发布物；`app_release_items` 是发布项；`app_release_activations` 是追加式激活记录；
`app_release_approvals` 是审批记录；`app_release_events` 是事件流；`app_user_release_views` 是用户未读游标。
`app_releases.organizationId` 为 NULL 表示平台级发布；`app_release_items` 通过 `releaseId` 继承租户。

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| app_drafts.organizationId | organizations.id | 草稿归属组织 | none | 工作副本按组织隔离 |
| app_change_proposals.draftId | app_drafts.id | 提议归属草稿 | none | 提议只能改目标 app 的草稿 |
| app_change_proposals.publishedReleaseId | app_releases.id | 提议产出的发布 | none | 允许为空表示尚未发布 |
| app_release_items.releaseId | app_releases.id | 发布项归属发布 | none | 发布删除即级联 |
| app_release_activations.appInstallationId | app_installations.id | 激活归属安装 | none | 同一安装只有一个非 cohort active |
| app_release_activations.releaseId | app_releases.id | 激活目标发布 | none | 回退也追加新记录 |
| app_release_activations.fromReleaseId | app_releases.id | 回退来源发布 | none | 首次激活为空 |
| app_release_approvals.proposalId | app_change_proposals.id | 审批归属提议 | none | 作者 ≠ 批准人 |
| app_release_approvals.releaseId | app_releases.id | 审批归属发布 | none | 允许为空表示提议阶段审批 |
| app_release_events.releaseId | app_releases.id | 事件归属发布 | none | 只追加 |
| app_user_release_views.appInstallationId | app_installations.id | 未读游标归属安装 | none | 每用户每应用一条 |
| app_user_release_views.lastSeenReleaseId | app_releases.id | 最后看到的发布 | none | 用于 NEW/UPDATED 徽标 |

### 状态词

- `AppDraft`: `draft → frozen`（`archived` 为终态）
- `ChangeProposal`: `draft → submitted → validating → validated → approved → published`，另有 `rejected` / `withdrawn`
- `Release`: `building → published → superseded | revoked`，另有 `failed`
- `Activation`: `scheduled → active → superseded | rolled_back`，另有 `cancelled`

禁止在代码里另造 `done` / `finished` / `completed` 等同义词表示同一状态。

### 不变量

```yaml invariant
id: INV-REL-01
tables: [app_releases]
desc: 已发布 Release 的内容字段不可变；只允许状态改为 superseded/revoked。
trigger: ReleasesService.publish() / 直接 UPDATE
enforcement:
  - db-check:trg_app_release_guard
  - service:backend/src/releases/releases.service.ts#publish
db: trg_app_release_guard
spec: backend/src/releases/release-kernel.spec.ts
```

```yaml invariant
id: INV-REL-03
tables: [app_release_activations]
desc: 激活是追加记录；回退也是追加一条新激活，不修改旧 Release。
trigger: ReleasesService.activate() / rollback()
enforcement:
  - service:backend/src/releases/releases.service.ts#activate
  - service:backend/src/releases/releases.service.ts#rollback
db: UQ_app_activation_single_active
spec: backend/src/releases/release-kernel.spec.ts
```

```yaml invariant
id: INV-REL-04
tables: [app_release_activations]
desc: 同一 appInstallationId 同时只能有一条 status=active 且 cohort 为空的记录；灰度 cohort 必须显式。
trigger: ReleasesService.activate()
enforcement:
  - db-unique:UQ_app_activation_single_active
  - service:backend/src/releases/releases.service.ts#activate
db: UQ_app_activation_single_active
spec: backend/src/releases/release-kernel.spec.ts
```

```yaml invariant
id: INV-REL-06
tables: [app_releases]
desc: 每个 Release 必须有面向业务人员的 zh-CN changelog；技术 diff 不算。
trigger: ReleasesService.publish()
enforcement:
  - service:backend/src/releases/releases.service.ts#publish
db: none
spec: backend/src/releases/release-kernel.spec.ts
```

---

## PiAgent 会话

覆盖表：agent_conversations, agent_turns, agent_tool_calls

PiAgent 会话聚合。`agent_conversations` 是会话；`agent_turns` 是轮次；
`agent_tool_calls` 是工具调用审计。所有表带 `organizationId`；会话正文按敏感策略脱敏。

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| agent_conversations.organizationId | organizations.id | 会话归属组织 | none | 只允许本组织访问 |
| agent_turns.conversationId | agent_conversations.id | 轮次归属会话 | none | 只追加 |
| agent_turns.releaseId | app_releases.id | 轮次绑定发布 | none | 允许为空表示无应用上下文 |
| agent_tool_calls.turnId | agent_turns.id | 工具调用归属轮次 | none | 成功/失败都写 |

### 不变量

```yaml invariant
id: INV-AGENT-08
tables: [agent_turns]
desc: 每个回答绑定 releaseId + skillVersion + knowledgeVersion，可追溯。
trigger: AgentSessionsService.chat()
enforcement:
  - service:backend/src/agent-sessions/agent-sessions.service.ts#chat
db: none
spec: backend/src/agent-sessions/agent-sessions.service.spec.ts
```

```yaml invariant
id: INV-AGENT-10
tables: [agent_turns]
desc: 预算闭合：工具调用数、token、墙钟时间都有上限；超限拒绝而非继续。
trigger: AgentSessionsService.chat()
enforcement:
  - none
db: none
spec: TODO
```

---

## Agent 知识与评测

覆盖表：agent_knowledge_entries, agent_skill_versions, agent_eval_cases, agent_eval_runs, agent_feedback, agent_feedback_topics

知识与评测聚合。知识条目只追加版本；技能集版本随 Release 绑定；评测用例版本化；评测运行绑定 `releaseId + skillVersion`。

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| agent_knowledge_entries.releaseId | app_releases.id | 知识绑定发布 | none | 允许为空表示通用知识 |
| agent_skill_versions.releaseId | app_releases.id | 技能集绑定发布 | none | 不允许用 latest 浮动引用 |
| agent_eval_runs.releaseId | app_releases.id | 评测绑定发布 | none | G5 证据 |
| agent_feedback.releaseId | app_releases.id | 反馈针对的版本 | none | 必填；无版本无法复现 |
| agent_feedback.organizationId | organizations.id | 反馈归属组织 | none | 不可跨租户读取 |
| agent_feedback_topics.organizationId | organizations.id | 议题归属组织 | none | 不可跨租户读取 |
| agent_feedback_topics.linkedProposalId | app_change_proposals.id | 议题关联提议 | none | 允许为空 |

### 不变量

```yaml invariant
id: INV-AGENT-09
tables: [agent_knowledge_entries]
desc: 不写自由长期记忆；要沉淀的知识必须走提议→审核→发布。
trigger: AgentKnowledgeService.publish()
enforcement:
  - service:backend/src/agent-knowledge/agent-knowledge.service.ts#publish
db: none
spec: backend/src/agent-knowledge/agent-knowledge.service.spec.ts
```

```yaml invariant
id: INV-EVO-10
tables: [agent_eval_runs]
desc: Agent 评测回归超过阈值（默认 2%）不得发布；写越权 0、注入 100% 为硬门槛。
trigger: AgentEvalService.gate()
enforcement:
  - service:backend/src/agent-eval/agent-eval.service.ts#gate
db: none
spec: backend/src/agent-eval/agent-eval.service.spec.ts
```

---

## 发布自动化

覆盖表：release_automation_policies, release_automation_runs

A2 低风险发布自动化。`release_automation_policies` 是应用级策略；`release_automation_runs` 是策略服务执行记录。
发布者必须是平台策略服务，`actorAgent` 必须为空；PiAgent 不得发布。

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| release_automation_policies.organizationId | organizations.id | 策略归属组织 | none | 每个应用一条 active 策略 |
| release_automation_runs.policyId | release_automation_policies.id | 运行归属策略 | none | 只追加 |
| release_automation_runs.releaseId | app_releases.id | 运行对应发布 | none | 发布/回退/复核 |

### 不变量

```yaml invariant
id: INV-EVO-05
tables: [release_automation_policies, release_automation_runs]
desc: A2 只允许白名单变更类，由平台策略服务执行（不是 Agent），且必须有应用级开关、灰度、护栏、自动回退。
trigger: ReleaseAutomationService.assertEligible() / publish()
enforcement:
  - service:backend/src/release-automation/release-automation.service.ts#assertEligible
  - service:backend/src/release-automation/release-automation.service.ts#publish
db: none
spec: backend/src/release-automation/release-automation.service.spec.ts
```

```yaml invariant
id: INV-EVO-06
tables: [release_automation_policies]
desc: 自动回退必须有显式阈值；未配置则只能人工回退。
trigger: ReleaseAutomationService.rollback()
enforcement:
  - service:backend/src/release-automation/release-automation.service.ts#rollback
db: none
spec: backend/src/release-automation/release-automation.service.spec.ts
```

---

## 附录：格式契约

`check-domain-doc.mjs` 按以下契约解析本文件，破坏契约会导致校验失败：

1. **覆盖矩阵**：`## 覆盖矩阵` 下第一张表，表头恰为 `| 表 | 小节 |`。
   必须且仅收录 schema manifest 中全部匹配 `tablePrefixes` 的表，一表一行。
2. **聚合小节**：每个 `##` 标题下用 `覆盖表：a, b, c` 声明归属；必须与覆盖矩阵一致。
3. **关系表**：表头恰为 `| 源列 | 目标 | 语义 | 强制点 | 备注 |`。
   - 源列：`表名.列名`（物理列名）。
   - 目标：`表名.列名` | `dict:<dict_type>` | `-`。
   - 强制点：逗号分隔 token：`db-fk:<约束名>` | `db-check:<约束名>` | `db-unique:<约束名>` |
     `service:<路径>#<符号>` | `policy:<路径>#<符号>` | `ui:<路径>` | `test:<路径>` | `none`。
     `none` 必须在备注说明原因。
4. **invariant 块**：围栏代码块 info-string 恰为 `yaml invariant`。字段：
   `id`（唯一，`INV-<AREA>-<NN>` 或 `INV-<AREA>-GAP-<NN>`）、`tables`（数组）、`desc`、`trigger`、
   `enforcement`（token 数组，允许 `none`）、`db`（约束名或 none）、
   `spec`（spec 路径；`TODO` 表示待补，校验降级为 WARN）。
5. **校验规则**：表/列存在性对 schema manifest；`db-*` 约束名须在 `sqlDirs` 的 SQL 中出现；
   `service`/`policy`/`ui`/`test` 的路径须存在且符号可在文件内检索到。
