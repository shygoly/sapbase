# Design: AI-Assisted Module Definition

## Context
- The 6-step new module definition wizard (add-new-module-definition-flow) exists and collects state per step; it does not yet call the AI.
- The backend already calls a configured AI (e.g. Kimi) for `generatePatch` and `modifyExistingModule` via `AIModelsService.findDefault()` and a messages API (system + user message).
- Users want to paste natural language (e.g. CRM entity/field narrative) and get back standard JSON for each step. Each step needs a dedicated system prompt so the AI returns the correct structure.

## Goals / Non-Goals
- **Goals**: (1) One system prompt per definition step, used when the user requests AI assistance for that step. (2) Backend endpoint that accepts step id + user input, calls AI with step’s system prompt + user input, returns structured output. (3) Wizard UI can trigger this per step and display/merge the result. (4) Output shape for each step is defined so prompts and parsers stay aligned.
- **Non-Goals**: (1) No generic “free-form” AI chat in the wizard; only step-scoped conversion. (2) No implementation of actual Patch application in this change; only definition-time AI assistance.

## Decisions

### 1. Where system prompts live
- **Decision**: Store the six system prompts in a maintainable, single source of truth. Prefer **backend-held config** (e.g. table or JSON config file under backend) so prompts can be updated without frontend deploys and so they are versioned with the app.
- **Alternatives**: Bundled in frontend (simpler but harder to tune without release); database table (flexible but adds migration and admin UI). Chosen approach allows starting with a config file or constants in backend, with option to move to DB later.

### 2. API shape
- **Decision**: Add a dedicated endpoint for definition-step AI call, e.g. `POST /api/ai-modules/definition-step` with body `{ stepId: string, userInput: string }` (stepId one of `object-model | relationships | state-flow | pages | permissions | reports`). Response: structured JSON for that step (or a wrapper with `{ data: <step output> }`). Reuse existing AI model resolution (default model) and the same HTTP client pattern as `generatePatch`.
- **Alternatives**: Reuse `POST /api/ai-modules/:id/generate` with a special “step” mode (more coupling and overloaded semantics). A separate endpoint keeps “new module definition” vs “patch generation” clearly separated.

### 3. Output schema per step
- **Decision**: Define a canonical output shape for each step so that (1) system prompts can require the AI to return that shape, and (2) the frontend can parse and fill the wizard state. Step 1 (object model): e.g. `{ entities: Array<{ identifier: string, label?: string, fields: Array<{ name: string, label?: string, type: string, required?: boolean }> }> }`. Steps 2–6: similar structured shapes (relationships as list of links; state flow as states/transitions; pages as list of page descriptors; permissions as role/scope rules; reports as report descriptors). Exact schema will be specified in tasks/spec; design only commits to “one defined shape per step.”

### 4. Error and partial output
- **Decision**: If the AI returns invalid or non-JSON content, the backend SHALL return a clear error and optionally a raw excerpt; the wizard SHALL show the error and leave the step editable so the user can fix input or retry. No silent fallback that injects wrong structure.

## Risks / Trade-offs
- **Prompt quality**: Poor system prompts yield bad JSON; mitigate by documenting and testing prompt/output pairs (e.g. CRM narrative → Step 1 JSON) and iterating prompts in config.
- **Token limits**: Very long user input may exceed model context; mitigate by recommending concise inputs or truncation rules in the system prompt.

## Migration Plan
- No migration of existing data. New endpoint and new UI behavior are additive. Existing “Create Module (quick)” and “Modify Existing” flows unchanged.

## Open Questions
- Whether system prompts should be editable by admins (future) and, if so, stored in DB vs config file.
