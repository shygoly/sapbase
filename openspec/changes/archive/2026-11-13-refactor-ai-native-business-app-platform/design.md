# Design: AI-native multi-app SaaS platform

## Context

The repository has already crossed the most important conceptual threshold: business behavior is
becoming data (Blueprint), execution is becoming contracted capability (Atomic/Plugin/Tool), and UI
is becoming a deterministic projection (Schema/Interaction Plan). The remaining gap is composition.

Today:

```text
Organization
  ├─ global menus and pages
  ├─ module registry rows
  ├─ Blueprint packages on disk
  ├─ Blueprint records keyed by blueprintId
  └─ one global tool contract and one default LLM
```

That can host one ERP-shaped product. It cannot cleanly answer:

```text
Which applications has this customer installed?
Which version and license is each application running?
Which tools and menus belong to this application and this user?
Which business records may an Agent see while serving this application?
Can CRM read Customer data owned by ERP?
Can the same app run as shared SaaS, dedicated SaaS, or a customer-hosted monolith?
```

The target design adds those answers without replacing the existing execution kernel.

## Goals / Non-Goals

### Goals

- Make `BusinessApp` a first-class tenant-scoped runtime boundary.
- Keep one shared Runtime and one Blueprint protocol across ERP, CRM, HRO, MES, and future apps.
- Make AI native in both authoring and operation, while keeping facts, rules, permissions, and
  confirmation on the deterministic platform side.
- Support shared SaaS, dedicated SaaS, and standalone delivery from the same release.
- Allow multiple apps in one organization with explicit, auditable data sharing.
- Provide a migration path from the current ERP-only shell and single-turn chat.

### Non-Goals

- "AI writes arbitrary HTML/code into production" as the primary product mechanism.
- A separate database schema, frontend source tree, or backend source tree for every tenant.
- One permanently running Agent container per employee by default.
- Cross-app direct joins over `blueprint_records`.
- Solving every vertical's shared master-data model in this change.

## Core Decisions

### Decision 1: Blueprint remains the distributed app definition

A signed Blueprint release remains the authored, versioned, licensed unit. A `BusinessApp`
installation references exactly one primary Blueprint release in v1:

```text
Marketplace Product / Publisher Release
          │ references
          ▼
 signed Blueprint Package (.erpkg) ──compile/load──▶ Runtime Plan
          │ installed as
          ▼
 AppInstallation { organizationId, appKey, blueprintRelease, profile, config, entitlements }
```

This avoids inventing a second package format that would compete with `.erpkg`. A future suite can
compose multiple installed apps or multiple Blueprint dependencies without changing this boundary.

**Alternative rejected:** an `ApplicationPackage` containing several Blueprints. It adds a new
protocol and ownership model before a real multi-Blueprint use case exists.

### Decision 2: Organization and Business App are different boundaries

- `Organization` is the customer, billing, membership, and legal data boundary.
- `AppInstallation` is one software product instance inside that customer.
- `BlueprintId` is the business-definition/data namespace inside an installation.
- `Module` is a capability group inside an application.

A tenant can run `erp-prod`, `crm-prod`, and `hro-prod` simultaneously. The user sees an application
switcher; the platform never collapses "the one app" into the organization.

### Decision 3: Cross-app sharing is explicit

Each app owns its own Blueprint records. There is no implicit direct read across `blueprint_records`,
even inside one organization. Sharing is through a published capability:

```text
ERP owns Customer
  └─ publishes customer.read / customer.lookup capability

CRM declares dependency on customer.read
  └─ Agent or UI calls CRM's namespaced tool
       └─ platform checks CRM installation + user scope
            └─ capability checks ERP data scope and returns a projection
```

This preserves data ownership, enables a later marketplace, and prevents a new app from silently
joining against another app's private storage.

### Decision 4: App context is trusted and request/run scoped

All app-scoped execution uses one immutable context:

```ts
type ExecutionContext = {
  organizationId: string
  appInstallationId: string
  appKey: string
  userId: string
  permissions: readonly string[]
  runtimeProfile: 'shared-saas' | 'dedicated-saas' | 'standalone'
  traceId: string
}
```

The client may name the desired app, but the platform resolves and validates the installation,
membership, entitlement, and Blueprint release. A header or body field is never sufficient proof.
The context is propagated with AsyncLocalStorage for HTTP, jobs, Outbox consumers, and Agent runs.

### Decision 5: Tenant isolation is enforced by the database

Application predicates remain required for explainability and useful errors, but PostgreSQL RLS is
the final deny boundary:

```text
transaction
  SET LOCAL app.organization_id = ...
  SET LOCAL app.app_installation_id = ...
  query
  RLS policy: row.organization_id = current_setting(...)
              AND row.app_installation_id = current_setting(...)  -- app-owned tables
```

Global catalogs (Blueprint products, publisher entries, platform capabilities) live in separate
tables or an explicit global scope. Tenant rows cannot be read by simply bypassing a service method.
Raw SQL, jobs, admin tools, and test fixtures share the same policy; a privileged cross-tenant scope
must be explicit, audited, and unavailable to ordinary product APIs.

### Decision 6: Tool catalogs are composed per app installation

The global `contracts/tools.json` remains the built-in platform catalog. For an app installation:

```text
platform built-ins
  + Blueprint-declared tools
  + installed integration tools
  + published cross-app data capabilities
  = validated AppToolCatalog
```

Every tool name is globally unique inside the catalog. App namespaces are mandatory
(`erp_*`, `crm_*`, `hro_*`). The catalog is filtered by Agent identity, user permissions,
installation entitlements, and runtime profile before it reaches the model.

The current rule that rejects `allowedAgents` remains correct until durable Agent identity exists.
This design introduces that identity and then makes the field enforceable.

### Decision 7: AI-native means two controlled loops

**Design loop**

```text
intent requirements
  -> Context Compiler (minimal relevant schema)
  -> LLM proposes Delta
  -> schema/reference/policy validation
  -> deterministic repair loop
  -> compiler + simulation/evaluation
  -> signed Blueprint release
```

**Run loop**

```text
user intent
  -> durable Agent run
  -> plan from app-scoped tools
  -> permission + entitlement + confirmation checks
  -> deterministic tool execution
  -> Interaction Plan and/or task result
  -> audit + feedback
```

The LLM is replaceable and is never the source of business facts, permissions, accounting, state
transitions, or human confirmation. AI-native does not mean chat-only: fixed pages remain useful for
high-frequency, audited workflows, while Interaction Surfaces handle intent-specific work.

### Decision 8: Same Runtime, three deployment profiles

| Profile | Default data | License/entitlement | Operations |
| --- | --- | --- | --- |
| Shared SaaS | Shared PostgreSQL + RLS | Organization entitlement | Platform operated |
| Dedicated SaaS | Pooled app container, dedicated DB/schema | Installation entitlement | Platform operated |
| Standalone | Customer-hosted container + own DB | Offline/lease entitlement | Customer operated |

All profiles consume the same signed Blueprint release, migration metadata, and Runtime contracts.
Source-code generation is an optional export or extension mechanism, not the default way to deliver
an app.

## Target Architecture

```text
┌──────────────────────────── Control Plane ────────────────────────────┐
│ Identity / Organizations / Subscriptions / Entitlements               │
│ App Catalog / Publisher / Signed Blueprint Releases / Installations    │
│ AI Design Studio / Context Compiler / Delta / Evaluation / Licensing   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ install release + policy
┌──────────────────────────────────▼─────────────────────────────────────┐
│ Shared Business App Runtime                                           │
│                                                                        │
│  AppInstallation Context                                               │
│   ├─ Semantic / Flow / Rule / Accounting Runtime                       │
│   ├─ AppToolCatalog ── Atomic / Plugin / Connector / Shared Data       │
│   ├─ Agent Runtime ── Session / Run / Step / Wait / Resume / Audit     │
│   ├─ Interaction Plan Renderer + Stable Pages                          │
│   └─ Outbox / Jobs / Usage / Notifications                            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ RLS + signed bindings
┌──────────────────────────────────▼─────────────────────────────────────┐
│ Data Plane                                                            │
│ Tenant business records │ Audit │ Agent traces │ Usage │ Secrets refs  │
└────────────────────────────────────────────────────────────────────────┘
```

## Reference Project Assessment

`~/Sync/project/guangfa/validation` demonstrates several patterns worth preserving:

- Tool contracts as the sole Agent action surface.
- Runtime identity derived from session/Agent context, never from model arguments.
- Five-layer authorization and immutable tool audit.
- Untrusted document boundaries and local redaction before outbound model calls.
- Persistent tasks/turns, `wait_user`, resume, sub-Agent isolation, and event replay.
- Skills as routeable operational knowledge, with controlled publication.
- A sandboxed Agent runtime separated from the business backend.

It is not the target platform architecture as-is because:

- It has one compliance domain and a mostly static tool/Agent catalog.
- Agents are largely generated from a deployment account file.
- The backend and Agent Host are operationally specific to OpenClaw/Java.
- It does not model app installations, entitlements, multi-app composition, or cross-app data.
- One container/Agent per employee is acceptable for a POC but not a default SaaS cost model.

The platform should extract the protocol and control patterns, while keeping the Agent Host
replaceable through an adapter contract.

## Domain Model

### Business app installation

```text
app_installations
  id
  organizationId
  appKey                    -- erp, crm, hro, mes, or publisher-scoped key
  displayName
  slug                      -- unique within organization
  blueprintId
  blueprintVersion
  releaseDigest
  licenseId
  deploymentProfile
  runtimeVersion
  status                    -- installing | active | suspended | failed | uninstalling
  config
  createdBy
```

### Marketplace/control-plane records

```text
blueprint_releases          -- immutable signed releases
blueprint_products          -- publisher-facing product metadata
app_entitlements            -- organization + product/release + limits + validity
app_usage_records           -- metering and quota inputs
app_memberships             -- user access to an installed app (if narrower than org)
app_role_bindings           -- app-scoped roles/permissions
```

### Agent runtime records

```text
agent_definitions           -- immutable/versioned role, instructions, policy, tool scopes
agent_instances             -- user + org + app + definition binding
agent_sessions              -- durable conversation/thread
agent_runs                  -- one execution attempt with state and budget
agent_steps                 -- plan/tool/model/assistant events for replay
agent_waits                 -- user input or external callback waits
agent_tool_calls            -- normalized invocation/audit trace
```

## App and Agent Lifecycle

### Application release

```text
draft -> validated -> simulated -> certified -> published
                                      \-> deprecated
```

### Application installation

```text
installing -> active -> suspended -> active
     \-> failed                 \-> uninstalling -> removed
```

Installation is idempotent and records the exact Blueprint digest, Runtime version, license, and
module/tool bindings. Upgrades create a new installation revision; rollback reactivates the previous
revision only if data compatibility permits it and the old release remains authorized.

### Agent run

```text
queued -> running
            ├─ waiting_user -> queued
            ├─ waiting_external -> queued
            ├─ completed
            ├─ failed
            └─ cancelled
```

A run has hard limits for steps, wall time, model tokens/cost, parallel children, and write actions.
The server owns state transitions; the model cannot mark its own run complete or confirmed.

## API Shape

New backend surfaces should be app-aware and thin:

```text
GET    /api/apps
POST   /api/apps/install
GET    /api/apps/:installationId
POST   /api/apps/:installationId/upgrade
POST   /api/apps/:installationId/rollback
GET    /api/apps/:installationId/tools
GET    /api/apps/:installationId/navigation

POST   /api/apps/:installationId/agent/sessions
POST   /api/apps/:installationId/agent/sessions/:sessionId/messages
GET    /api/apps/:installationId/agent/runs/:runId
POST   /api/apps/:installationId/agent/runs/:runId/cancel
GET    /api/apps/:installationId/agent/events?after=...
```

Existing `/api/blueprints`, `/api/modules`, and `/api/chat` entry points remain during migration,
but app-scoped resources must eventually require an installation context or return a deprecation
error. Platform-only admin APIs use an explicit platform scope and never infer it from a normal
tenant token.

## Frontend Shape

The shell has two selectors:

1. Organization switcher: changes tenant.
2. Application switcher: changes the installed business app inside the tenant.

Navigation, home surface, chat/Agent availability, theme, and permissions are resolved per app.
Interaction Surfaces remain ephemeral and do not acquire URLs. Stable pages remain for dashboards,
audit, governance, and high-frequency workflows.

The current hardcoded shipping/ERP routes are treated as the first app migration, not as platform
shell routes.

## AI and Model Gateway

Replace direct provider calls with one gateway interface:

```ts
interface ModelGateway {
  complete(request: ModelRequest): Promise<ModelResponse>
  stream(request: ModelRequest): AsyncIterable<ModelChunk>
}
```

Every trace records:

```text
requestedModel        -- stable alias, e.g. deepseek-flash
resolvedModel         -- provider-reported snapshot when available
provider/baseUrlHost  -- never the full secret-bearing URL
prompt/contextDigest
input/output tokens
latency/cost
```

Model credentials are secret references, not plaintext database columns. A tenant or release may
select among platform-approved model profiles, but cannot inject an arbitrary endpoint into a
production Agent run.

## Migration Plan

### Phase 0: Freeze boundaries and compatibility

- Approve this proposal.
- Add the app, agent, and AI design protocol deltas.
- Define compatibility rules for tenant-only endpoints and existing Blueprint records.

### Phase 1: Tenant and app foundation

- Add `app_installations` and app-aware execution context.
- Implement PostgreSQL RLS for tenant tables; keep service predicates.
- Map existing organization data to a default `erp` installation.
- Add app switcher and dynamic navigation.

### Phase 2: Two-app vertical slice

- Move the current auto-parts/shipping ERP surface into the `erp` app.
- Add a small CRM app without hardcoded shell routes.
- Prove explicit cross-app `customer.lookup` / `customer.read` capability.
- Prove one user can switch apps and cannot cross-read private app records.

### Phase 3: Durable Agent Host

- Add Agent Definition, Instance, Session, Run, Step, Wait, and event replay records.
- Compose and validate app-scoped tool catalogs.
- Enforce `allowedAgents`, user permissions, entitlement, budgets, and confirmation.
- Migrate current chat to a session in the `erp` app.

### Phase 4: AI design pipeline

- Add provider-neutral model gateway and secret references.
- Add Context Compiler and Delta validation/repair.
- Add evaluation/simulation gates before Blueprint publication.
- Retire direct `/v1/messages` assumptions from AI module generation.

### Phase 5: Delivery profiles and economics

- Add entitlements, usage metering, and plan-to-app mapping.
- Support shared SaaS, dedicated SaaS, and standalone bundle from the same release.
- Retain source generation only as an explicit authorized export/extension path.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| One huge "platform" refactor stalls delivery | Use ERP + CRM vertical slice; each phase has an executable acceptance test |
| App context added inconsistently | One request/run context type and one context resolver; negative tests for every raw path |
| RLS breaks jobs/admin tooling | Explicit transaction helper and audited platform scope; never use superuser for product queries |
| Cross-app sharing creates accidental coupling | Published data capabilities only; no direct joins; owner controls projection |
| Agent runtime becomes a parallel business-logic layer | Agent Host has no direct database access; only app tools and Interaction Plan |
| Per-user Agent containers are too expensive | Durable logical sessions plus pooled/ephemeral sandboxes; containers are execution resources, not identity |
| Model upgrades silently change behavior | Record requested alias and resolved snapshot; evaluation gate and per-release model policy |
| Source export undermines the platform | Treat as authorized delivery profile; keep Runtime and protocol tests as the compatibility gate |
| Existing data migration fails | Default app installation mapping, idempotent backfill, dry-run and rollback checks |
| Generic JSONB records become a hot table | Benchmark per-app access patterns; add tenant/app partitioning and indexes only after measured pressure |

## Open Questions

1. Should a user's app access be organization-wide by default, or require an explicit app membership?
   Recommended: organization-wide read of app catalog, explicit app membership for business roles.
2. Should the first shared capability be `customer`, `party`, or a capability owned by ERP?
   Recommended: start with ERP-owned `customer.lookup`; do not introduce a universal Party model yet.
3. Is standalone delivery a signed container bundle or an exported source repository?
   Recommended: signed container bundle first; source export only for licensed extension scenarios.
4. Which Agent Host ships first?
   Recommended: keep OpenClaw as an adapter reference, but define and test the runtime contract against
   a built-in deterministic host before choosing a production dependency.
5. Which model profile is the default for design versus runtime?
   Recommended: task-based routing with pinned/evaluated profiles, never one global `isDefault` model.
