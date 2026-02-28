## 1. Domain and data model
- [x] 1.1 Define `report-context` entities, enums, and DTOs (tenant-aware)
- [x] 1.2 Define `audit-context` entities, enums, and DTOs (append-only)
- [x] 1.3 Register entities and modules in `backend/src/app.module.ts`

## 2. Application services and APIs
- [x] 2.1 Implement report context services/controllers (create/list/get/generate/finalize)
- [x] 2.2 Implement audit context services/controllers (append/query/export)
- [x] 2.3 Extend Pharmana compatibility controller with report/audit endpoints

## 3. Frontend integration
- [x] 3.1 Add Speckit pages for report list/detail and audit viewer/export
- [x] 3.2 Add navigation entries and permission keys for report/audit
- [x] 3.3 Add client API wrappers for report/audit endpoints

## 4. Verification (TDD)
- [x] 4.1 Add unit tests for report service state transitions
- [x] 4.2 Add unit tests for audit append-only constraints and query filters
- [x] 4.3 Add integration tests for compatibility API parity
- [x] 4.4 Run backend build/tests and frontend build in provisioned environment (backend build/tests pass; frontend build currently blocked by pre-existing `speckit/src/app/[locale]/admin/layout.tsx` React type mismatch)

## 5. Documentation
- [x] 5.1 Update `docs/pharmana-integration-mapping.md` with report/audit mapping
- [x] 5.2 Add migration notes for report and audit historical data backfill
