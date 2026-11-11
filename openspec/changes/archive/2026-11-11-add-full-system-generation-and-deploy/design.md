# Design: Full System Generation and Deploy

## Permission
- **Name**: `system:generate`
- **Meaning**: Allowed to trigger “generate full system from module definition” and “deploy generated system”. Highest privilege for codegen and deploy.
- **Who has it**: In seed, assign to Admin role so testing can use admin. In production, only assign to roles that should be able to regenerate and deploy the system (e.g. super admin or deploy role).

## API

### Generate full system
- **Endpoint**: `POST /api/ai-modules/:id/generate-system` (or `POST /api/system/generate` with body `{ moduleId }`).
- **Auth**: `@Auth('system:generate')`.
- **Input**: Module ID (and optionally options: output format, target stack).
- **Output**: 
  - Option A: Synchronous JSON with `{ jobId, status }` and artifact URL or base64 once ready.
  - Option B: Async job id; client polls or webhook for result.  
  For minimal first version: return a **jobId** and **status: 'queued' | 'running' | 'completed' | 'failed'**, and a **artifactPath** or **downloadUrl** when completed. Stub implementation returns jobId and status without real codegen.
- **Behavior**: Validate module exists and user has `system:generate`. Enqueue or run generation (stub: no-op or placeholder files). Return job id and status.

### Deploy generated system
- **Endpoint**: `POST /api/ai-modules/deploy` or `POST /api/system/deploy` with body `{ jobId }` or `{ artifactUrl }`.
- **Auth**: `@Auth('system:generate')`.
- **Input**: Reference to the generated artifact (jobId from generate-system, or artifact URL).
- **Output**: `{ deployId, status }`. Stub: return success and status without calling real deploy.
- **Behavior**: Validate user has `system:generate`. In stub, return 200 and status; later integrate with real deploy script or CI.

## Data model
- Optional: **GenerationJob** entity (id, moduleId, status, artifactPath, createdAt, completedAt) to track jobs. Can be added in a follow-up when implementing real codegen.
- For stub: in-memory or no persistence is acceptable.

## Security
- All generate-system and deploy endpoints SHALL require `system:generate`.
- Audit log: log who triggered generate/deploy and when (recommended when implementing real pipeline).

## Stub vs real implementation
- **This change**: Add permission, endpoints with stub (return jobId/status or success without writing real code or calling deploy).
- **Follow-up**: Implement actual code generator (templates for backend/frontend from Patch or 6-step definition) and deploy hook (script or CI trigger).
