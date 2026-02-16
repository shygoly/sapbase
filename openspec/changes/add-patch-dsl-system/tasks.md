# Tasks: Patch DSL System Implementation

## 1. Core Patch DSL Types and Structure

- [ ] 1.1 Create `speckit/src/core/patch/` directory
- [ ] 1.2 Define Patch DSL type definitions (`types.ts`)
  - [ ] Patch interface with all required fields
  - [ ] PatchScope type (page, object, permission, state, menu)
  - [ ] PatchOperation type (add, update, remove, reorder, replace)
  - [ ] PatchTarget interface
  - [ ] PatchPayload union types for each scope
  - [ ] SecurityLevel type (L1, L2, L3)
- [ ] 1.3 Create JSON schema for Patch DSL validation
- [ ] 1.4 Write TypeScript types with JSDoc documentation

## 2. Patch Validator Implementation

- [ ] 2.1 Create `speckit/src/core/patch/validator.ts`
- [ ] 2.2 Implement core safety rules:
  - [ ] System field protection (id, createdAt, updatedAt)
  - [ ] Permission escalation prevention
  - [ ] Component registry validation
  - [ ] Reference integrity checking
  - [ ] Field type validation
  - [ ] Schema structure validation
- [ ] 2.3 Implement security level assignment logic
- [ ] 2.4 Create rule engine with extensible rule set
- [ ] 2.5 Write unit tests for each validation rule
- [ ] 2.6 Implement detailed error messages for validation failures

## 3. Patch Executor Implementation

- [ ] 3.1 Create `speckit/src/core/patch/executor.ts`
- [ ] 3.2 Implement executor for each operation type:
  - [ ] `add` operation executor
  - [ ] `update` operation executor
  - [ ] `remove` operation executor
  - [ ] `reorder` operation executor
  - [ ] `replace` operation executor
- [ ] 3.3 Implement scope-specific executors:
  - [ ] Page scope executor
  - [ ] Object scope executor
  - [ ] Permission scope executor
  - [ ] State scope executor
  - [ ] Menu scope executor
- [ ] 3.4 Ensure executor never generates code files
- [ ] 3.5 Implement atomic file operations (read-modify-write)
- [ ] 3.6 Write unit tests for each executor

## 4. Version Control System

- [ ] 4.1 Create `speckit/src/core/patch/version-control.ts`
- [ ] 4.2 Implement version creation on patch application
- [ ] 4.3 Implement version storage in `public/specs/versions/`
- [ ] 4.4 Implement version metadata tracking (version number, previous version, patch ID, timestamp, actor)
- [ ] 4.5 Implement rollback mechanism
- [ ] 4.6 Implement version history querying
- [ ] 4.7 Implement version comparison/diff functionality
- [ ] 4.8 Write tests for version control operations

## 5. Hot Reloading Integration

- [ ] 5.1 Create `speckit/src/core/patch/hot-reload.ts`
- [ ] 5.2 Integrate with SchemaResolver cache invalidation
- [ ] 5.3 Implement cache invalidation triggers after patch execution
- [ ] 5.4 Add React re-render triggers (SWR/React Query integration)
- [ ] 5.5 Test hot reloading with Next.js App Router
- [ ] 5.6 Ensure no rebuild required for schema changes
- [ ] 5.7 Add debouncing for rapid patch sequences

## 6. Audit Logging System

- [ ] 6.1 Create `speckit/src/core/patch/audit-logger.ts`
- [ ] 6.2 Implement audit log entry structure
- [ ] 6.3 Implement persistent storage for audit logs (`public/patches/audit/`)
- [ ] 6.4 Log all patch operations (ID, timestamp, actor, scope, operation, target, result)
- [ ] 6.5 Implement audit log querying interface
- [ ] 6.6 Add filtering by actor, scope, operation, date range
- [ ] 6.7 Write tests for audit logging

## 7. Patch Storage and Management

- [ ] 7.1 Create `speckit/public/patches/` directory structure
- [ ] 7.2 Implement patch file storage (one file per patch)
- [ ] 7.3 Implement patch metadata indexing
- [ ] 7.4 Create patch querying interface (by ID, date, actor, scope)
- [ ] 7.5 Implement patch file naming convention

## 8. Batch Patch and Dependencies

- [ ] 8.1 Extend executor to support batch patches
- [ ] 8.2 Implement atomic batch execution (all succeed or all fail)
- [ ] 8.3 Implement patch dependency resolution
- [ ] 8.4 Add circular dependency detection
- [ ] 8.5 Implement ordered execution for dependent patches
- [ ] 8.6 Write tests for batch operations

## 9. Dry Run Capability

- [ ] 9.1 Extend executor to support dry-run mode
- [ ] 9.2 Implement simulation of patch application
- [ ] 9.3 Return preview of changes without modifying files
- [ ] 9.4 Show validation results in dry-run
- [ ] 9.5 Write tests for dry-run functionality

## 10. AI Tool Gateway Interface

- [ ] 10.1 Create `speckit/src/core/patch/gateway.ts`
- [ ] 10.2 Define PatchGenerationRequest and PatchGenerationResponse interfaces
- [ ] 10.3 Implement `generatePatch(intent, context)` function
- [ ] 10.4 Integrate with AI tool definitions
- [ ] 10.5 Add patch generation helpers for common operations
- [ ] 10.6 Write documentation for AI integration

## 11. Integration with Existing Systems

- [ ] 11.1 Integrate patch system with SchemaResolver
- [ ] 11.2 Update SchemaResolver to support versioned schemas
- [ ] 11.3 Integrate with Runtime components (PageRuntime, FormRuntime, CollectionRuntime)
- [ ] 11.4 Ensure existing pages continue to work
- [ ] 11.5 Add patch application hooks/triggers

## 12. Security and Authorization

- [ ] 12.1 Implement security level enforcement (L1 auto, L2 confirm, L3 block)
- [ ] 12.2 Add user confirmation flow for L2 patches
- [ ] 12.3 Implement actor permission checking
- [ ] 12.4 Add rate limiting for patch operations
- [ ] 12.5 Write security tests

## 13. Documentation and Examples

- [ ] 13.1 Create `speckit/docs/patch-dsl.md` with complete documentation
- [ ] 13.2 Document Patch DSL JSON schema
- [ ] 13.3 Document all patch scopes and operations
- [ ] 13.4 Create example patches for each scope
- [ ] 13.5 Document validation rules
- [ ] 13.6 Document security levels
- [ ] 13.7 Create AI integration guide
- [ ] 13.8 Update main README with Patch DSL overview

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

- [ ] 15.1 Create example patches for adding page field
- [ ] 15.2 Create example patches for updating permissions
- [ ] 15.3 Create example patches for modifying form structure
- [ ] 15.4 Create example patches for state machine changes
- [ ] 15.5 Create example patches for menu modifications
- [ ] 15.6 Store examples in `speckit/public/patches/examples/`
