# Design: Patch DSL System for Declarative Schema Modifications

## Context

The current Schema system allows loading schemas from JSON files, but modifications require direct file editing or code changes. This creates several problems:

1. **Safety**: No validation before changes are applied
2. **Auditability**: No way to track who changed what and when
3. **Rollback**: No easy way to undo changes
4. **Hot Reloading**: Changes require rebuilds
5. **AI Control**: AI cannot safely modify the system

The Patch DSL system solves these by introducing a declarative, validated, versioned patch system.

## Goals / Non-Goals

### Goals
- Enable declarative modifications to schemas (never direct code changes)
- Provide validation layer that prevents unsafe operations
- Support versioning and rollback of all changes
- Enable hot reloading of schema changes
- Create AI-safe interface for system modifications
- Maintain complete audit trail
- Support security levels for different operation types

### Non-Goals
- Not replacing the Schema system (patches modify schemas)
- Not allowing direct code generation or file writing
- Not supporting arbitrary code execution
- Not replacing Git version control (complements it)

## Architecture Decisions

### Decision 1: Patch DSL as JSON Schema
**What**: Patches are JSON documents conforming to a strict schema

**Why**:
- Machine-readable and validatable
- Easy for AI to generate correctly
- Can be version controlled
- Supports validation before execution

**Alternatives considered**:
- YAML: Less common, harder for AI to generate correctly
- TypeScript: Requires compilation, harder to validate
- Custom DSL: Too complex, harder to maintain

### Decision 2: Five Patch Scopes
**What**: Support five distinct patch scopes:
- `page` - Page structure modifications
- `object` - Object schema modifications (forms, fields)
- `permission` - Permission rule modifications
- `state` - State machine modifications
- `menu` - Navigation/menu modifications

**Why**: Each scope has different validation rules and execution logic. Separation allows:
- Scope-specific validation
- Different security levels per scope
- Clearer intent and semantics

**Alternatives considered**:
- Single scope: Too generic, loses type safety
- More scopes: Over-engineering, can add later

### Decision 3: Operation Types
**What**: Support five operations:
- `add` - Add new element
- `update` - Modify existing element
- `remove` - Remove element
- `reorder` - Change order/sequence
- `replace` - Replace entire element

**Why**: Covers all common modification patterns while maintaining clarity

### Decision 4: Three-Tier Security Levels
**What**: 
- **L1 (Auto-execute)**: Safe operations like adding fields
- **L2 (Require confirmation)**: Operations affecting permissions or structure
- **L3 (Blocked)**: Dangerous operations like modifying auth logic

**Why**: Provides safety while allowing automation for safe operations

**Implementation**: Validator checks operation type and scope, assigns security level

### Decision 5: Version Control System
**What**: Each patch generates a new schema version with:
- Version number (incremental)
- Previous version reference
- Patch ID (UUID)
- Timestamp
- Actor (AI or human)

**Why**: Enables rollback, audit trail, and version comparison

**Storage**: Patches stored in `public/patches/` directory, versioned schemas in `public/specs/versions/`

### Decision 6: Hot Reloading via Schema Refresh
**What**: When patch is applied, update in-memory schema cache and trigger React re-render

**Why**: 
- Next.js App Router supports dynamic imports
- SchemaResolver already has caching
- Can invalidate cache and reload schemas

**Implementation**:
- Patch executor updates schema files
- Invalidates SchemaResolver cache
- Triggers React component re-render via state update
- No rebuild required

### Decision 7: Validator Rules Engine
**What**: Validator enforces rules like:
- Cannot delete system core fields (id, createdAt, etc.)
- Cannot grant permissions exceeding actor's permissions
- Components must exist in registry
- Field types must be valid
- References must exist

**Why**: Prevents invalid or dangerous patches from being applied

**Implementation**: Rule-based validator with extensible rule set

### Decision 8: Patch Executor (No Code Generation)
**What**: Executor modifies schema JSON files directly, never generates code

**Why**:
- Maintains single source of truth (schema files)
- No code generation means no compilation errors
- Changes are declarative and reversible

**Implementation**:
- Read current schema
- Apply patch operations
- Write updated schema
- Update version metadata

## Architecture Overview

```
┌─────────────┐
│     AI      │
└──────┬──────┘
       │ generate_patch()
       ▼
┌─────────────────┐
│  Patch Gateway  │
└──────┬──────────┘
       │ Patch JSON
       ▼
┌─────────────────┐
│   Validator     │ ◄─── Security Rules
│  (L1/L2/L3)    │
└──────┬──────────┘
       │ Validated Patch
       ▼
┌─────────────────┐
│    Executor     │
│  (Dry Run?)    │
└──────┬──────────┘
       │ Apply Patch
       ▼
┌─────────────────┐
│ Version Control │ ◄─── Version + Audit
└──────┬──────────┘
       │ Updated Schema
       ▼
┌─────────────────┐
│  Hot Reloader   │
│  (Cache Inval)  │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Schema Files   │
└─────────────────┘
```

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
}
```

### Patch Scopes and Payloads

**Page Scope**:
```typescript
{
  scope: "page",
  target: { type: "field", identifier: "UserList" },
  payload: {
    field: {
      name: "lastLogin",
      label: "Last Login",
      component: "DateColumn",
      sortable: true
    }
  }
}
```

**Object Scope**:
```typescript
{
  scope: "object",
  target: { type: "form", identifier: "User" },
  payload: {
    field: {
      name: "department",
      component: "Select",
      required: true,
      options: [...]
    }
  }
}
```

**Permission Scope**:
```typescript
{
  scope: "permission",
  target: { type: "role", identifier: "sales" },
  payload: {
    allow: ["view", "submit"],
    deny: ["approve"]
  }
}
```

## Validation Rules

### Core Safety Rules

1. **System Field Protection**: Cannot delete/modify core fields (id, createdAt, updatedAt)
2. **Permission Escalation Prevention**: Cannot grant permissions exceeding actor's permissions
3. **Component Registry Check**: All components must exist in component registry
4. **Reference Integrity**: All references (object names, view names) must exist
5. **Type Safety**: Field types must be valid FieldType values
6. **Schema Structure**: Patches must maintain valid schema structure

### Security Level Assignment

- **L1 (Auto-execute)**: Adding non-critical fields, updating labels, reordering
- **L2 (Require confirmation)**: Modifying permissions, changing field types, removing fields
- **L3 (Blocked)**: Modifying auth logic, deleting system objects, changing core structure

## Execution Flow

1. **Patch Generation**: AI/human generates patch JSON
2. **Validation**: Validator checks patch against rules
3. **Security Level Assignment**: Validator assigns security level
4. **Authorization Check**: 
   - L1: Auto-execute
   - L2: Require user confirmation
   - L3: Reject with error
5. **Dry Run** (optional): Preview changes without applying
6. **Execution**: Executor applies patch to schema files
7. **Versioning**: Create new schema version with patch metadata
8. **Hot Reload**: Invalidate cache and trigger re-render
9. **Audit Log**: Record patch application

## Hot Reloading Implementation

### Strategy
1. Patch executor updates schema JSON files
2. Calls `schemaResolver.clearCache()` or `clearCacheFor()`
3. Component using schema detects change via:
   - SWR revalidation
   - React Query invalidation
   - Manual state update trigger
4. Component re-fetches schema
5. UI updates automatically

### Next.js Integration
- Use SWR or React Query for schema fetching
- Configure revalidation on file change
- Or use file watcher to trigger invalidation

## Version Control

### Version Structure
```typescript
interface SchemaVersion {
  version: number              // Incremental: 1, 2, 3...
  previousVersion: number      // Reference to previous
  patchId: string             // UUID of applied patch
  timestamp: string
  actor: string
  schema: ObjectSchema | ViewSchema | PageSchema
}
```

### Rollback Mechanism
1. Load target version schema
2. Create reverse patch (if needed)
3. Apply reverse patch or restore schema directly
4. Update version metadata

## AI Tool Gateway Interface

### Interface Specification
```typescript
interface PatchGenerationRequest {
  intent: string              // Natural language description
  context: {
    currentSchema: SchemaSnapshot
    constraints: string[]
  }
}

interface PatchGenerationResponse {
  patch: Patch
  explanation: string
  securityLevel: SecurityLevel
  dryRunResult?: DryRunResult
}
```

### AI Integration Pattern
1. AI receives modification request
2. AI calls `generatePatch(intent, context)`
3. System returns validated patch
4. AI presents patch to user (for L2) or applies (for L1)
5. Patch is executed through normal flow

## Risks / Trade-offs

### Risk 1: Patch Complexity
**Risk**: Complex modifications may require multiple patches
**Mitigation**: Support batch patches, patch sequences, and patch dependencies

### Risk 2: Validation Gaps
**Risk**: Validator may miss edge cases
**Mitigation**: Comprehensive test suite, gradual rollout, manual review for L2/L3

### Risk 3: Performance Impact
**Risk**: Hot reloading may cause performance issues
**Mitigation**: Debounce reloads, optimize cache invalidation, use efficient diffing

### Risk 4: Schema File Conflicts
**Risk**: Concurrent patches may conflict
**Mitigation**: Lock mechanism, patch queue, conflict detection

## Migration Plan

### Phase 1: Core Infrastructure
1. Implement Patch DSL types
2. Implement validator with basic rules
3. Implement executor for single patches
4. Add version control system

### Phase 2: Hot Reloading
1. Integrate with SchemaResolver cache
2. Implement cache invalidation
3. Add React re-render triggers
4. Test hot reloading flow

### Phase 3: Security & Audit
1. Implement security levels
2. Add audit logging
3. Create rollback mechanism
4. Add conflict detection

### Phase 4: AI Integration
1. Create Patch Gateway interface
2. Implement patch generation helpers
3. Add dry-run capability
4. Create AI tool definitions

## Open Questions

1. Should patches support batch operations?
   - **Answer**: Yes, support arrays of patches for atomic operations

2. How to handle patch dependencies?
   - **Answer**: Support `dependsOn` field referencing other patch IDs

3. Should patches be reversible automatically?
   - **Answer**: Yes, generate reverse patches for add/update/remove operations

4. How to handle schema migrations?
   - **Answer**: Patches can include migration logic in payload

5. Should patches support conditional execution?
   - **Answer**: Future enhancement, not in v1.0
