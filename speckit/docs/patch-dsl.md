# Patch DSL System Documentation

## Overview

The Patch DSL (Domain-Specific Language) system enables **declarative, validated, versioned, and hot-reloadable** modifications to schemas without direct code changes. This transforms AI from a "code generator" into a "configuration compiler" that operates within safe boundaries.

## Key Principles

1. **Patch is not code** - Patches are JSON documents, never TypeScript/JSX
2. **High-level semantics** - Patches describe business objects, pages, permissions, not implementation details
3. **Safety first** - All patches are validated before execution
4. **Versioned** - Every patch creates a new schema version with rollback capability
5. **Hot-reloadable** - Schema changes take effect immediately without rebuilds

## Patch DSL Structure

### Top-Level Patch Document

```typescript
interface Patch {
  version: string              // "1.0"
  patchId: string             // UUID
  timestamp: string           // ISO-8601
  actor: "ai" | "human"       // Who generated it
  scope: PatchScope           // page | object | permission | state | menu
  operation: PatchOperation   // add | update | remove | reorder | replace
  target: PatchTarget         // What to modify
  payload: PatchPayload       // Modification details
  securityLevel?: SecurityLevel // L1 | L2 | L3 (auto-assigned)
  dependsOn?: string[]        // Optional: Dependencies on other patches
  description?: string        // Optional: Human-readable description
}
```

## Patch Scopes

### 1. Page Scope (`scope: "page"`)

Modifies page structure (columns, actions, metadata).

**Example: Add column to page**
```json
{
  "version": "1.0",
  "patchId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-02-16T10:00:00.000Z",
  "actor": "ai",
  "scope": "page",
  "operation": "add",
  "target": {
    "type": "field",
    "identifier": "UserList"
  },
  "payload": {
    "field": {
      "name": "department",
      "label": "Department",
      "component": "TextColumn",
      "sortable": true,
      "filterable": true
    }
  }
}
```

### 2. Object Scope (`scope: "object"`)

Modifies object schemas (forms, fields, relations, states).

**Example: Add field to object**
```json
{
  "version": "1.0",
  "patchId": "550e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2026-02-16T10:05:00.000Z",
  "actor": "ai",
  "scope": "object",
  "operation": "add",
  "target": {
    "type": "field",
    "identifier": "User"
  },
  "payload": {
    "field": {
      "name": "lastLogin",
      "label": "Last Login",
      "type": "datetime",
      "required": false,
      "readonly": true
    }
  }
}
```

### 3. Permission Scope (`scope: "permission"`)

Modifies permission rules for roles and actions.

**Example: Update role permissions**
```json
{
  "version": "1.0",
  "patchId": "550e8400-e29b-41d4-a716-446655440002",
  "timestamp": "2026-02-16T10:10:00.000Z",
  "actor": "human",
  "scope": "permission",
  "operation": "update",
  "target": {
    "type": "role",
    "identifier": "sales"
  },
  "payload": {
    "allow": ["view", "submit"],
    "deny": ["approve"],
    "permissions": {
      "view": ["sales", "admin"],
      "create": ["sales"],
      "edit": ["sales"],
      "delete": []
    }
  }
}
```

### 4. State Scope (`scope: "state"`)

Modifies state machine definitions.

**Example: Add state to state machine**
```json
{
  "version": "1.0",
  "patchId": "550e8400-e29b-41d4-a716-446655440003",
  "timestamp": "2026-02-16T10:15:00.000Z",
  "actor": "ai",
  "scope": "state",
  "operation": "add",
  "target": {
    "type": "state",
    "identifier": "Order"
  },
  "payload": {
    "state": {
      "name": "archived",
      "transitions": ["view"],
      "initial": false
    }
  }
}
```

### 5. Menu Scope (`scope: "menu"`)

Modifies navigation/menu structure.

**Example: Add menu item**
```json
{
  "version": "1.0",
  "patchId": "550e8400-e29b-41d4-a716-446655440004",
  "timestamp": "2026-02-16T10:20:00.000Z",
  "actor": "human",
  "scope": "menu",
  "operation": "add",
  "target": {
    "type": "menu",
    "identifier": "main"
  },
  "payload": {
    "item": {
      "label": "Reports",
      "path": "/reports",
      "icon": "BarChart",
      "order": 5,
      "permissions": ["admin", "manager"]
    }
  }
}
```

## Patch Operations

- **`add`** - Add new element (field, action, state, etc.)
- **`update`** - Modify existing element
- **`remove`** - Remove element
- **`reorder`** - Change order/sequence
- **`replace`** - Replace entire element

## Security Levels

The validator automatically assigns security levels based on operation type and scope:

- **L1 (Auto-execute)**: Safe operations like adding fields, updating labels
- **L2 (Require confirmation)**: Operations affecting permissions, changing field types
- **L3 (Blocked)**: Dangerous operations like modifying auth logic, deleting system objects

## Validation Rules

The validator enforces these safety rules:

1. **System Field Protection**: Cannot delete/modify core fields (id, createdAt, updatedAt)
2. **Permission Escalation Prevention**: Cannot grant permissions exceeding actor's permissions
3. **Component Registry Check**: All components must exist in component registry
4. **Reference Integrity**: All references (object names, view names) must exist
5. **Type Safety**: Field types must be valid FieldType values
6. **Schema Structure**: Patches must maintain valid schema structure

## Usage

### Basic Usage

```typescript
import { PatchManager } from '@/core/patch'
import { SchemaResolver } from '@/core/schema/resolver'
import { SchemaRegistry } from '@/core/schema/registry'

// Initialize
const schemaResolver = new SchemaResolver()
const schemaRegistry = new SchemaRegistry()
const patchManager = new PatchManager(schemaResolver, schemaRegistry)

// Apply a patch
const result = await patchManager.applyPatch(patch, actorPermissions)

if (result.success) {
  console.log('Patch applied successfully!')
  console.log('New schema version:', result.schemaVersion)
} else {
  console.error('Patch failed:', result.errors)
}
```

### Dry Run

```typescript
// Preview changes without applying
const dryRunResult = await patchManager.dryRun(patch, actorPermissions)

console.log('Valid:', dryRunResult.valid)
console.log('Changes:', dryRunResult.changes)
console.log('Security Level:', dryRunResult.securityLevel)
```

### Batch Patches

```typescript
// Apply multiple patches atomically
const batchResult = await patchManager.applyBatchPatches(
  [patch1, patch2, patch3],
  actorPermissions
)

if (batchResult.success) {
  console.log('All patches applied successfully!')
} else {
  console.error('Batch failed:', batchResult.errors)
  // All patches are rolled back automatically
}
```

### Version Control

```typescript
// Get version history
const history = patchManager.getVersionHistory('User')
console.log('Versions:', history)

// Rollback to previous version
const rollbackResult = patchManager.rollback('User', 5)
if (rollbackResult.success) {
  console.log('Rolled back to version 5')
}
```

### Hot Reloading

```typescript
import { useHotReload } from '@/core/patch/hooks'

function MyComponent() {
  const patchManager = usePatchManager() // Your hook to get patch manager
  const reloadKey = useHotReload(patchManager)
  
  // Component will automatically re-render when schemas are reloaded
  return <div key={reloadKey}>...</div>
}
```

### React Hooks

```typescript
import { usePatchApplication, usePatchDryRun } from '@/core/patch/hooks'

function PatchForm() {
  const { applyPatch, isApplying, error } = usePatchApplication(patchManager)
  const { dryRun, isDryRunning, result } = usePatchDryRun(patchManager)

  const handleApply = async () => {
    const result = await applyPatch(patch, actorPermissions)
    if (result?.success) {
      console.log('Patch applied!')
    }
  }

  return (
    <div>
      <button onClick={handleApply} disabled={isApplying}>
        Apply Patch
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  )
}
```

## AI Integration

### Patch Gateway

```typescript
import { PatchGateway } from '@/core/patch/gateway'

const gateway = new PatchGateway(patchManager)

// Generate patch from natural language
const response = await gateway.generatePatch({
  intent: "Add a lastLogin field to the User object",
  context: {
    targetSchema: "User",
    constraints: ["Field should be readonly", "Type should be datetime"]
  }
})

console.log('Generated patch:', response.patch)
console.log('Explanation:', response.explanation)
console.log('Security Level:', response.securityLevel)
```

### Patch Helpers

```typescript
import { PatchHelpers } from '@/core/patch/gateway'

// Create common patches easily
const addFieldPatch = PatchHelpers.createAddFieldPatch(
  'User',
  'lastLogin',
  'datetime',
  { readonly: true }
)

const permissionPatch = PatchHelpers.createPermissionPatch(
  'sales',
  ['view', 'submit'],
  ['approve']
)
```

## Audit Logging

```typescript
// Query audit logs
const logs = patchManager.getAuditLogs({
  actor: 'ai',
  scope: 'object',
  operation: 'add',
  startDate: '2026-02-01',
  endDate: '2026-02-28'
})

console.log('Audit logs:', logs)
```

## File Structure

```
speckit/
├── src/
│   └── core/
│       └── patch/
│           ├── types.ts              # Type definitions
│           ├── validator.ts          # Validation logic
│           ├── executor.ts          # Patch execution
│           ├── version-control.ts    # Version management
│           ├── hot-reload.ts        # Hot reloading
│           ├── audit-logger.ts       # Audit logging
│           ├── patch-manager.ts      # Main orchestrator
│           ├── gateway.ts            # AI Gateway
│           ├── storage.ts            # Storage utilities
│           ├── hooks.ts              # React hooks
│           └── index.ts              # Exports
├── public/
│   └── patches/
│       ├── examples/                 # Example patches
│       └── audit/                    # Audit logs
└── specs/
    └── versions/                     # Versioned schemas
```

## Examples

See `speckit/public/patches/examples/` for complete example patches:
- `add-field-example.json` - Adding a field to an object
- `update-permission-example.json` - Updating role permissions
- `add-page-field-example.json` - Adding a column to a page
- `add-state-example.json` - Adding a state to a state machine
- `add-menu-item-example.json` - Adding a menu item

## Best Practices

1. **Always validate before applying** - Use `dryRun()` to preview changes
2. **Use batch patches for related changes** - Ensures atomicity
3. **Check security levels** - L2 patches require user confirmation
4. **Version your patches** - Use `dependsOn` for patch dependencies
5. **Monitor audit logs** - Track all patch operations
6. **Test rollback** - Ensure you can rollback if needed

## Limitations

- Patches modify schema JSON files only - no code generation
- File writes require server-side API routes (Next.js limitation)
- Hot reloading works in-memory - requires API for persistence
- Batch patches are atomic but rollback is manual (future enhancement)

## Future Enhancements

- Automatic reverse patches for rollback
- Conditional patch execution
- Patch templates and macros
- Visual patch editor
- Patch conflict resolution
- Real-time collaboration
