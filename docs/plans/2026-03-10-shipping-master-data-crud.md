# Shipping Master Data CRUD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build full CRUD management for vessel type parameters, fuel types, and year parameters under `System Setting`, replacing the current placeholder pages.

**Architecture:** Reuse the existing shipping-carbon module and OpenAPI contract shape for constants endpoints. Implement backend CRUD services and controllers first, then wire frontend admin pages to real APIs with table + dialog-based editing, preserving the demo-style navigation already in place.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Next.js App Router, React, shadcn/ui, existing shipping API client layer.

---

### Task 1: Lock backend contract coverage with e2e tests

**Files:**
- Create: `backend/test/shipping-carbon-constants.e2e-spec.ts`
- Modify: `specs/001-shipping-carbon-management/tasks.md`

**Step 1: Write failing tests**
- Add test cases for `GET/POST/PATCH/DELETE /api/shipping/constants/years`
- Add test cases for `GET/POST/PATCH/DELETE /api/shipping/constants/fuels/system`
- Add test cases for `GET/POST/PATCH/DELETE /api/shipping/constants/cii-ship-types`
- Cover invalid payloads and tenant visibility for fuel types

**Step 2: Run targeted test**
- Run: `npm run test --workspace backend -- shipping-carbon-constants.e2e-spec.ts`
- Expected: FAIL because endpoints are incomplete or missing

**Step 3: Keep test fixtures minimal**
- Reuse existing auth/org bootstrap helpers
- Seed only one org-private fuel type for tenant-isolation assertions

**Step 4: Re-run tests after each endpoint family lands**
- Run the same command after years, fuels, and cii ship types are implemented

### Task 2: Implement year parameter CRUD

**Files:**
- Create: `backend/src/shipping-carbon/api/controllers/year-parameters.controller.ts`
- Create: `backend/src/shipping-carbon/application/services/year-parameters.service.ts`
- Modify: `backend/src/shipping-carbon/shipping-carbon.module.ts`
- Modify: `backend/src/shipping-carbon/infrastructure/persistence/entities/year-parameter.entity.ts`

**Step 1: Add the failing tests for years**
- Assert list returns seeded records
- Assert create persists a new year
- Assert update changes numeric fields
- Assert delete removes the record

**Step 2: Implement minimal service**
- Inject repository for `YearParameter`
- Add `findAll/create/update/delete`
- Enforce unique `year`

**Step 3: Implement controller**
- Map to `/api/shipping/constants/years`
- Keep admin-only mutations
- Return DTO-safe payloads

**Step 4: Re-run year tests**
- Run the targeted e2e file until years pass

### Task 3: Implement system fuel type CRUD

**Files:**
- Create: `backend/src/shipping-carbon/api/controllers/system-fuel-types.controller.ts`
- Create: `backend/src/shipping-carbon/application/services/system-fuel-types.service.ts`
- Modify: `backend/src/shipping-carbon/shipping-carbon.module.ts`
- Modify: `backend/src/shipping-carbon/infrastructure/persistence/entities/system-fuel-type.entity.ts`

**Step 1: Add the failing tests for fuels**
- Assert list includes system records
- Assert create can insert org-private fuel types when scoped to current organization
- Assert update changes factors and prices
- Assert delete removes only allowed records

**Step 2: Implement service rules**
- List returns `organizationId IS NULL` plus current organization records
- Create/update/delete apply only to allowed records
- Enforce global/private uniqueness by `code`

**Step 3: Implement controller**
- Map to `/api/shipping/constants/fuels/system`
- Keep filtering based on authenticated organization

**Step 4: Re-run fuel tests**
- Run the targeted e2e file until fuel tests pass

### Task 4: Implement CII ship type parameter CRUD

**Files:**
- Create: `backend/src/shipping-carbon/api/controllers/cii-ship-type-parameters.controller.ts`
- Create: `backend/src/shipping-carbon/application/services/cii-ship-type-parameters.service.ts`
- Modify: `backend/src/shipping-carbon/shipping-carbon.module.ts`
- Modify: `backend/src/shipping-carbon/infrastructure/persistence/entities/cii-ship-type-parameter.entity.ts`

**Step 1: Add the failing tests for CII ship types**
- Assert list returns seeded ship type ranges
- Assert create inserts a new range
- Assert update changes coefficients
- Assert delete removes a range
- Assert invalid overlapping ranges fail

**Step 2: Implement service validation**
- Guard overlapping ranges for the same `shipType`
- Keep numeric field validation centralized

**Step 3: Implement controller**
- Map to `/api/shipping/constants/cii-ship-types`
- Keep admin-only mutations

**Step 4: Re-run CII ship type tests**
- Run the targeted e2e file until the whole suite passes

### Task 5: Add frontend constants API client

**Files:**
- Create: `speckit/src/lib/api/shipping/constants.api.ts`
- Modify: `speckit/src/lib/api/index.ts`
- Modify: `speckit/src/lib/api/generated/shipping.d.ts` or generated client usage wrappers if already present

**Step 1: Write lightweight client usage tests if patterns exist**
- Otherwise rely on page integration smoke verification

**Step 2: Implement CRUD wrappers**
- `listYears/createYear/updateYear/deleteYear`
- `listFuelTypes/createFuelType/updateFuelType/deleteFuelType`
- `listCiiShipTypes/createCiiShipType/updateCiiShipType/deleteCiiShipType`

**Step 3: Keep payload types explicit**
- Prefer generated OpenAPI types where available

### Task 6: Build Vessel Type Management CRUD page

**Files:**
- Modify: `speckit/src/app/[locale]/admin/system-settings/vessel-types/page.tsx`
- Create: `speckit/src/components/shipping/vessel-type-management/vessel-type-table.tsx`
- Create: `speckit/src/components/shipping/vessel-type-management/vessel-type-form-dialog.tsx`
- Create: `speckit/src/components/shipping/vessel-type-management/delete-vessel-type-dialog.tsx`

**Step 1: Replace placeholder page with failing loading state assumptions**
- Expect API data to render in a table

**Step 2: Implement list view**
- Show ship type, standard, range, coefficients

**Step 3: Implement create/edit dialog**
- Reuse shadcn `Dialog`, simple controlled form, validation

**Step 4: Implement delete action**
- Add confirmation dialog and toast feedback

**Step 5: Verify manually**
- Open `/en/admin/system-settings/vessel-types`
- Create, edit, and delete a test record

### Task 7: Build Fuel Type Management CRUD page

**Files:**
- Modify: `speckit/src/app/[locale]/admin/system-settings/fuel-types/page.tsx`
- Create: `speckit/src/components/shipping/fuel-type-management/fuel-type-table.tsx`
- Create: `speckit/src/components/shipping/fuel-type-management/fuel-type-form-dialog.tsx`
- Create: `speckit/src/components/shipping/fuel-type-management/delete-fuel-type-dialog.tsx`

**Step 1: Replace placeholder page**
- Load API data into a table

**Step 2: Show scope clearly**
- Distinguish system vs tenant-private rows
- Prevent destructive actions on immutable system rows if that rule is adopted

**Step 3: Implement create/edit/delete flows**
- Cover core factor fields and default price

**Step 4: Verify manually**
- Open `/en/admin/system-settings/fuel-types`
- Create one tenant-private fuel type and verify it appears in list

### Task 8: Build Year Management CRUD page

**Files:**
- Modify: `speckit/src/app/[locale]/admin/system-settings/years/page.tsx`
- Create: `speckit/src/components/shipping/year-management/year-table.tsx`
- Create: `speckit/src/components/shipping/year-management/year-form-dialog.tsx`
- Create: `speckit/src/components/shipping/year-management/delete-year-dialog.tsx`

**Step 1: Replace placeholder page**
- Load annual parameters into a table

**Step 2: Implement create/edit/delete flows**
- Cover year, FuelEU target, ETS coverage, EUA price

**Step 3: Verify manually**
- Open `/en/admin/system-settings/years`
- Create, edit, and delete a year record

### Task 9: Verification and cleanup

**Files:**
- Modify as needed based on verification

**Step 1: Run backend targeted tests**
- Run: `npm run test --workspace backend -- shipping-carbon-constants.e2e-spec.ts`
- Expected: PASS

**Step 2: Run frontend build or type-check**
- Run: `npm run build --workspace speckit`
- Expected: either PASS or only fail on known unrelated pre-existing issues

**Step 3: Manual UI verification**
- Login with `demo003 / demo003`
- Verify all three pages perform create/edit/delete successfully

**Step 4: Update task checklist**
- Mark T063-T070 complete only after tests and manual verification pass
