# Pharmana -> Sapbase Integration Mapping (Phase 1)

## Scope
Phase 1 integrates Pharmana lab core flows into sapbase native contexts:
- Sample Management
- Method Registry
- Workflow Execution
- QA Review

## Data Mapping
- `Sample` -> `LabSample`
  - `sampleCode`, `sampleType`, `quantity`, `status`, assignment fields
- `Method` + `MethodVersion` -> `LabMethod` + `LabMethodVersion`
- `WorkflowExecution` (lab use case) -> `LabWorkflowExecution`
- `AnalysisSubmission` + `AnalysisReview` -> `LabQaSubmission` + `LabQaReview`

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

## Frontend Integration
New pages under Speckit dashboard:
- `/dashboard/lab/samples`
- `/dashboard/lab/methods`
- `/dashboard/lab/workflows`
- `/dashboard/lab/qa`

Navigation section added: `Lab Operations`.
