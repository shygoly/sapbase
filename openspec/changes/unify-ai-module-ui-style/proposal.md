# Change: Unify AI-Generated Module UI Style

## Why

Currently, AI-generated modules (like CRM) use different UI components and styling compared to the standard system modules (Users, Departments, Roles). This inconsistency creates:

1. **Poor user experience**: Users see different interfaces for similar functionality
2. **Maintenance burden**: Different components need separate maintenance
3. **Design inconsistency**: Violates design system principles
4. **Developer confusion**: Unclear which components to use for new modules

All AI-generated modules should follow the same UI patterns, components, and styling as the existing system modules to ensure consistency and maintainability.

## What Changes

- **MODIFIED**: `SchemaList` component to match standard list component styling
- **MODIFIED**: CRM module pages to use consistent UI patterns
- **ADDED**: UI style guidelines for AI-generated modules
- **MODIFIED**: Pagination component usage to match standard modules
- **MODIFIED**: Action buttons styling to match standard modules (icon buttons instead of text buttons)
- **MODIFIED**: Table wrapper styling to match standard modules

## Impact

- **Affected specs**: 
  - Modified capability: `crm-module` (UI consistency)
  - Modified capability: `patch-dsl-system` (UI generation guidelines)
- **Affected code**:
  - `speckit/src/components/schema-list.tsx` - Update to match standard styling
  - `speckit/src/app/crm/**` - Update CRM pages to use consistent components
  - Future AI-generated modules will follow these patterns
- **Breaking changes**: None (visual only, functionality preserved)

## Design Decisions

### Standard UI Patterns (Current System Modules)

1. **Table Container**: `rounded-lg border border-gray-200 bg-white`
2. **Pagination**: Simple Previous/Next buttons with page info, styled with `border-t border-gray-200 px-6 py-4`
3. **Action Buttons**: Icon buttons (`Edit2`, `Trash2` from lucide-react) with `variant="ghost" size="sm"`
4. **Empty State**: Centered text with `text-center py-8 text-gray-500`
5. **Badge Colors**: Consistent status color mapping
6. **Page Structure**: Use `PageRuntime` and `CollectionRuntime` wrappers

### Changes Required

1. Update `SchemaList` to use standard pagination pattern (not `Pagination` component)
2. Update `SchemaList` table wrapper styling to match standard modules
3. Update action buttons in `SchemaList` to use icon buttons
4. Ensure all CRM pages follow the same patterns

## Success Criteria

- ✅ `SchemaList` component matches standard list component styling
- ✅ CRM module pages have consistent UI with Users/Departments/Roles pages
- ✅ Pagination uses the same pattern across all modules
- ✅ Action buttons use consistent icon-based design
- ✅ Table containers have consistent styling
- ✅ All future AI-generated modules will follow these patterns

## Implementation Status

- [ ] Update `SchemaList` component styling
- [ ] Update `SchemaList` pagination to match standard pattern
- [ ] Update `SchemaList` action buttons to use icons
- [ ] Verify CRM module pages match standard modules
- [ ] Document UI style guidelines for AI module generation
