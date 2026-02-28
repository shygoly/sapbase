# Pharmana -> Sapbase Integration Mapping (Phase 1 + Phase 2)

## Scope
Phase 1 integrates Pharmana lab core flows into sapbase native contexts:
- Sample Management
- Method Registry
- Workflow Execution
- QA Review

Phase 2 extends the integration with:
- Report Generation
- Immutable Audit Trail

## Data Mapping
- `Sample` -> `LabSample`
  - `sampleCode`, `sampleType`, `quantity`, `status`, assignment fields
- `Method` + `MethodVersion` -> `LabMethod` + `LabMethodVersion`
- `WorkflowExecution` (lab use case) -> `LabWorkflowExecution`
- `AnalysisSubmission` + `AnalysisReview` -> `LabQaSubmission` + `LabQaReview`
- `Report` -> `LabReport`
  - `title`, `status`, `format`, `language`, generation/finalization metadata
- `AuditLog` -> `LabAuditLog`
  - `action`, `entityType`, `entityId`, `details`, append-only digest

All target entities are tenant-scoped by `organizationId`.

## API Mapping
### Native Sapbase APIs
- `GET/POST /api/lab/samples`
- `GET/PATCH /api/lab/samples/:id`
- `PATCH /api/lab/samples/:id/status`
- `POST /api/lab/samples/:id/assign-method`
- `GET/POST /api/lab/methods`
- `GET/PATCH /api/lab/methods/:id`
- `GET/POST /api/lab/methods/:id/versions`
- `POST /api/lab/workflow-executions`
- `GET /api/lab/workflow-executions/:id`
- `GET /api/lab/workflow-executions/analyst/work-queue`
- `POST /api/lab/workflow-executions/:id/steps/complete`
- `POST /api/lab/qa/submissions`
- `GET /api/lab/qa/review-queue`
- `POST /api/lab/qa/reviews`
- `GET/POST /api/lab/reports`
- `GET /api/lab/reports/:id`
- `POST /api/lab/reports/:id/generate`
- `POST /api/lab/reports/:id/finalize`
- `POST /api/lab/audit/logs`
- `GET /api/lab/audit/logs`
- `GET /api/lab/audit/export`

### Compatibility APIs
- `GET/POST /api/samples`
- `GET/PATCH /api/samples/:id`
- `PATCH /api/samples/:id/status`
- `POST /api/samples/:id/assign-method`
- `GET/POST /api/methods`
- `GET/PATCH /api/methods/:id`
- `POST /api/methods/:id/versions`
- `GET /api/analyst/work-queue`
- `POST /api/workflow/execution`
- `GET /api/workflow/:executionId`
- `POST /api/workflow/:executionId/steps/complete`
- `GET /api/qa/review-queue`
- `POST /api/qa/submissions`
- `POST /api/qa/reviews`
- `GET/POST /api/reports`
- `GET /api/reports/:id`
- `POST /api/reports/:id/generate`
- `POST /api/reports/:id/finalize`
- `POST /api/audit/logs`
- `GET /api/audit/logs`
- `GET /api/audit/export`

## Frontend Integration
New pages under Speckit dashboard:
- `/dashboard/lab/samples`
- `/dashboard/lab/methods`
- `/dashboard/lab/workflows`
- `/dashboard/lab/qa`
- `/dashboard/lab/reports`
- `/dashboard/lab/reports/[id]`
- `/dashboard/lab/audit`

Navigation section added: `Lab Operations`.

## Migration Notes (Phase 2 Backfill)
1. Report history backfill:
- Migrate historical Pharmana report rows into `lab_reports`
- Preserve source identifiers in `metadata.sourceReportId`
- Map old status values to `draft/generated/finalized`

2. Audit history backfill:
- Migrate historical immutable audit records into `lab_audit_logs`
- Recompute digest per row during import to keep tamper-evident chain
- Preserve legacy log ID in `details.legacyLogId`

3. Execution strategy:
- Perform migration per `organizationId` in batches
- Use idempotent import keys (`organizationId + legacyId`)
- Validate row counts and random record hashes after each batch
