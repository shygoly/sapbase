# Change: Migrate Schema-Driven System from Legacy Version

## Why

The `speckit-legacy` directory contains a fully implemented Schema-driven page/form/view generation system (Phase 2) that enables AI-driven UI generation from JSON schemas. The current `speckit` version has Runtime components (PageRuntime, FormRuntime, CollectionRuntime) but lacks the Schema system that allows automatic generation of forms and lists from schema definitions. This migration will enable the core value proposition: "Allow AI to generate pages, forms, and views based on Schema."

Additionally, `speckit-legacy` contains valuable Phase 5 features (i18n, theme management, error handling, notifications, custom hooks, utilities) that should be evaluated and migrated if beneficial.

## What Changes

- **ADDED**: Schema system core modules (types, resolver, validator, registry)
- **ADDED**: SchemaForm component for dynamic form generation from ObjectSchema
- **ADDED**: SchemaList component for dynamic list generation from ObjectSchema
- **ADDED**: Three-layer Schema architecture (ObjectSchema → ViewSchema → PageSchema)
- **ADDED**: Schema definition files structure (`public/specs/objects/`, `views/`, `pages/`)
- **ADDED**: Integration with existing Runtime components (PageRuntime, FormRuntime, CollectionRuntime)
- **EVALUATE**: Phase 5 features (i18n, theme, error handling, notifications, hooks, utilities) for potential migration

## Impact

- **Affected specs**: New capability `schema-driven-generation`
- **Affected code**: 
  - `speckit/src/core/schema/` (new directory)
  - `speckit/src/components/schema-form.tsx` (new component)
  - `speckit/src/components/schema-list.tsx` (new component)
  - `speckit/public/specs/` (new directory structure)
  - Existing Runtime components (integration points)
- **Breaking changes**: None (additive only)

## Migration Source

- **Source**: `speckit-legacy/src/core/schema/` → `speckit/src/core/schema/`
- **Source**: `speckit-legacy/src/components/schema-form.tsx` → `speckit/src/components/schema-form.tsx`
- **Source**: `speckit-legacy/src/components/schema-list.tsx` → `speckit/src/components/schema-list.tsx`
- **Source**: `speckit-legacy/public/specs/` → `speckit/public/specs/`

## Success Criteria

- ✅ Schema system can load ObjectSchema, ViewSchema, and PageSchema from JSON files
- ✅ SchemaForm can generate forms from ObjectSchema definitions
- ✅ SchemaList can generate lists from ObjectSchema definitions
- ✅ Schema system integrates with existing Runtime components
- ✅ Type safety maintained (100% TypeScript coverage)
- ✅ All existing functionality continues to work
- ✅ Documentation updated with Schema usage examples
