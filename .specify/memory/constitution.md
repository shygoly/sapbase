<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.1.0
- Modified principles:
  - I. Runtime-First and Schema-Driven Delivery -> I. Monorepo Boundary and Runtime Consistency
  - II. Contract-First APIs and Shared Types -> II. Contract-First and Unit-Consistent Data
  - III. Tenant-Safe Security by Default -> III. Tenant Isolation and Least-Privilege Access
  - IV. Verification Before Completion -> IV. Deterministic Calculation and Auditable Snapshots
  - V. Traceable Operations and Change Records -> V. Evidence-Driven Delivery and Quality Gates
- Added sections:
  - Domain Rules and Regulatory Baselines
- Removed sections: None
- Templates requiring updates:
  - ✅ updated: .specify/templates/plan-template.md (no required change)
  - ✅ updated: .specify/templates/spec-template.md (no required change)
  - ✅ updated: .specify/templates/tasks-template.md (no required change)
- Follow-up TODOs:
  - Define a dedicated checklist for calculation formula review and regulatory parameter versioning.
-->
# Speckit Constitution

## Core Principles

### I. Monorepo Boundary and Runtime Consistency
All work MUST respect the current monorepo boundaries:
- `backend/` for NestJS APIs and domain logic
- `speckit/` for Next.js frontend and runtime UI
- `shared-schemas/` for shared contracts and types

New features MUST integrate with existing runtime architecture and routing conventions rather than introducing parallel frameworks or one-off infrastructure.

### II. Contract-First and Unit-Consistent Data
Any frontend/backend integration MUST start from explicit API contracts and typed DTOs.
Data semantics and units MUST be unambiguous and consistently enforced across storage, APIs, and UI.

For carbon-management domain, the default canonical units are:
- Fuel consumption: ton
- Distance: nautical mile
- Energy: MJ
- Emissions: gCO2eq or tCO2eq (with explicit conversion rules)

Breaking contract changes MUST include migration notes and compatibility impact.

### III. Tenant Isolation and Least-Privilege Access
This system is multi-tenant. Tenant boundaries are mandatory.
Every protected operation MUST enforce authentication and organization scoping.

Rules:
- Tenant-scoped data MUST always be filtered by `organizationId`
- Privileged operations MUST have explicit permission checks
- Secrets and keys MUST come from environment configuration, never hard-coded

### IV. Deterministic Calculation and Auditable Snapshots
Behavior-changing calculations MUST be deterministic, reproducible, and auditable.
For reporting and compliance domains, the system MUST support versioned parameters and reproducible snapshot outputs.

Rules:
- Calculation formulas MUST be explicitly documented in specs
- Input parameters used in a report MUST be traceable
- Recalculation MUST not destroy historical evidence

### V. Evidence-Driven Delivery and Quality Gates
No task is complete without verification evidence.
Every change MUST run relevant lint/test/build checks in affected workspace(s) and report outcomes.

Minimum expectation:
- Backend changes: run targeted backend tests/lint/build checks
- Frontend changes: run targeted frontend lint/build checks
- Contract changes: verify API client/server compatibility

If verification cannot run, the limitation MUST be explicitly documented in delivery notes.

## Domain Rules and Regulatory Baselines

When implementing shipping-carbon features:
- Regulatory formulas and constants MUST be versioned and source-traceable
- Manual overrides (such as tenant-provided compliance history) MUST be explicit, auditable, and non-silent
- Dashboard metrics MUST remain consistent with backend report definitions
- Any assumption on policy years, coefficients, or transition factors MUST be explicitly encoded and documented

## Engineering Standards

- Primary stack remains TypeScript across workspaces
- Backend persistence uses PostgreSQL + TypeORM conventions
- Externally visible APIs MUST stay aligned with generated OpenAPI artifacts
- New dependencies SHOULD be minimal and justified by maintenance/security impact
- Large capability work SHOULD follow spec-kit workflow (`/speckit.specify` -> `/speckit.plan` -> `/speckit.tasks`)

## Workflow and Review Gates

1. Start with feature specification before significant implementation.
2. Keep tasks independently testable by user story where possible.
3. Prefer small, reviewable increments over broad, mixed refactors.
4. Keep docs/specs in sync with implementation scope.
5. Block completion when constitution violations remain unresolved.

## Governance

This constitution is the highest-priority engineering agreement for this repository.
When conflicts occur, this document supersedes ad-hoc practices.

Amendment policy:
- Amendments MUST include an updated Sync Impact Report
- Versioning rules:
  - MAJOR: incompatible governance/principle changes
  - MINOR: new obligations/sections or materially stronger standards
  - PATCH: wording clarifications without semantic change
- `Last Amended` MUST reflect the accepted change date

Compliance policy:
- Planning artifacts MUST include constitution checks
- Implementation reviews MUST flag violations before merge
- Exceptions MUST be explicit, justified, and time-bounded

**Version**: 1.1.0 | **Ratified**: 2026-03-09 | **Last Amended**: 2026-03-09
