# Plugin API Reference

This document describes the APIs available to plugins.

## Plugin Context API

Plugins receive a `context` object that provides controlled access to system services.

### Database Access

```javascript
// Execute a raw SQL query
const results = await context.database.executeQuery(
  'users',           // table name (must be in permissions)
  'read',            // operation: 'read' | 'write' | 'delete'
  'SELECT * FROM users WHERE organization_id = $1',
  [organizationId]   // query parameters
);

// Get a TypeORM repository
const repository = context.database.getRepository(
  UserEntity,        // entity class
  'users'            // table name (must be in permissions)
);
```

### Module Registry

```javascript
// Register a new module
const moduleId = await context.modules.register(
  'My Module',                    // module name
  'Description of my module',     // description
  'integration'                    // optional type
);

// Extend an existing module
await context.modules.extend(
  'existing-module',               // module name to extend
  {                                // extension data
    newCapability: 'value'
  }
);
```

### Logging

```javascript
context.logger.log('Info message');
context.logger.error('Error message');
context.logger.warn('Warning message');
context.logger.debug('Debug message');
```

### Metadata

```javascript
const config = context.metadata.getConfig();
const version = context.metadata.getVersion();
const name = context.metadata.getName();
```

## Lifecycle Hooks

### onInstall

Called when the plugin is installed.

```javascript
async function onInstall(context) {
  // Setup initial data, create tables, etc.
}
```

### onActivate

Called when the plugin is activated.

```javascript
async function onActivate(context) {
  // Initialize services, start background tasks
}
```

### onDeactivate

Called when the plugin is deactivated.

```javascript
async function onDeactivate(context) {
  // Cleanup resources, stop background tasks
}
```

### onUninstall

Called when the plugin is uninstalled.

```javascript
async function onUninstall(context) {
  // Remove data, cleanup files
}
```

## API Route Handlers

Plugins can expose API endpoints:

```javascript
class MyPlugin {
  getApiHandlers() {
    return {
      '/my-endpoint': async (req, res) => {
        // Handle request
        return res.json({ message: 'Hello' });
      },
      '/another-endpoint': async (req, res) => {
        // Handle another request
        return res.status(200).json({ data: [] });
      }
    };
  }
}
```

Routes are accessible at: `/api/plugins/{plugin-id}/{route-path}`

## Frontend API

### Plugin Component Renderer

Render plugin components in your React code:

```jsx
import { PluginComponentRenderer } from '@/core/plugins/plugin-runtime';

<PluginComponentRenderer
  pluginId="my-plugin"
  componentName="MyComponent"
  fallback={<div>Loading...</div>}
/>
```

### Plugin Runtime Hook

Access plugin runtime in React components:

```jsx
import { usePluginRuntime } from '@/core/plugins/plugin-runtime';

function MyComponent() {
  const { plugins, loadPlugin, unloadPlugin } = usePluginRuntime();
  // Use plugin runtime
}
```

## Permission System

### Checking Permissions

Permissions are checked automatically by the system. Plugins declare permissions in their manifest:

```json
{
  "permissions": {
    "api": {
      "endpoints": ["/api/my-endpoint"],
      "methods": ["GET", "POST"]
    },
    "database": {
      "tables": ["users"],
      "operations": ["read", "write"]
    }
  }
}
```

### Permission Enforcement

- **API Access**: Only declared endpoints and methods are allowed
- **Database Access**: Only declared tables and operations are allowed
- **UI Access**: Only declared components and pages can be loaded
- **Module Access**: Only declared module extensions are allowed

## Error Handling

Always handle errors gracefully:

```javascript
try {
  const result = await context.database.executeQuery(...);
} catch (error) {
  context.logger.error('Database query failed:', error);
  // Handle error appropriately
}
```

## Best Practices

1. **Use Context APIs**: Always use provided context APIs instead of direct system access
2. **Handle Errors**: Always wrap operations in try-catch blocks
3. **Logging**: Use context.logger for all logging
4. **Permissions**: Request minimal permissions needed
5. **Organization Isolation**: Always include organization filters in database queries
