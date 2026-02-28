# Change: Integrate Pharmana Report and Audit Contexts

## Why
Phase 1 integrated Pharmana lab core flows (sample/method/workflow/QA). Phase 2 must add report generation and immutable audit capabilities to complete regulated lab operations and preserve compatibility with existing Pharmana consumers.

## What Changes
- Add native backend contexts:
  - `report-context` (report lifecycle, template binding, generation metadata)
  - `audit-context` (append-only audit logs, query/export capabilities)
- Add compatibility API endpoints for Pharmana report/audit routes
- Extend Speckit frontend with report and audit pages under dashboard lab/compliance navigation
- Add mapping docs from Pharmana report/audit models to sapbase tenant-aware entities
- Add unit/integration tests for report and audit context services

## Impact
- Affected code:
  - `backend/src/report-context/*`
  - `backend/src/audit-context/*`
  - `backend/src/pharmana-compat/*` (additional compatibility routes)
  - `backend/src/app.module.ts`
  - `speckit/src/app/[locale]/dashboard/lab/reports/*`
  - `speckit/src/app/[locale]/dashboard/lab/audit/*`
  - `speckit/src/lib/api/lab.api.ts` or dedicated report/audit API clients
- APIs:
  - New native paths under `/api/lab/reports` and `/api/lab/audit`
  - Compatibility aliases for Pharmana paths (`/api/reports*`, `/api/audit*`)
