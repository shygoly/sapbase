# Full Lifecycle E2E Test

## Running the test

From the **backend** directory:

```bash
npm run test:lifecycle-e2e
```

Or run all e2e tests:

```bash
npm run test:e2e
```

## Dependencies

- **Database**: The test uses the same app and DB config as other e2e tests (see `test/jest-e2e.json` and `AppModule`). Use a test database (e.g. set `DB_NAME=sapbasic_test` or `DATABASE_NAME`) so the test does not write to production or shared dev data.
- **Permissions**: The test creates its own user with `system:manage` and `system:generate` in `beforeAll`, so **no seed is required**. For CI, ensure the test DB is available and optionally run migrations or seed if your setup expects it.

## What the test covers

1. Create AI module (POST create) → assert 201 and module id  
2. Run tests (POST :id/test) so submit-review is allowed  
3. Submit for review (POST submit-review) → assert status `pending_review`  
4. Approve (POST review with decision approved) → assert status `approved`  
5. Publish (POST publish) → assert status `published`  
6. Generate system (POST :id/generate-system) → assert 200 and jobId  
7. Deploy (POST /api/system/deploy) → assert 200 and deployId  
8. Unpublish (POST :id/unpublish) → assert status `unpublished`  

Generate and deploy use stub implementations (jobId/deployId returned without real work).
