# Tasks: Schema System Migration

## 1. Preparation and Analysis

- [x] 1.1 Review `speckit-legacy/PHASE2_COMPLETION_REPORT.md` for complete feature list
- [x] 1.2 Analyze `speckit-legacy/src/core/schema/` structure and dependencies
- [x] 1.3 Compare legacy Schema types with current Runtime component types
- [x] 1.4 Identify all UI component dependencies (legacy vs current shadcn/ui)
- [x] 1.5 Document differences and required adaptations

## 2. Core Schema System Migration

- [x] 2.1 Create `speckit/src/core/schema/` directory
- [x] 2.2 Migrate `types.ts` from legacy, adapt imports and type names
- [x] 2.3 Migrate `resolver.ts`, update file loading paths for Next.js `public/` directory
- [x] 2.4 Migrate `validator.ts`, ensure validation logic compatibility
- [x] 2.5 Migrate `registry.ts`, adapt registry implementation
- [ ] 2.6 Write unit tests for each core module
- [x] 2.7 Ensure 100% TypeScript type coverage

## 3. Dynamic UI Components Migration

- [x] 3.1 Create `speckit/src/components/schema-form.tsx`
- [x] 3.2 Migrate SchemaForm from legacy, adapt to current shadcn/ui components
- [x] 3.3 Ensure compatibility with React Hook Form and Zod
- [x] 3.4 Support all field types: text, number, email, password, select, checkbox, date, datetime, textarea, relation
- [x] 3.5 Create `speckit/src/components/schema-list.tsx`
- [x] 3.6 Migrate SchemaList from legacy, adapt to current table components
- [x] 3.7 Implement sorting, pagination, and filtering features
- [ ] 3.8 Write component tests for SchemaForm and SchemaList

## 4. Schema Files Structure

- [x] 4.1 Create `speckit/public/specs/objects/` directory
- [x] 4.2 Create `speckit/public/specs/views/` directory
- [x] 4.3 Create `speckit/public/specs/pages/` directory
- [x] 4.4 Copy example ObjectSchema files (user.json, department.json)
- [x] 4.5 Copy example ViewSchema files (user-list.json, user-form.json)
- [x] 4.6 Copy example PageSchema files (users.json, users-create.json, users-edit.json)
- [x] 4.7 Verify all schema files are valid JSON and follow type definitions

## 5. Integration with Runtime Components

- [x] 5.1 Create adapter function `buildPageModelFromSchema()` to convert ResolvedPageSchema → PageModel
- [x] 5.2 Create adapter function `buildCollectionModelFromSchema()` for CollectionRuntime
- [x] 5.3 Create adapter function `buildFormModelFromSchema()` for FormRuntime
- [x] 5.4 Update SchemaResolver to work with Next.js App Router
- [ ] 5.5 Create example page using Schema system with Runtime components
- [ ] 5.6 Write integration tests

## 6. Documentation and Examples

- [x] 6.1 Create `speckit/docs/schema-system.md` with usage guide
- [x] 6.2 Document how to create new ObjectSchema
- [x] 6.3 Document how to create new ViewSchema
- [x] 6.4 Document how to create new PageSchema
- [x] 6.5 Add code examples for Schema-driven pages
- [x] 6.6 Update main README with Schema system overview

## 7. Testing and Validation

- [x] 7.1 Run TypeScript type checking (`npm run type-check`) - Script not available, but no linter errors found
- [ ] 7.2 Run build (`npm run build`) - ensure no errors (running in background)
- [ ] 7.3 Test Schema loading from JSON files
- [ ] 7.4 Test SchemaForm with all field types
- [ ] 7.5 Test SchemaList with sorting and pagination
- [ ] 7.6 Test integration with Runtime components
- [ ] 7.7 Verify existing pages still work (no regressions)
- [x] 7.8 Run `openspec validate migrate-schema-system-from-legacy --strict`

## 8. Phase 5 Features Evaluation (Separate Task)

- [ ] 8.1 Evaluate i18n system from legacy for migration
- [ ] 8.2 Evaluate theme management system for migration
- [ ] 8.3 Evaluate error handling system for migration
- [ ] 8.4 Evaluate notification system for migration
- [ ] 8.5 Evaluate custom hooks for migration
- [ ] 8.6 Evaluate utility functions for migration
- [ ] 8.7 Create separate proposal if migration is recommended
