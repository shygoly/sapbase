# Plugin Development Guide

This guide explains how to develop plugins for the system.

## Overview

Plugins extend the system's functionality by adding:
- **Integration plugins**: Connect to external services and APIs
- **UI/Theme plugins**: Customize the user interface and styling

## Plugin Structure

A plugin is a ZIP archive containing:

```
my-plugin/
├── manifest.json          # Plugin metadata and configuration
├── backend/
│   └── index.js          # Backend entry point
└── frontend/             # Optional frontend assets
    ├── components/       # UI components
    ├── pages/           # Plugin pages
    └── theme.css        # Theme customizations (for theme plugins)
```

## Manifest Format

The `manifest.json` file defines your plugin:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "type": "integration",
  "description": "My awesome plugin",
  "author": "Your Name",
  "license": "MIT",
  "permissions": {
    "api": {
      "endpoints": ["/api/my-endpoint"],
      "methods": ["GET", "POST"]
    },
    "database": {
      "tables": ["users"],
      "operations": ["read"]
    },
    "ui": {
      "components": ["MyComponent"],
      "pages": ["my-page"]
    },
    "modules": {
      "extend": ["existing-module"],
      "create": true
    }
  },
  "entry": {
    "backend": "backend/index.js",
    "frontend": "frontend/index.js"
  },
  "hooks": {
    "onInstall": "onInstall",
    "onActivate": "onActivate",
    "onDeactivate": "onDeactivate",
    "onUninstall": "onUninstall"
  },
  "api": {
    "routes": [
      {
        "path": "/my-endpoint",
        "method": "GET",
        "handler": "handleMyEndpoint"
      }
    ]
  },
  "dependencies": {
    "plugins": [
      {
        "name": "required-plugin",
        "version": "^1.0.0"
      }
    ],
    "system": {
      "minVersion": "1.0.0"
    }
  }
}
```

## Backend Development

### Entry Point

Your backend entry point should export a plugin class or object:

```javascript
// backend/index.js
class MyPlugin {
  async initialize(context) {
    // Plugin initialization
    context.logger.log('My plugin initialized');
  }

  async cleanup() {
    // Cleanup when plugin is deactivated
  }

  getApiHandlers() {
    return {
      '/my-endpoint': async (req, res) => {
        // Handle API request
        return res.json({ message: 'Hello from plugin' });
      }
    };
  }
}

module.exports = MyPlugin;
// Or: module.exports.default = MyPlugin;
```

### Plugin Context

The `context` object provides:

- **context.database**: Database access with permission checking
  - `executeQuery(table, operation, query, params)`
  - `getRepository(entityClass, tableName)`

- **context.modules**: Module registry access
  - `register(name, description, type)`
  - `extend(moduleName, extensions)`

- **context.logger**: Logging utilities
  - `log(message, ...args)`
  - `error(message, ...args)`
  - `warn(message, ...args)`
  - `debug(message, ...args)`

- **context.metadata**: Plugin metadata
  - `getConfig()`
  - `getVersion()`
  - `getName()`

### Lifecycle Hooks

Implement hooks in your plugin:

```javascript
// Hook functions
async function onInstall(context) {
  // Called when plugin is installed
}

async function onActivate(context) {
  // Called when plugin is activated
}

async function onDeactivate(context) {
  // Called when plugin is deactivated
}

async function onUninstall(context) {
  // Called when plugin is uninstalled
}

module.exports = {
  onInstall,
  onActivate,
  onDeactivate,
  onUninstall
};
```

## Frontend Development

### UI Components

Create React components in `frontend/components/`:

```javascript
// frontend/components/MyComponent.jsx
import React from 'react';

export default function MyComponent() {
  return <div>My Plugin Component</div>;
}
```

Declare components in manifest:
```json
{
  "permissions": {
    "ui": {
      "components": ["MyComponent"]
    }
  }
}
```

### Plugin Pages

Create pages in `frontend/pages/`:

```javascript
// frontend/pages/my-page.jsx
import React from 'react';

export default function MyPage() {
  return (
    <div>
      <h1>My Plugin Page</h1>
    </div>
  );
}
```

Pages are accessible at `/plugins/{plugin-id}/{page-name}`.

### Theme Customization

For theme plugins, create `frontend/theme.css`:

```css
/* Custom CSS variables */
:root {
  --plugin-my-plugin-primary: #007bff;
}

/* Custom styles */
.my-plugin-class {
  color: var(--plugin-my-plugin-primary);
}
```

## Permissions

### API Permissions

```json
{
  "permissions": {
    "api": {
      "endpoints": ["/api/my-endpoint"],
      "methods": ["GET", "POST"]
    }
  }
}
```

### Database Permissions

```json
{
  "permissions": {
    "database": {
      "tables": ["users", "orders"],
      "operations": ["read", "write"]
    }
  }
}
```

### UI Permissions

```json
{
  "permissions": {
    "ui": {
      "components": ["MyComponent"],
      "pages": ["my-page"]
    }
  }
}
```

### Module Permissions

```json
{
  "permissions": {
    "modules": {
      "extend": ["existing-module"],
      "create": true
    }
  }
}
```

## Security Best Practices

1. **Minimal Permissions**: Request only the permissions you need
2. **No Dangerous Code**: Avoid `eval()`, `Function()`, `child_process`
3. **Validate Input**: Always validate user input
4. **Use Context APIs**: Use provided context APIs instead of direct system access
5. **Organization Isolation**: Ensure queries include organization filters

## Testing

Test your plugin before distribution:

1. Create a test ZIP file
2. Install via the admin UI
3. Activate and test functionality
4. Check logs for errors
5. Test deactivation and uninstallation

## Distribution

1. Package your plugin as a ZIP file
2. Upload via the admin UI (`/admin/plugins`)
3. Or add to the internal registry at `plugins/registry/`

## Examples

See the examples directory for:
- Integration plugin example
- UI/Theme plugin example
