# DECISIONS.md — 架构决策记录

> **机器可校验的决策登记**。代码里的 `D-x` 标记（词边界，非 `TD-x`）必须在此注册，
> 校验由 `node scripts/meta/check-meta-docs.mjs` 强制。新增决策按 D-x 递增编号，
> 格式用 `yaml decision` 围栏块。
> **命名空间约定**：`D-x` = 架构决策（本册）；`TD-x` = 技术债（`docs/tech-debt.md`，
> 不入本册）；`INV-x` = 不变量（`DOMAIN.md`）。三者正交，禁止混用前缀。

---

## 已收编决策

### D-1：发布不可变

```yaml decision
id: D-1
title: 发布不可变，修复必须发新版本
status: accepted
date: 2026-10
context: |
  早期“发布”只是上传 Blueprint 包，覆盖同名版本；出问题无法复现，
  也无法判断某个租户到底跑的是哪份定义。
decision: |
  app_releases 的 published 行只读；内容字段由数据库触发器拒绝 UPDATE。
  任何修复产生新的 semver + 新 digest；回退 = 重新激活旧 release。
references:
  - INV-REL-01
  - INV-REL-07
  - docs/reference/04-versioning-release.md
code_markers:
  - apps/api/src/business-apps/business-apps.service.ts
```

### D-2：保留 TypeORM，不在 Nx 迁移中换 ORM

```yaml decision
id: D-2
title: 保留 TypeORM，不在 Nx 迁移中更换 ORM
status: accepted
date: 2026-10
context: |
  Nx 迁移与 ORM 更换同时进行会把结构问题与数据访问问题混在一起；
  现有 Blueprint/RLS/审计代码与 TypeORM 实体耦合较深。
decision: |
  Nx 迁移不更换 ORM；新增代码继续用 TypeORM。
  若未来引入 Prisma，按限界上下文逐个迁移，不允许同一上下文混用。
references:
  - docs/reference/02-architecture.md
code_markers:
  - apps/api/src/migrations/data-source.ts
```

### D-3：PiAgent 只能经工具面操作

```yaml decision
id: D-3
title: PiAgent 只能经工具面操作，不得直连数据库
status: accepted
date: 2026-10
context: |
  直连数据库会绕过权限、确认令牌与审计；模型生成 SQL 还会引入注入与性能风险。
decision: |
  PiAgent 的所有业务读写必须经 contracts/tools.json 声明的工具；
  写操作必须一次性确认令牌；权限 all-of 由平台判定。
references:
  - INV-AGENT-01
  - INV-AGENT-02
  - docs/protocols/chat-erp.md
code_markers:
  - apps/api/src/agent-tools/agent-tool.registry.ts
  - contracts/tools.json
```

### D-4：作者 ≠ 批准人

```yaml decision
id: D-4
title: 提议作者不得批准/发布自己的提议
status: accepted
date: 2026-10
context: |
  Builder Agent 可以起草提议；若它也能批准，治理闭环失效，审计无法区分“建议”与“决定”。
decision: |
  审批与发布必须由有权限的人完成；服务端校验 approver ≠ author。
  高风险变更（权限/工具/知识/迁移）需要第二审批人。
references:
  - INV-AGENT-04
  - INV-EVO-02
code_markers:
  - apps/api/src/business-apps/business-apps.service.ts
```

### D-5：数据范围是平台原语，不是部门树扩展

```yaml decision
id: D-5
title: 数据范围用通用 scope 原语，不把 departments 改造成树
status: accepted
date: 2026-11
context: |
  大区/省/市与校区/年级/班级是不同维度的树；把 departments 加 parentId 只能表达一种树，
  后续垂直行业仍要改平台代码。
decision: |
  新增 scope_dimensions/scope_nodes/scope_memberships/scope_bindings/data_policies/scope_versions；
  departments 保留为 HR/展示，需要时用适配器接入。行业词只作为配置值。
references:
  - INV-DS-01
  - docs/OPENSPEC_CHANGE_DEPENDENCIES.md
code_markers:
  - libs/platform-core/src/data-scope/data-scope.service.ts
  - apps/api/src/migrations/1793100000000-CreateDataScope.ts
```

### D-6：数据范围只收窄，声明即执行

```yaml decision
id: D-6
title: 数据范围只收窄，未声明保持旧行为，解析失败 fail-closed
status: accepted
date: 2026-11
context: |
  数据范围若能从请求参数或租户策略扩大，会变成绕过功能权限的新通道。
decision: |
  最终可见集合 = 租户 ∩ 功能权限 ∩ 数据范围；蓝图模板 cap 与租户策略取交集；
  声明 dataScope 的资源解析失败按 none；未声明资源保持租户隔离旧行为。
references:
  - INV-DS-02
  - INV-DS-03
  - INV-DS-05
code_markers:
  - libs/platform-core/src/data-scope/scope-evaluator.ts
  - libs/platform-core/src/data-scope/data-scope.service.ts
```

### D-7：异步任务以 PostgreSQL 为真源，Redis 只做唤醒

```yaml decision
id: D-7
title: 异步任务以 PostgreSQL 为真源，Redis 只做唤醒
status: accepted
date: 2026-11
context: |
  引入 BullMQ/pg-boss 会带来事务一致性与 RLS 桥接成本；教育项目量级不需要
  独立队列的吞吐，但需要“业务写入与入队同事务、回滚不留任务”。
decision: |
  jobs 表为真源；worker 用 FOR UPDATE SKIP LOCKED 领取；Redis pub/sub 仅唤醒，
  interval poll 兜底。JobQueue 保留接口，后续可替换实现而不改业务 API。
references:
  - INV-JOB-01
code_markers:
  - libs/platform-core/src/jobs/job-queue.ts
  - libs/platform-core/src/jobs/job-worker.ts
```

### D-8：任务至少一次执行 + 幂等，不承诺 exactly-once

```yaml decision
id: D-8
title: 任务至少一次执行 + 幂等键，不承诺 exactly-once
status: accepted
date: 2026-11
context: |
  worker 崩溃、lease 过期、网络分区都会导致重投；追求 exactly-once 会把
  复杂度转嫁给业务 handler，且无法在外部副作用上真正保证。
decision: |
  唯一键 (organizationId, type, idempotencyKey) 保证重复入队不重复创建；
  执行语义为至少一次，handler 必须幂等；超时/失败按类型策略重试，超上限进 dead(DLQ)。
references:
  - INV-JOB-02
  - INV-JOB-03
code_markers:
  - libs/platform-core/src/jobs/job-state.ts
  - libs/platform-core/src/jobs/job-queue.ts
```

### D-9：Agent 长任务只携带 agentRunId，不复制 run 状态

```yaml decision
id: D-9
title: Agent 长任务通过 agentRunId 关联，不复制 Agent Runtime 状态
status: accepted
date: 2026-11
context: |
  Agent Runtime 已有 session/run/step/wait/cancel/budget；job 再存一套 run 状态
  会形成两套真源，取消与预算必然漂移。
decision: |
  job payload 可携带 agentRunId；job 事件桥接 agent run 事件；job 不写回
  agent run 的业务状态。两者通过 ID 关联，取消/预算以 Agent Runtime 为准。
references:
  - INV-JOB-04
code_markers:
  - libs/platform-core/src/jobs/job-types.ts
```

### D-10：多角色按组织绑定，`users.roleId` 仅作回退

```yaml decision
id: D-10
title: 多角色按组织绑定，users.roleId 仅作兼容回退
status: accepted
date: 2026-11
context: |
  同一用户在不同组织/岗位需要不同角色；把多角色塞回 users.roleId 单列
  会丢失组织边界、有效期与来源，也无法表达“同一组织多角色”。
decision: |
  新增 organization_member_roles（组织 + 用户 + 角色 + 来源 + 有效期）；
  有效权限 = 本组织 active 角色并集 ∪ 直授权限；users.roleId 保留为兼容回退，不删除。
references:
  - INV-ID-01
code_markers:
  - libs/platform-core/src/identity/organization-member-roles.service.ts
  - libs/platform-core/src/roles/effective-permissions.service.ts
```

### D-11：通知中心站内表是真相，偏好只影响额外投递

```yaml decision
id: D-11
title: 通知中心站内表是真相，偏好只影响额外投递
status: accepted
date: 2026-11
context: |
  通知既是审计/待办入口，也是用户可配置的提醒。把“关闭通知”实现成不写表，
  会丢审批待办与合规证据；把 mandatory 也交给偏好，会让强制公告失效。
decision: |
  notifications 表是唯一真相；notification_preferences 只决定 WS 推送/邮件/推送渠道。
  站内持久化不受偏好影响；mandatory 通知绕过 mutedUntil。读/未读与过期时间持久化。
references:
  - INV-NT-02
code_markers:
  - apps/api/src/websocket/services/notification.service.ts
  - apps/api/src/notifications/notification-preferences.service.ts
```

### D-12：公告扇出幂等，大组织走 async-job，保留期只软删除

```yaml decision
id: D-12
title: 公告扇出幂等，大组织走 async-job，保留期只软删除
status: accepted
date: 2026-11
context: |
  公告发布可能覆盖整个组织。HTTP 请求内逐用户写库会超时且不可恢复；
  物理删除过期数据会破坏审计、统计与合规引用。
decision: |
  audience 在服务端解析（role/user/scope_node/scope_subtree），投递按
  (announcementId,userId) 幂等。超过阈值时入队 notification.announcement_fanout，
  由 async-job 提供进度/取消/重试。通知默认保留 30 天、公告按 retentionDays；
  清理只写 deletedAt 并记录 notification_cleanup_runs，不物理删除。
references:
  - INV-NT-01
  - INV-NT-03
  - INV-NT-04
code_markers:
  - apps/api/src/notifications/announcements.service.ts
  - apps/api/src/notifications/notification-retention.service.ts
  - apps/api/src/notifications/announcement-fanout.job.ts
```

### D-13：搜索用 PostgreSQL 全文 + trigram，索引是可重建派生物

```yaml decision
id: D-13
title: 搜索用 PostgreSQL 全文 + trigram，索引是可重建派生物
status: accepted
date: 2026-11
context: |
  教育项目需要跨公告/素材/课程/知识点的统一搜索。引入 ES/OpenSearch 会增加部署与一致性成本；
  用业务表直接 LIKE 又无法排序、高亮和中文模糊匹配。
decision: |
  v1 使用 PostgreSQL tsvector + pg_trgm，GIN 索引；search_documents 按组织隔离，
  只存可展示字段。索引通过 search.index / search.reindex 任务重建，按 contentHash 幂等；
  索引失败不回滚业务。pgvector 语义检索为可选 feature flag，不是 v1 必需。
references:
  - INV-SE-01
  - INV-SE-02
code_markers:
  - apps/api/src/search/search.service.ts
  - apps/api/src/search/search-index-job.service.ts
```

### D-14：Agent Host 只做通道/沙箱，策略裁决归平台

```yaml decision
id: D-14
title: Agent Host 只做通道/沙箱，策略裁决归平台
status: accepted
date: 2026-11
context: |
  外置 Agent 宿主（如 OpenClaw）可以更灵活地跑会话与工具，但如果宿主自己决定工具白名单、
  确认令牌或审计，就会形成第二条策略路径，绕过平台权限与数据范围。
decision: |
  宿主只提供通道、会话、沙箱、记忆与执行隔离；工具面只经 MCP 投影，
  allowlist 必须是网关授权集的子集；写操作仍消费平台确认令牌；宿主不可用时降级 Web SSE。
  untrusted 内容写入 turn taint，知识写入前校验来源；skill 只允许白名单+draft。
references:
  - INV-JOB-04
code_markers:
  - apps/api/src/agent-host/agent-host.service.ts
  - libs/agent-tools/src/mcp/agent-tool-mcp.bridge.ts
```

### D-15：复核扩展现有审批链，work item 只做投影

```yaml decision
id: D-15
title: 复核扩展现有审批链，work item 只做投影
status: accepted
date: 2026-11
context: |
  现有 blueprint_approvals 只有角色步骤和 approve，缺少驳回/重提/机器检测/SLA/委托；
  另建 workflow 引擎会形成第二套策略与状态真源。
decision: |
  在 blueprint_approvals 上扩展 round/kind/selector/assignee/checkResult/dueAt/SLA；
  人工动作、机器检测、委托都写同一审批链与 review_events；work_items 只是待办投影，
  inbox 双读兼容旧 approvals；机器检测异常/超时 fail-closed，warn 必须人工确认。
references:
  - INV-RV-01
  - INV-RV-02
code_markers:
  - apps/api/src/review/review-decision.service.ts
  - apps/api/src/review/work-items.service.ts
```

### D-16：审计链用 PostgreSQL advisory lock + HMAC checkpoint，不做外部 WORM

```yaml decision
id: D-16
title: 审计链用 PostgreSQL advisory lock + HMAC checkpoint，不做外部 WORM
status: accepted
date: 2026-11
context: |
  审计需要可验证的防篡改证据，但引入外部 WORM/区块链会增加部署与一致性成本；
  只靠触发器又无法证明历史行未被整体重写。
decision: |
  audit_logs 只追加，每组织 advisory lock 串行分配 seq；hash 链 + HMAC checkpoint 锚点。
  保留期清理/恢复走 break-glass 事务并写 audit.break_glass；查询/导出也写审计。
  未知 action 标 custom 并告警，不静默当普通日志。
references:
  - INV-AU-01
  - INV-AU-04
code_markers:
  - libs/platform-core/src/audit-logs/audit-chain.service.ts
  - libs/platform-core/src/audit-logs/audit-verification.service.ts
```

### D-17：记录生命周期用显式操作 + 快照，不把归档塞进状态机

```yaml decision
id: D-17
title: 记录生命周期用显式操作 + 快照，不把归档塞进状态机
status: accepted
date: 2026-11
context: |
  树形业务（课程/章节/知识点）需要 clone/move/archive/版本恢复；把这些做成状态迁移会污染
  每个模板的状态机，也无法表达子树克隆与历史版本。
decision: |
  tree 作为可选元数据进入编译/运行时校验；clone/move/reorder/archive/snapshot 走独立服务，
  record_operations 存 before/after 与幂等键，record_snapshots 只追加。归档只设 archivedAt，
  不删除记录；恢复旧快照创建新版本。
references:
  - INV-RL-01
  - INV-RL-05
code_markers:
  - apps/api/src/record-lifecycle/record-lifecycle.service.ts
```

---

## 附录：命名空间约定

| 前缀 | 含义 | 归属 | 校验 |
|---|---|---|---|
| `D-x` | 架构决策（不可逆的设计选择） | 本册 | `check:meta`（代码 D-x 标记必须在册） |
| `TD-x` | 技术债（待偿还的妥协） | `docs/tech-debt.md` | 无校验（债务，非契约） |
| `INV-x` | 不变量（运行时必须成立的约束） | `DOMAIN.md` / `01-meta-model.md` | `check:domain`（spec/enforcement 对拍） |

三者正交：同一个设计点可能同时有 D-x（决策）+ INV-x（不变量），但编号独立。
