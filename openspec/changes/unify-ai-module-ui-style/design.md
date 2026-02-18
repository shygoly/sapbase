# UI Style Unification Design

## Problem Statement

AI-generated modules (CRM) currently use different UI components and styling compared to standard system modules, creating visual inconsistency and maintenance burden.

## Current State Analysis

### Standard Modules (Users, Departments, Roles)

**Table Container:**
```tsx
<div className="space-y-4 rounded-lg border border-gray-200 bg-white">
  <div className="overflow-x-auto">
    <Table>...</Table>
  </div>
  {/* Pagination */}
</div>
```

**Pagination:**
```tsx
<div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
  <div className="text-sm text-gray-600">
    Showing X to Y of Z
  </div>
  <div className="flex gap-2">
    <Button variant="outline" size="sm">Previous</Button>
    {/* Page numbers */}
    <Button variant="outline" size="sm">Next</Button>
  </div>
</div>
```

**Action Buttons:**
```tsx
<Button variant="ghost" size="sm">
  <Edit2 className="h-4 w-4" />
</Button>
<Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
  <Trash2 className="h-4 w-4" />
</Button>
```

### CRM Module (Current - Inconsistent)

**Table Container:**
```tsx
<div className="space-y-4">
  <div className="rounded-md border">
    <Table>...</Table>
  </div>
  {/* Different pagination */}
</div>
```

**Pagination:**
- Uses `Pagination` component from `@/components/ui/pagination`
- More complex UI with ellipsis
- Different styling

**Action Buttons:**
```tsx
<Button variant="outline" size="sm">Edit</Button>
<Button variant="destructive" size="sm">Delete</Button>
```

## Design Solution

### Unified UI Pattern

All list components (both standard and AI-generated) should follow this pattern:

1. **Container**: `rounded-lg border border-gray-200 bg-white` with `space-y-4`
2. **Table Wrapper**: `overflow-x-auto` for horizontal scrolling
3. **Pagination**: Simple Previous/Next pattern with page info
4. **Actions**: Icon buttons with consistent styling
5. **Empty State**: Centered text with consistent styling

### Component Updates

**SchemaList Component:**
- Update wrapper div styling
- Replace `Pagination` component with standard pagination pattern
- Update action buttons to use icons
- Ensure consistent spacing

**Benefits:**
- Visual consistency across all modules
- Easier maintenance (single pattern)
- Better user experience
- Clear guidelines for future AI-generated modules

## Trade-offs

**Pros:**
- Consistent user experience
- Easier to maintain
- Clear patterns for developers
- Better design system adherence

**Cons:**
- Requires updating existing CRM module
- May lose some advanced pagination features (ellipsis)
- Need to ensure SchemaList remains flexible for different use cases

## Implementation Approach

1. Update `SchemaList` component to accept styling props or use standard styles
2. Create a shared pagination component/pattern
3. Update CRM module pages to use updated components
4. Document patterns for future AI module generation
