# Change: Document AI Module Lifecycle and Patch Metadata Rules

## Why
The AI module lifecycle and Patch DSL metadata recognition rules are implemented but not formalized in OpenSpec. This leads to inconsistent patch generation and unclear expectations for module registration, especially for CRM-style multi-entity modules.

## What Changes
- Document the AI module lifecycle (create → generate patch → test → review → publish/unpublish) and required status transitions.
- Document patch generation and storage rules (prompt → patchContent → testResults → review metadata).
- Document module registry registration behavior on publish.
- Specify Patch DSL metadata extraction shapes (`objects` map or `scope` + `target.identifier`) and optional `apiBasePath`/`schemaPath`.
- Add a CRM multi-entity example to illustrate compliant Patch DSL structure.

## Impact
- Affected specs: `ai-module-management`, `patch-dsl-system`, `module-registry`
- Affected code: Documentation only (no implementation changes)
