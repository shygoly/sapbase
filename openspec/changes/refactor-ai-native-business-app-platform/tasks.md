## 1. Protocol and compatibility gates
- [x] 1.1 Freeze `BusinessAppInstallation` fields, lifecycle, and app-aware execution context
- [ ] 1.2 Freeze Agent session/run/step/wait/event contract and budget rules
- [ ] 1.3 Freeze model gateway request/response/trace fields and secret-reference format
- [ ] 1.4 Define deprecation behavior for tenant-only APIs and existing `/chat` entry points
- [ ] 1.5 Add positive and negative fixtures for all new schemas before implementation
- [x] 1.6 Run `openspec validate refactor-ai-native-business-app-platform --strict`

## 2. Tenant and application foundation
- [x] 2.1 Add `app_installations` with organization, app key, release digest, profile, and lifecycle
- [ ] 2.2 Add immutable Blueprint release registry and installation-to-release binding
- [x] 2.3a Implement AsyncLocalStorage execution context for HTTP requests
- [x] 2.3b Add equivalent transaction context to cron jobs and Outbox consumers
- [x] 2.4 Add trusted installation resolution from user, organization, and request
- [x] 2.5a Add PostgreSQL RLS policies for tenant business/app tables and their child tables
- [x] 2.5b Extend RLS to organization membership and organization onboarding/control-plane writes（organizations/members 策略 + 迁移 + DDL 测试）
- [x] 2.6 Retire pass-through `DataIsolationInterceptor`; require transaction context + RLS
- [x] 2.7 Map existing records to a default ERP installation with an idempotent backfill（service + admin endpoint + dryRun/幂等测试 + runbook）
- [x] 2.8a Add cross-tenant raw-SQL RLS negative tests with a non-owner role
- [x] 2.8b Add cross-app service-path negative tests（跨组织 app context / findForOrganization / listForOrganization）

## 3. App-scoped catalogs and frontend shell
- [x] 3.1 Compose platform tools, Blueprint tools, integrations, and shared data capabilities per app（`composeAppToolCatalog` + `GET /api/agent-tools/app-catalog`）
- [x] 3.2 Namespace app tools and reject duplicate names in a composed catalog（`${appKey}_` + 重名/非法契约整目录拒绝 + 测试）
- [x] 3.3 Add app-scoped roles, permissions, menus, branding, audit, and usage（app_role_bindings/app_brand_configs + catalog API + 执行上下文权限合并 + 测试）
- [x] 3.4a Add application switcher and persist the active installation in the API client
- [x] 3.4b Resolve navigation and route metadata from the active installation（`GET /api/apps/:id/navigation` + Blueprint UI 菜单/路由 + 权限过滤 + api-client + 测试）
- [x] 3.5 Move hardcoded ERP/shipping routes into the ERP application（`templates/auto-parts/ui.json` 声明 shipping/ERP 菜单与页面；shell 移除 shipping 保留段与首页特判；schema/菜单测试）
- [x] 3.6 Add a CRM application without hardcoded shell routes（`templates/crm` + UI 菜单/页面 + 打包/编译/导航测试；shell 零 CRM 硬编码）
- [x] 3.7 Publish one explicit ERP-owned customer capability and consume it from CRM（`app_capabilities` + `customer.lookup` invoke + ERP 模板 + 投影/权限/owner 测试）
- [x] 3.8 Add E2E: one user switches ERP/CRM and private records remain isolated（`tests/app-switch-isolation.e2e.js` + AppPackageGuard 跨 package 403）

## 4. Durable Agent Runtime
- [x] 4.1 Add Agent Definition/Instance/Session/Run/Step/Wait entities and migrations（5 张新表 + agent_conversations.agentInstanceId + migration/RLS）
- [x] 4.2 Implement queued/running/waiting/completed/failed/cancelled state transitions（服务端白名单 + wait/resume/cancel + 非法迁移拒绝）
- [x] 4.3 Implement resumable event stream and replay after disconnect（`agent_steps.seq` 单调 + `GET /events?after=`）
- [x] 4.4 Filter the tool catalog by app, Agent, user permission, entitlement, and runtime profile（4.4a/4.4b + app-catalog/entitlement/profile 过滤）
- [x] 4.4a Resolve app context for chat/tool calls and bind confirmation tokens to the app
- [x] 4.4b Compose and filter the actual tool catalog by app entitlement and Agent identity（filterAppToolCatalog + profile/permission/entitlement + 隐藏原因 + 测试）
- [x] 4.5 Enforce `allowedAgents` from trusted runtime identity（HTTP/chat 固定 runtime；MCP 只从受控 env 解析；`invokeAs/confirmAs` + 未知 profile 拒绝 + 负例）
- [x] 4.6 Enforce run budgets, idempotency, cancellation, and write confirmation（服务端预算 + turn 幂等键 + 取消复查 + 写工具只出计划 + 测试）
- [x] 4.7 Wrap untrusted tool results with source/nonce boundaries and redact audit arguments（untrusted source/nonce 包裹 + 递归审计脱敏 + 测试）
- [x] 4.8 Move long-running work to jobs/Outbox; do not hold one HTTP request for a full Agent run（`agent.long_task` / `app.upgrade` + 202 入队/查询 API + 可信 createdBy/权限重解析 + 测试）
- [x] 4.9 Migrate current chat to an app-scoped Agent session（conversation 持久化 agentInstanceId；sync/async chat 透传；旧会话可空兼容）
- [x] 4.10 Add negative tests for forged identity, cross-app tools, over-budget runs, and unconfirmed writes（4 类负例已覆盖）

## 5. AI-native authoring pipeline
- [ ] 5.1 Replace direct provider calls with a provider-neutral `ModelGateway`
- [ ] 5.2 Move model credentials to secret references and record requested/resolved model metadata
- [ ] 5.3 Add Context Compiler with dependency closure, permission filtering, and budget limits
- [ ] 5.4 Emit `space-delta` operations only; reject final-structure bypass paths
- [ ] 5.5 Add Delta validation, bounded repair, and deterministic conflict reporting
- [ ] 5.6 Add simulation/evaluation gates before Blueprint publication
- [ ] 5.7 Add per-task model profiles for intent, design, vision, and evaluation
- [x] 5.8 Add prompt-injection and cross-tenant context-leak negative tests（伪造边界 neutralization + knowledge 跨租户/用户/release 过滤 + 测试）

## 6. Delivery profiles and operations
- [x] 6.1 Add entitlements, plan-to-app mapping, quotas, and usage metering（plan catalog + app_entitlements/app_usage_records + sync-plan/配额/计量 API + 安装/工具调用准入 + 测试）
- [ ] 6.2 Package shared SaaS, dedicated SaaS, and standalone profiles from one Runtime artifact
- [ ] 6.3 Make full-system source generation an optional licensed export path
- [x] 6.4a Add installation upgrade, rollback, and suspension workflows
- [x] 6.4b Add uninstall workflow and retention policy（uninstalling/removed + retentionUntil + cleanup + audit + tests）
- [x] 6.5 Add backup/restore and data-compatibility checks for app upgrades（兼容检查器 + 升级前记录快照 + restore API + 测试）
- [x] 6.6 Add audit, SLO, cost, and failure dashboards for installment and Agent runs（`/api/operations/dashboard` + Portal 页面 + 单测）
- [x] 6.7 Benchmark `blueprint_records`; add tenant/app partitioning and retention when metrics justify it（基准脚本 + 租户/归档索引 + 365 天保留 cron/API + 分区阈值决策）

## 7. Documentation and truth-source updates
- [x] 7.1a Update `docs/META_LANGUAGE.md` with Business App and app-context terms
- [x] 7.1b Add Agent Runtime terms after that runtime contract is implemented（META_LANGUAGE 3.23 + Agent Definition/Instance/Run/Step/Wait/事件重放术语 + INV-AGENT-13）
- [x] 7.2 Update `openspec/project.md` product definition from ERP-only to business-app platform
- [x] 7.3 Update `docs/ERP_Space_Platform_设计方案_v3.md` with the approved multi-app architecture（新增 14.4 + 更新多租户/源码导出状态）
- [x] 7.4 Reconcile `add-full-system-generation-and-deploy` with the optional export decision（归档 change 加 reconciliation；新增 full-system-export-decision.md）
- [x] 7.5 Reconcile `migrate-to-saas-architecture` with RLS and app-aware tenancy（已归档；`docs/guides/saas-migration.md` / DOMAIN 对账）
- [x] 7.6 Document the OpenClaw/Agent Host adapter boundary and non-goals（`docs/agent-host.md` 增加 Non-goals；piagent 14.2 已存在）

## Implementation Evidence

- 2026-10-18: `business-app-installation.schema.json` plus shared execution-context types freeze
  app keys, release digests, deployment profiles, lifecycle, and trusted context.
- 2026-10-18: `POST /api/apps/install` derives the release digest from the existing fail-closed
  Blueprint load chain. Duplicate installs are idempotent; version changes require a future
  lifecycle upgrade path.
- 2026-10-18: `X-App-Id` resolves an active installation into a trusted app context. Suspended apps
  are rejected with `404`, and body-supplied organization/user/permission claims are ignored.
- 2026-10-18: The sidebar now carries separate organization and application selectors. Changing
  organization clears the stored app ID.
- 2026-10-18: Installations now have append-only release revisions. Upgrade requires a strictly
  greater semantic version; rollback reloads the historical package and verifies its digest before
  activation.
- 2026-10-18: Chat and Agent Tool calls accept the trusted app context. Confirmation tokens are
  bound to `(organizationId, appInstallationId, tool, argsDigest)` and audit metadata carries the
  app installation, app key, and trace id.
- 2026-10-18: Authenticated HTTP requests run in one transaction with transaction-local RLS
  settings. Outbox and the nightly suggestion job fan out per organization instead of using a
  global bypass. PostgreSQL RLS was verified against a non-owner role: cross-tenant reads were
  filtered and cross-tenant writes were rejected.
- Verification: backend build passed; shared-schemas build passed; backend unit suite passed
  `123 suites / 945 tests`; `business-apps.e2e-spec` passed install/upgrade/rollback/context/
  tool-audit/suspend/activate; `rls.e2e-spec` passed cross-tenant read filtering, write denial
  under a non-owner role, and owner/superuser startup rejection.
- Verification limitation: `next build` reached type checking but is blocked by the pre-existing
  missing file `libs/api-client/src/api/shipping/types`. A targeted TypeScript check of the new app
  switcher, store, API client, and business-app API passed.
- OpenSpec: `validate refactor-ai-native-business-app-platform --strict` passed.
