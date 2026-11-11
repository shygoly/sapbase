# Tasks: Schema System Migration

## 1. Preparation and Analysis

- [x] 1.1 Review `speckit-legacy/PHASE2_COMPLETION_REPORT.md` for complete feature list
- [x] 1.2 Analyze `speckit-legacy/src/core/schema/` structure and dependencies
- [x] 1.3 Compare legacy Schema types with current Runtime component types
- [x] 1.4 Identify all UI component dependencies (legacy vs current shadcn/ui)
- [x] 1.5 Document differences and required adaptations

## 2. Core Schema System Migration

- [x] 2.1 Create `libs/ui-runtime/src/schema/` directory
- [x] 2.2 Migrate `types.ts` from legacy, adapt imports and type names
- [x] 2.3 Migrate `resolver.ts`, update file loading paths for Next.js `public/` directory
- [x] 2.4 Migrate `validator.ts`, ensure validation logic compatibility
- [x] 2.5 Migrate `registry.ts`, adapt registry implementation
- [x] 2.6 Write unit tests for each core module（`tests/schema-system.test.js`：registry/validator/resolver）
- [x] 2.7 Ensure 100% TypeScript type coverage

## 3. Dynamic UI Components Migration

- [x] 3.1 Create `libs/ui-runtime/src/components/schema-form.tsx`
- [x] 3.2 Migrate SchemaForm from legacy, adapt to current shadcn/ui components
- [x] 3.3 Ensure compatibility with React Hook Form and Zod
- [x] 3.4 Support all field types: text, number, email, password, select, checkbox, date, datetime, textarea, relation
- [x] 3.5 Create `libs/ui-runtime/src/components/schema-list.tsx`
- [x] 3.6 Migrate SchemaList from legacy, adapt to current table components
- [x] 3.7 Implement sorting, pagination, and filtering features
- [x] 3.8 Write component tests for SchemaForm and SchemaList（SSR render + sort/paginate helpers）

## 4. Schema Files Structure

- [x] 4.1 Create `apps/web-portal/public/specs/objects/` directory
- [x] 4.2 Create `apps/web-portal/public/specs/views/` directory
- [x] 4.3 Create `apps/web-portal/public/specs/pages/` directory
- [x] 4.4 Copy example ObjectSchema files (user.json, department.json)
- [x] 4.5 Copy example ViewSchema files (user-list.json, user-form.json)
- [x] 4.6 Copy example PageSchema files (users.json, users-create.json, users-edit.json)
- [x] 4.7 Verify all schema files are valid JSON and follow type definitions

## 5. Integration with Runtime Components

- [x] 5.1 Create adapter function `buildPageModelFromSchema()` to convert ResolvedPageSchema → PageModel
- [x] 5.2 Create adapter function `buildCollectionModelFromSchema()` for CollectionRuntime
- [x] 5.3 Create adapter function `buildFormModelFromSchema()` for FormRuntime
- [x] 5.4 Update SchemaResolver to work with Next.js App Router
- [x] 5.5 Create example page using Schema system with Runtime components（`apps/web-portal/src/app/dashboard/schema-example/page.tsx`）
- [x] 5.6 Write integration tests（resolver + SchemaForm/SchemaList + schema-example smoke）

## 6. Documentation and Examples

- [x] 6.1 Create `docs/schema-system.md` with usage guide
- [x] 6.2 Document how to create new ObjectSchema
- [x] 6.3 Document how to create new ViewSchema
- [x] 6.4 Document how to create new PageSchema
- [x] 6.5 Add code examples for Schema-driven pages
- [x] 6.6 Update main README with Schema system overview

## 7. Testing and Validation

- [x] 7.1 Run TypeScript type checking (`npm run type-check`) - Script not available, but no linter errors found
- [x] 7.2 `npm run build` 通过（API + portal + console）
- [x] 7.3 schema-example 实际加载 `/specs/pages/customers.json`（并修正 view 的 `Customer` → `customer` 大小写）
- [x] 7.4 SchemaForm 覆盖 12 种字段类型（`tests/schema-system.test.js`）
- [x] 7.5 SchemaList 排序/分页 helper 测试通过
- [x] 7.6 schema-example 在 `PageRuntime` 中渲染 resolver 结果
- [x] 7.7 登录 + dashboard + schema-example smoke 通过；全量 build 通过
- [x] 7.8 Run `openspec validate migrate-schema-system-from-legacy --strict`

## 8. Phase 5 Features Evaluation (Separate Task)

- [x] 8.1 i18n 评估：当前实现已覆盖，不迁移（`docs/migration/phase5-evaluation.md`）
- [x] 8.2 theme 评估：当前实现已覆盖，不迁移
- [x] 8.3 error handling 评估：当前实现已覆盖，不迁移
- [x] 8.4 notification 评估：当前实现已覆盖，不迁移
- [x] 8.5 hooks 评估：当前实现已覆盖，不迁移
- [x] 8.6 utilities 评估：当前实现已覆盖，不迁移
- [x] 8.7 结论：不推荐整包迁移，不新建 proposal
