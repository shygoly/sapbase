# Tasks: Patch DSL System Implementation

## 1. Core Patch DSL Types and Structure

- [x] 1.1 Create `speckit/src/core/patch/` directory
- [x] 1.2 Define Patch DSL type definitions (`types.ts`)
  - [x] Patch interface with all required fields
  - [x] PatchScope type (page, object, permission, state, menu)
  - [x] PatchOperation type (add, update, remove, reorder, replace)
  - [x] PatchTarget interface
  - [x] PatchPayload union types for each scope
  - [x] SecurityLevel type (L1, L2, L3)
- [ ] 1.3 Create JSON schema for Patch DSL validation
- [x] 1.4 Write TypeScript types with JSDoc documentation

## 2. Patch Validator Implementation

- [x] 2.1 Create `speckit/src/core/patch/validator.ts`
- [x] 2.2 Implement core safety rules:
  - [x] System field protection (id, createdAt, updatedAt)
  - [x] Permission escalation prevention
  - [x] Component registry validation
  - [x] Reference integrity checking
  - [x] Field type validation
  - [x] Schema structure validation
- [x] 2.3 Implement security level assignment logic
- [x] 2.4 Create rule engine with extensible rule set
- [ ] 2.5 Write unit tests for each validation rule
- [x] 2.6 Implement detailed error messages for validation failures

## 3. Patch Executor Implementation

- [x] 3.1 Create `speckit/src/core/patch/executor.ts`
- [x] 3.2 Implement executor for each operation type:
  - [x] `add` operation executor
  - [x] `update` operation executor
  - [x] `remove` operation executor
  - [x] `reorder` operation executor
  - [x] `replace` operation executor
- [x] 3.3 Implement scope-specific executors:
  - [x] Page scope executor
  - [x] Object scope executor
  - [x] Permission scope executor
  - [x] State scope executor
  - [x] Menu scope executor
- [x] 3.4 Ensure executor never generates code files
- [x] 3.5 Implement atomic file operations (read-modify-write)
- [ ] 3.6 Write unit tests for each executor

## 4. Version Control System

- [x] 4.1 Create `speckit/src/core/patch/version-control.ts`
- [x] 4.2 Implement version creation on patch application
- [x] 4.3 Implement version storage in `public/specs/versions/`
- [x] 4.4 Implement version metadata tracking (version number, previous version, patch ID, timestamp, actor)
- [x] 4.5 Implement rollback mechanism
- [x] 4.6 Implement version history querying
- [x] 4.7 Implement version comparison/diff functionality
- [ ] 4.8 Write tests for version control operations

## 5. Hot Reloading Integration

- [x] 5.1 Create `speckit/src/core/patch/hot-reload.ts`
- [x] 5.2 Integrate with SchemaResolver cache invalidation
- [x] 5.3 Implement cache invalidation triggers after patch execution
- [x] 5.4 Add React re-render triggers (SWR/React Query integration)
- [ ] 5.5 Test hot reloading with Next.js App Router
- [x] 5.6 Ensure no rebuild required for schema changes
- [x] 5.7 Add debouncing for rapid patch sequences

## 6. Audit Logging System

- [x] 6.1 Create `speckit/src/core/patch/audit-logger.ts`
- [x] 6.2 Implement audit log entry structure
- [x] 6.3 Implement persistent storage for audit logs (`public/patches/audit/`)
- [x] 6.4 Log all patch operations (ID, timestamp, actor, scope, operation, target, result)
- [x] 6.5 Implement audit log querying interface
- [x] 6.6 Add filtering by actor, scope, operation, date range
- [ ] 6.7 Write tests for audit logging

## 7. Patch Storage and Management

- [x] 7.1 Create `speckit/public/patches/` directory structure
- [x] 7.2 Implement patch file storage (one file per patch)
- [x] 7.3 Implement patch metadata indexing
- [x] 7.4 Create patch querying interface (by ID, date, actor, scope)
- [x] 7.5 Implement patch file naming convention

## 8. Batch Patch and Dependencies

- [x] 8.1 Extend executor to support batch patches
- [x] 8.2 Implement atomic batch execution (all succeed or all fail)
- [x] 8.3 Implement patch dependency resolution
- [x] 8.4 Add circular dependency detection
- [x] 8.5 Implement ordered execution for dependent patches
- [ ] 8.6 Write tests for batch operations

## 9. Dry Run Capability

- [x] 9.1 Extend executor to support dry-run mode
- [x] 9.2 Implement simulation of patch application
- [x] 9.3 Return preview of changes without modifying files
- [x] 9.4 Show validation results in dry-run
- [ ] 9.5 Write tests for dry-run functionality

## 10. AI Tool Gateway Interface

- [x] 10.1 Create `speckit/src/core/patch/gateway.ts`
- [x] 10.2 Define PatchGenerationRequest and PatchGenerationResponse interfaces
- [x] 10.3 Implement `generatePatch(intent, context)` function
- [ ] 10.4 Integrate with AI tool definitions
- [x] 10.5 Add patch generation helpers for common operations
- [ ] 10.6 Write documentation for AI integration

## 11. Integration with Existing Systems

- [x] 11.1 Integrate patch system with SchemaResolver
- [ ] 11.2 Update SchemaResolver to support versioned schemas
- [ ] 11.3 Integrate with Runtime components (PageRuntime, FormRuntime, CollectionRuntime)
- [x] 11.4 Ensure existing pages continue to work
- [x] 11.5 Add patch application hooks/triggers

## 12. Security and Authorization

- [x] 12.1 Implement security level enforcement (L1 auto, L2 confirm, L3 block)
- [x] 12.2 Add user confirmation flow for L2 patches
- [x] 12.3 Implement actor permission checking
- [ ] 12.4 Add rate limiting for patch operations
- [ ] 12.5 Write security tests

## 13. Documentation and Examples

- [x] 13.1 Create `speckit/docs/patch-dsl.md` with complete documentation
- [ ] 13.2 Document Patch DSL JSON schema
- [x] 13.3 Document all patch scopes and operations
- [x] 13.4 Create example patches for each scope
- [x] 13.5 Document validation rules
- [x] 13.6 Document security levels
- [x] 13.7 Create AI integration guide
- [x] 13.8 Update main README with Patch DSL overview

## 14. Testing and Validation

- [ ] 14.1 Write unit tests for Patch DSL types
- [ ] 14.2 Write unit tests for validator (all rules)
- [ ] 14.3 Write unit tests for executor (all operations and scopes)
- [ ] 14.4 Write unit tests for version control
- [ ] 14.5 Write unit tests for hot reloading
- [ ] 14.6 Write integration tests for complete patch flow
- [ ] 14.7 Test rollback functionality
- [ ] 14.8 Test batch patch operations
- [ ] 14.9 Test dry-run functionality
- [ ] 14.10 Run TypeScript type checking
- [ ] 14.11 Run build and ensure no errors
- [ ] 14.12 Run `openspec validate add-patch-dsl-system --strict`

## 15. Example Patches and Use Cases

- [x] 15.1 Create example patches for adding page field
- [x] 15.2 Create example patches for updating permissions
- [x] 15.3 Create example patches for modifying form structure
- [x] 15.4 Create example patches for state machine changes
- [x] 15.5 Create example patches for menu modifications
- [x] 15.6 Store examples in `speckit/public/patches/examples/`
