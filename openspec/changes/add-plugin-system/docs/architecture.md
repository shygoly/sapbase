# Plugin System Architecture

## Overview

The plugin system enables dynamic extension of the application without code changes. It supports integration plugins (external service connectors) and UI/Theme plugins (frontend customizations).

## Architecture Layers

### Domain Layer

**Location**: `backend/src/plugins/domain/`

Core domain entities and interfaces:
- `Plugin` - Domain entity representing a plugin
- `PluginPermissions` - Value object for permission management
- `IPluginRepository` - Repository interface
- `IPluginLoader` - Loader interface
- `IDependencyResolver` - Dependency resolution interface
- `IPermissionChecker` - Permission checking interface
- `IPluginContext` - Plugin context interface
- `IPluginEventEmitter` - Event emitter interface

### Application Layer

**Location**: `backend/src/plugins/application/`

Application services:
- `PluginLifecycleService` - Manages plugin lifecycle (install, activate, deactivate, uninstall)
- `GetPluginsService` - Retrieves and presents plugin data
- `PluginModuleIntegrationService` - Integrates plugins with module registry
- `PluginRegistryService` - Manages plugin registry browsing

### Infrastructure Layer

**Location**: `backend/src/plugins/infrastructure/`

Infrastructure implementations:
- **Persistence**: `PluginRepository`, `Plugin` (TypeORM entity)
- **Services**: `PluginLoaderService`, `DependencyResolverService`, `PermissionCheckerService`
- **Runtime**: `PluginRuntimeService`, `PluginContextProvider`, `PluginApiRouterService`
- **Security**: `PluginSecurityValidatorService`
- **Events**: `PluginEventEmitterService`
- **Audit**: `PluginAuditLoggerService`
- **Database**: `PluginDatabaseAccessService`

### Frontend Layer

**Location**: `speckit/src/core/plugins/`

Frontend runtime:
- `plugin-component-loader.ts` - Loads and registers UI components
- `plugin-theme-service.ts` - Manages theme customizations
- `plugin-runtime.tsx` - Main runtime provider and component renderer

## Plugin Lifecycle

1. **Install**: Upload ZIP → Validate → Extract → Store → Register
2. **Activate**: Load code → Initialize → Register hooks → Enable functionality
3. **Deactivate**: Unregister hooks → Cleanup → Disable functionality
4. **Uninstall**: Deactivate → Remove files → Delete records

## Security Model

- **Permission-based**: Plugins declare required permissions in manifest
- **Validation**: Manifest validation and code scanning
- **Isolation**: Organization-level plugin isolation
- **Audit**: All operations logged for security and compliance

## Plugin Format

- **Package**: ZIP archive
- **Manifest**: `manifest.json` at root
- **Backend**: JavaScript/TypeScript entry point
- **Frontend**: Optional React components and CSS

## API Integration

Plugins can:
- Expose API endpoints via `/api/plugins/{plugin-id}/{route}`
- Access database with permission checks
- Register/extend modules
- Add UI components and pages
- Apply theme customizations

## Event System

Lifecycle events:
- `plugin.installed`
- `plugin.activated`
- `plugin.deactivated`
- `plugin.uninstalled`
- `plugin.error`

Events are emitted and can be subscribed to for monitoring and integration.

## Distribution

- **Internal Registry**: Organization-specific plugin repository
- **File Upload**: Direct ZIP file upload
- **Future**: Public marketplace (optional)

## Extension Points

1. **Module Extension**: Plugins can extend existing modules
2. **Module Creation**: Plugins can create new modules
3. **API Endpoints**: Plugins can add custom API routes
4. **UI Components**: Plugins can provide React components
5. **Pages**: Plugins can create new pages
6. **Themes**: Plugins can customize styling
