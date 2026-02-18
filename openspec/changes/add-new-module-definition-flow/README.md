# New Module Definition vs Patch Protocol

## Publish pipeline (patches)

After AI or human produces a patch, the system applies it through:

1. **Validator** — `PatchValidator` (speckit) validates scope, operation, target, payload, security level.
2. **Dry Run** — `PatchExecutor` in dry-run mode returns a preview without writing.
3. **Apply** — `PatchManager.applyPatch()` executes and writes schema changes.
4. **Versioned Save** — `VersionControl` creates a new schema version with patch metadata.

This pipeline runs in the frontend (PatchManager). The backend stores normalized `patchContent` (patchId, timestamp, actor, scope, operation, target, payload) and registers the module; actual schema apply happens when the client runs the patch through PatchManager.

## New module definition (6 steps)

1. Object model  
2. Relationships  
3. State flow  
4. Pages  
5. Permissions  
6. Reports  

Implemented as `NewModuleDefinitionWizard` on the develop page ("Define new module (6 steps)").
