# Tasks: Full System Generation and Deploy

- [x] Add permission `system:generate` to backend (seeds: permission name + assign to Admin role).
- [x] Add `POST /api/ai-modules/:id/generate-system` (or dedicated system controller) protected by `@Auth('system:generate')`; stub returns jobId and status.
- [x] Add `POST /api/system/deploy` (or under ai-modules) protected by `@Auth('system:generate')`; stub returns deployId and status.
- [x] Document in design/proposal that real codegen and deploy pipeline are follow-up work; this change establishes permission and API contract.
- [ ] Optional: Frontend button “Generate system” / “Deploy” on AI module develop or review page, visible only when user has `system:generate`.
