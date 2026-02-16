# Design: Schema System Migration from Legacy

## Context

The `speckit-legacy` directory contains a complete Phase 2 implementation of a Schema-driven system that was built but never migrated to the current `speckit` version. The current version has Runtime components (PageRuntime, FormRuntime, CollectionRuntime) that enforce Runtime-First architecture but lack the Schema system that enables automatic UI generation.

## Goals / Non-Goals

### Goals
- Migrate core Schema system (ObjectSchema, ViewSchema, PageSchema) from legacy
- Enable Schema-driven form and list generation
- Integrate Schema system with existing Runtime components
- Maintain type safety and architectural consistency
- Preserve all existing functionality

### Non-Goals
- Not migrating Phase 5 features in this change (evaluate separately)
- Not changing existing Runtime component APIs
- Not breaking existing page implementations
- Not implementing new Schema features beyond what exists in legacy

## Architecture Decisions

### Decision 1: Three-Layer Schema Architecture
**What**: Maintain the three-layer architecture from legacy:
- Layer 1: ObjectSchema (data structure)
- Layer 2: ViewSchema (UI layout)
- Layer 3: PageSchema (routing and metadata)

**Why**: This separation allows:
- Reusing ObjectSchema across multiple views
- Different layouts for the same data
- Centralized routing and permission management

**Alternatives considered**:
- Single-layer schema: Too rigid, doesn't support multiple views per object
- Two-layer schema: Missing routing/metadata layer

### Decision 2: JSON Schema Files in `public/specs/`
**What**: Store Schema definitions as JSON files in `public/specs/objects/`, `views/`, `pages/`

**Why**: 
- Enables AI to read and generate schemas
- Version control friendly
- Can be loaded at runtime
- Easy to modify without code changes

**Alternatives considered**:
- TypeScript files: Harder for AI to parse, requires compilation
- Database storage: Overkill for static schemas, adds complexity

### Decision 3: Integration with Runtime Components
**What**: Schema system integrates with existing Runtime components rather than replacing them

**Why**:
- Runtime components provide permission checking and consistent structure
- Schema system provides dynamic generation capability
- Together they enable both manual and AI-generated pages

**Integration pattern**:
```tsx
// Schema-driven page
const resolvedSchema = await schemaResolver.resolvePage('users')
const pageModel = buildPageModelFromSchema(resolvedSchema)

<PageRuntime model={pageModel}>
  <CollectionRuntime model={collectionModel}>
    <SchemaList schema={objectSchema} data={users} />
  </CollectionRuntime>
</PageRuntime>
```

### Decision 4: TypeScript Types from Legacy
**What**: Migrate type definitions as-is from legacy, with minor adaptations for current codebase

**Why**: Legacy types are well-designed and tested. Only adapt:
- Import paths
- Integration with current Runtime component types
- Compatibility with current shadcn/ui components

## Migration Strategy

### Phase 1: Core Schema System
1. Copy `core/schema/types.ts` → adapt imports
2. Copy `core/schema/resolver.ts` → adapt file loading paths
3. Copy `core/schema/validator.ts` → adapt validation logic
4. Copy `core/schema/registry.ts` → adapt registry implementation

### Phase 2: Dynamic Components
1. Copy `components/schema-form.tsx` → adapt to use current shadcn/ui components
2. Copy `components/schema-list.tsx` → adapt to use current table components
3. Ensure compatibility with React Hook Form and Zod

### Phase 3: Schema Files
1. Copy example schemas from `speckit-legacy/public/specs/`
2. Adapt to current project structure
3. Create migration guide for creating new schemas

### Phase 4: Integration
1. Create adapter functions to convert Schema → Runtime Model
2. Update existing pages to optionally use Schema system
3. Add examples and documentation

## Risks / Trade-offs

### Risk 1: Type Incompatibility
**Risk**: Legacy types may not match current Runtime component types
**Mitigation**: Create adapter layer, maintain both type systems during transition

### Risk 2: Component Library Differences
**Risk**: Legacy uses different UI components than current shadcn/ui
**Mitigation**: Adapt SchemaForm/SchemaList to use current components, test thoroughly

### Risk 3: File Loading Paths
**Risk**: Legacy uses different paths for loading schema files
**Mitigation**: Update resolver to use Next.js `public/` directory correctly

### Risk 4: Performance Impact
**Risk**: Loading schemas at runtime may impact performance
**Mitigation**: Use caching in SchemaResolver, consider build-time schema loading

## Migration Plan

### Step 1: Preparation
- Review legacy code thoroughly
- Identify all dependencies
- Create test cases for Schema system

### Step 2: Core Migration
- Migrate types, resolver, validator, registry
- Write unit tests
- Ensure type safety

### Step 3: Component Migration
- Migrate SchemaForm and SchemaList
- Adapt to current UI components
- Write integration tests

### Step 4: Schema Files Migration
- Copy example schemas
- Create documentation
- Add examples

### Step 5: Integration
- Create adapter functions
- Update documentation
- Add migration guide

### Rollback Plan
- Keep legacy code until migration verified
- Use feature flags to enable/disable Schema system
- Maintain backward compatibility

## Open Questions

1. Should we migrate Phase 5 features (i18n, theme, etc.) in a separate change?
   - **Answer**: Yes, evaluate separately after Schema migration

2. Should Schema system be optional or required?
   - **Answer**: Optional - existing pages continue to work without schemas

3. How to handle schema versioning?
   - **Answer**: Use version field in schemas, resolver handles version compatibility

4. Should schemas be editable via UI?
   - **Answer**: Out of scope for this change, future enhancement
