# Change: Full System Generation and Deploy

## Why
The product goal is to **generate the full system** from the module definition (six-step or Patch DSL): both **frontend and backend source code** that can be re-deployed. Once generated, the system SHALL support **automatic deployment**. The actions that trigger **code generation** and **deploy** are highly sensitive and SHALL require the **highest permission**; for testing, the admin user SHALL be able to perform these actions.

## What Changes
- **ADDED**: Permission `system:generate` (or equivalent highest-privilege name) required to trigger full system code generation and deploy. Only users with this permission can call the generate/deploy endpoints.
- **ADDED**: Backend API to **generate full system** from an AI module (or from its definition): output is deployable frontend + backend code (e.g. generated repo layout or artifact). The exact output format (monorepo layout, zip, etc.) is defined in design.
- **ADDED**: Backend API to **deploy** the generated system (e.g. trigger a deploy pipeline or script). Deployment may be asynchronous (job id) or synchronous depending on design.
- **ADDED**: Seed data: grant `system:generate` to the Admin role so that in test environments admin can execute generate and deploy.
- **DOCUMENTED**: Security model: generate and deploy are gated by `system:generate`; production can restrict this to a dedicated “super admin” role if desired.

## Impact
- Affected specs: `ai-module-management` (new requirements for full system generation and deploy).
- Affected code: backend (new permission in seeds; new or extended controller for generate-system and deploy; guards), optionally frontend (UI to trigger generate/deploy with permission check).

## Out of Scope (this change)
- Actual code generator implementation (templates, AST, file emission) can be a follow-up; this change establishes the **permission**, **API contract**, and **stub or minimal implementation** so that the flow exists and can be wired to a real generator later.
- Deployment pipeline (CI/CD, k8s, etc.) is environment-specific; this change adds the **trigger** (API) and optionally a stub or script hook; concrete pipeline is environment-dependent.
