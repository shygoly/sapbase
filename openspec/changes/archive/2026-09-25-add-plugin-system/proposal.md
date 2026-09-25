# Change: Add Plugin System

## Why

Currently, module registration is hardcoded through direct service calls (`ModuleRegistryService`). This limits extensibility and prevents third-party integrations. Organizations need the ability to:

- Install plugins dynamically without code changes
- Enable/disable plugins at runtime
- Support third-party plugin development
- Manage plugin dependencies and versions
- Ensure plugin isolation and security

## What Changes

- **ADDED**: Plugin system architecture with plugin registry, loader, and lifecycle management
- **ADDED**: Plugin manifest format and validation
- **ADDED**: Plugin installation, activation, and deactivation APIs
- **ADDED**: Plugin dependency resolution and version management
- **ADDED**: Plugin sandboxing/isolation mechanisms
- **MODIFIED**: Module registry to support plugin-based modules
- **ADDED**: Plugin marketplace/discovery mechanism (optional, can be phased)

## Impact

- **Affected specs**: New capability `plugin-system`
- **Affected code**: 
  - `backend/src/module-registry/` - Integration with plugin system
  - `backend/src/ai-module-context/` - Plugin-based module registration
  - New: `backend/src/plugins/` - Plugin system implementation
- **Breaking changes**: None initially (backward compatible with existing modules)
- **Migration**: Existing modules continue to work; plugins are additive

## Decisions Made

1. **Plugin Types**: Integration plugins and UI/Theme plugins
2. **Plugin Format**: ZIP archives with manifest.json
3. **Plugin Capabilities**: 
   - Extend existing modules
   - Create new modules
   - Add API endpoints
   - Modify UI
   - Access database (with permissions)
4. **Security Model**: Permission-based access control (no full sandboxing)
5. **Distribution**: Internal plugin registry and direct file upload
