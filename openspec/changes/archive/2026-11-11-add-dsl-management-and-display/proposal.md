# Change: DSL Management and Display

## Why
The system currently supports saving Module DSL (from 6-step definition) and Patch DSL (for module modifications), but lacks proper management and display capabilities. Users need to view, browse, version, and export these DSL definitions without generating actual code files. This change focuses on DSL as data artifacts rather than code generation.

## What Changes
- **ADDED**: UI and API for viewing Module DSL stored in `ai_modules.patchContent` field
- **ADDED**: UI and API for viewing 6-step definitions stored in `ai_module_definitions` table
- **ADDED**: DSL version history and comparison capabilities
- **ADDED**: DSL export functionality (JSON download)
- **ADDED**: DSL browsing and search interface
- **REMOVED**: Code generation functionality (frontend pages, backend entities, schema files generation)
- **DOCUMENTED**: Clear separation between DSL storage/display (this change) and code generation (out of scope)

## Impact
- Affected specs: `ai-module-management` (add DSL viewing/management requirements, remove code generation requirements)
- Affected code: 
  - Backend: Remove `CodeGeneratorService`, remove `generate-system` endpoint
  - Frontend: Remove code generation UI, add DSL viewing/management UI
  - Database: Clean up generated menu items (manual cleanup needed)

## Out of Scope (this change)
- Code generation from DSL (removed in this change)
- Automatic deployment (depends on code generation)
- DSL validation beyond basic JSON structure
- DSL editing (only viewing/exporting)
