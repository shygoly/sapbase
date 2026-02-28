# Change: Integrate Pharmana Lab Core Contexts

## Why
Pharmana provides mature lab-domain capabilities (sample, method, workflow execution, QA review) that are currently absent from sapbase core modules. Integrating them as native sapbase contexts enables DDD-aligned multi-tenant lab workflows without relying on ad-hoc APIs.

## What Changes
- Add native backend contexts: `sample-context`, `method-context`, `lab-workflow-context`, `qa-context`
- Add compatibility API controller group preserving critical Pharmana endpoint shapes
- Add dashboard lab entry points in Speckit frontend for samples/methods/work-queue/QA queue
- Wire new entities and modules into `backend/src/app.module.ts`
- Add initial unit tests for core context services

## Impact
- Affected code:
  - `backend/src/sample-context/*`
  - `backend/src/method-context/*`
  - `backend/src/lab-workflow-context/*`
  - `backend/src/qa-context/*`
  - `backend/src/pharmana-compat/*`
  - `backend/src/app.module.ts`
  - `speckit/src/app/[locale]/dashboard/lab/*`
  - `speckit/src/config/nav-config.ts`
  - `speckit/src/lib/api/lab.api.ts`
- API behavior:
  - Adds `/api/lab/*` native API paths
  - Adds compatibility paths under `/api/samples`, `/api/methods`, `/api/qa/*`, `/api/analyst/work-queue`, `/api/workflow/*`
