# Change: Refactor sapbase into an AI-native business app platform

> 物理拆分 / 三库 build / error 级规则已完成，本 change 不重做；任务收敛见 `refactor-ai-native-control-plane-boundaries` design §8。

## Why

sapbase already has the core of a platform: tenant-aware organizations, signed Blueprint packages,
compiled semantic runtimes, Atomic Contracts, plugin sandboxes, Agent Tool Contracts, an audited
tool invocation chain, and a first chat-first Interaction Surface. The current product boundary is
still ERP-shaped, however: there is no first-class "installed business app" inside a tenant, tools
and menus are largely global, AI runs are single-turn and non-durable, and full-system generation
is a deploy stub that confuses "build one more SaaS" with "generate a separate codebase per tenant".

To support ERP, CRM, HRO, MES, and future vertical SaaS or standalone systems without forking the
platform, sapbase needs to become a multi-tenant control plane plus one shared business-app runtime.
An app is installed into an organization; its signed Blueprint release defines business semantics,
its declared capabilities define allowed facts and actions, and its Agent profiles use only that
app-scoped tool catalog.

## What Changes

- **ADDED**: `BusinessApp` / `AppInstallation` as the tenant-scoped application boundary. A signed
  Blueprint release remains the authored and distributable definition; the installation binds one
  organization to a concrete release, runtime profile, entitlements, configuration, and Agent policy.
- **ADDED**: App-aware execution context containing organization, app installation, user, permissions,
  deployment mode, and request/run trace. App-scoped resources MUST resolve from this trusted context.
- **ADDED**: App-scoped module, tool, permission, menu, audit, session, and background-job catalogs.
  A global `contracts/tools.json` remains the platform built-in catalog, while each installed app
  contributes a composed, validated catalog under its own namespace.
- **ADDED**: Cross-app access only through explicit published data capabilities. Different apps MUST
  NOT directly query each other's Blueprint records even when they belong to the same organization.
- **ADDED**: Durable Agent Runtime with sessions, runs, steps, tool calls, cancellation, resume,
  user-wait states, budgets, event replay, and untrusted-result boundaries. Existing single-turn
  chat becomes one entry point into this runtime.
- **ADDED**: Agent definitions and app policy fields for model routing, allowed tools, write policy,
  sandbox requirements, step/time/token budgets, and escalation. `allowedAgents` is enforced once
  the runtime has a durable agent identity.
- **ADDED**: One AI-native authoring pipeline: provider-neutral model gateway -> Context Compiler ->
  structured Delta -> validation/repair -> compile/evaluate -> signed Blueprint release.
- **ADDED**: Three delivery profiles over the same contracts: shared SaaS, dedicated SaaS, and
  standalone/single-tenant bundle. Tenants and deployment variants SHALL NOT receive forked business
  runtimes.
- **MODIFIED**: The "generate the full system source and deploy it" path becomes an optional
  delivery/export capability. The primary product path is installing signed app releases on the
  shared Runtime, not generating and operating a unique repository for every customer.
- **MODIFIED**: Tenant isolation is hardened with PostgreSQL RLS and fail-closed context, replacing
  the current pass-through `DataIsolationInterceptor` as the last line of defense.

## Impact

- Affected specs:
  - `business-app-platform` (new)
  - `agent-runtime` (new)
  - `ai-module-management` (AI-native authoring additions)
- Affected code:
  - `libs/platform-core/src/organizations`, `libs/platform-core/src/auth*`, `apps/api/src/common/*`
  - `apps/api/src/blueprint`, `apps/api/src/semantic-runtime`, `apps/api/src/module-registry`
  - `apps/api/src/agent-tools`, `apps/api/src/chat`, `apps/api/src/ai-models`, `apps/api/src/ai-modules`
  - `libs/ui-layout/src/core/{navigation,auth}`, `apps/web-portal/src/app`
  - shared schemas, migrations, seeders, deployment manifests, and CI
- Breaking risks:
  - Existing tenant-only APIs must acquire app context or an explicit platform/admin scope.
  - Existing Blueprint records and audit rows need an installation mapping and migration plan.
  - Existing chat sessions are not durable and will be replaced or adapted.
  - Global model configuration and plaintext provider credentials need migration to secret references.

## Out of Scope

- A complete public marketplace, revenue sharing, and seller payouts.
- Universal master-data modeling for every vertical.
- Arbitrary third-party source execution in the production Runtime.
- A new Blueprint package format that duplicates the existing `.erpkg` contract.
- Implementing the change before this proposal and its protocol deltas are approved.
