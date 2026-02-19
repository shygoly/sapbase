# Change: New Module Definition (6-Step) vs Patch Protocol

## Why
New module creation and incremental patches are different flows. A new module must follow a fixed definition order (object model → relationships → state flow → pages → permissions → reports) and produce unified artifacts; patches supplement existing modules with a standardized schema and a publish pipeline (Validator → Dry Run → Apply → Versioned Save). Without this split, AI and UI mix "create from scratch" with "change one thing" and the publish path is unclear.

## What Changes
- **ADDED**: 6-step new module definition flow and conventions (unified object model, state machine DSL, permission DSL, page schema, component registry, Patch protocol).
- **ADDED**: New module definition step component (wizard) with steps: 1 Object model, 2 Relationships, 3 State flow, 4 Pages, 5 Permissions, 6 Reports.
- **DOCUMENTED**: Patch protocol schema (version, patchId, timestamp, actor, scope, operation, target, payload) and five patch types: page structure, form structure, permission rules, state machine, menu/navigation.
- **DOCUMENTED**: Publish pipeline: AI → Patch → Validator → Dry Run → Apply → Versioned Save.
- **DOCUMENTED**: CRM example (Lead → Account → Opportunity → Contract; states draft→qualified→proposal→won→lost; permissions sales/manager/finance).

## Impact
- Affected specs: `ai-module-management`, `patch-dsl-system`
- Affected code: `speckit/src/app/admin/ai-modules/develop/`, new step component; `speckit/src/core/patch/types.ts` (optional layout scope); backend `ai-modules.service.ts` (normalize patchContent).

## New Module Definition — Step Order
1. Define object model (unified object model).
2. Define relationships (e.g. Lead → Account → Opportunity → Contract).
3. Define state flow (state machine DSL, e.g. draft → qualified → proposal → won → lost).
4. Generate pages (page schema).
5. Generate permission rules (permission DSL: sales own, manager all, finance contracts).
6. Generate reports.

## Patch Protocol — Five Patch Types
| Type            | Scope     | Description        |
|-----------------|-----------|--------------------|
| Page structure  | page      | Page layout/views  |
| Form structure  | object    | Forms, fields      |
| Permission rules| permission| Roles, scopes      |
| State machine   | state     | States, transitions|
| Menu/navigation | menu      | Menu items         |

Publish flow: **AI → Patch → Validator → Dry Run → Apply → Versioned Save**.
