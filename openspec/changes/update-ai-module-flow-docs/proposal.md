# Change: Document AI Module Lifecycle and Patch Metadata Extraction

## Why
The AI module lifecycle is implemented, but the end-to-end flow and Patch DSL metadata rules are not explicitly captured in OpenSpec. This makes it easy for AI-generated patches to omit fields that the registry depends on and makes CRM workflows harder to reason about.

## What Changes
- Document the AI module lifecycle (create → generate patch → test → review → publish/unpublish) with CRM as the concrete example.
- Specify the Patch DSL shapes required for metadata extraction (`objects` map or `scope` + `target.identifier`) and optional `apiBasePath`/`schemaPath`.
- Clarify how publishing registers or updates modules in Module Registry and how capabilities are derived.

## Impact
- Affected specs: `ai-module-management`, `patch-dsl-system`, `module-registry`
- Affected code (reference only): `backend/src/ai-modules/ai-modules.service.ts`, `backend/src/module-registry/*`, `speckit/src/app/admin/ai-modules/*`

## Detailed Flow (CRM Example)
1. **Create Module**
   - Endpoint: `POST /api/ai-modules`
   - Result: New `AIModule` record in `draft` status with `createdById`.
2. **Generate Patch**
   - Endpoint: `POST /api/ai-modules/:id/generate`
   - Result: `patchContent` (Patch DSL JSON), `naturalLanguagePrompt`, and `aiModelId` are stored.
3. **Run Tests**
   - Endpoint: `POST /api/ai-modules/:id/test`
   - Result: CRM test suite runs (Customer/Order/OrderTracking/FinancialTransaction); `testResults` recorded.
4. **Submit for Review**
   - Endpoint: `POST /api/ai-modules/:id/submit-review`
   - Precondition: All tests pass.
   - Result: Module status becomes `pending_review`.
5. **Review Decision**
   - Endpoint: `POST /api/ai-modules/:id/review`
   - Result: Status becomes `approved` or `rejected`; review comments stored.
6. **Publish**
   - Endpoint: `POST /api/ai-modules/:id/publish`
   - Result: Status becomes `published`, `publishedAt` is set, and the module is registered/updated in Module Registry.
   - Note: Patch application is a TODO in current implementation.
7. **Registry Registration**
   - Extracts `entities`, `apiBasePath`, and `schemaPath` from Patch DSL.
   - Creates/updates `ModuleRegistry` and associated `ModuleCapability` entries.
8. **Unpublish**
   - Endpoint: `POST /api/ai-modules/:id/unpublish`
   - Result: Status becomes `unpublished`, `unpublishedAt` is set.
   - Note: Patch rollback is a TODO in current implementation.
9. **CRM Reference**
   - CRM module is seeded into Module Registry with metadata, capabilities, and statistics to serve as a canonical example.

## Patch DSL Metadata Recognition Rules
To ensure `extractMetadataFromPatch` can recognize module metadata, patches SHOULD include:

- **Multi-entity modules** (preferred for CRM):
```json
{
  "version": "1.0",
  "objects": {
    "Customer": {},
    "Order": {},
    "OrderTracking": {},
    "FinancialTransaction": {}
  },
  "apiBasePath": "/crm",
  "schemaPath": "/public/specs/modules/crm"
}
```

- **Single-entity modules** (fallback):
```json
{
  "version": "1.0",
  "scope": "object",
  "operation": "add",
  "target": { "type": "object", "identifier": "Customer" },
  "apiBasePath": "/crm",
  "schemaPath": "/public/specs/modules/crm"
}
```

Extraction behavior:
- If `objects` exists, entity list is `Object.keys(objects)`.
- Otherwise, if `scope === "object"` and `target.identifier` exists, entity list is `[identifier]`.
- If present, `apiBasePath` and `schemaPath` are stored in module metadata.
