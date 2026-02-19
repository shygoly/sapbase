# Plugin Manifest Schema

## Overview

Plugins MUST include a `manifest.json` file at the root of the ZIP archive that declares plugin metadata, capabilities, permissions, and dependencies.

## Schema Definition

```json
{
  "name": "string (required, unique)",
  "version": "string (required, semver)",
  "type": "integration" | "ui" | "theme",
  "description": "string (optional)",
  "author": "string (optional)",
  "license": "string (optional)",
  "permissions": {
    "api": {
      "endpoints": ["string[]"],
      "methods": ["GET", "POST", "PUT", "DELETE"]
    },
    "database": {
      "tables": ["string[]"],
      "operations": ["read", "write", "delete"]
    },
    "ui": {
      "components": ["string[]"],
      "pages": ["string[]"]
    },
    "modules": {
      "extend": ["string[]"],
      "create": true
    }
  },
  "dependencies": {
    "plugins": [
      {
        "name": "string",
        "version": "string (semver range)"
      }
    ],
    "system": {
      "minVersion": "string (semver)"
    }
  },
  "entry": {
    "backend": "string (path to backend entry point)",
    "frontend": "string (path to frontend entry point, optional)"
  },
  "hooks": {
    "onInstall": "string (function name)",
    "onActivate": "string (function name)",
    "onDeactivate": "string (function name)",
    "onUninstall": "string (function name)"
  },
  "api": {
    "routes": [
      {
        "path": "string",
        "method": "GET" | "POST" | "PUT" | "DELETE",
        "handler": "string (function name)"
      }
    ]
  },
  "ui": {
    "components": [
      {
        "name": "string",
        "path": "string",
        "type": "component" | "page" | "widget"
      }
    ],
    "theme": {
      "variables": "object (optional)",
      "styles": "string (path to CSS, optional)"
    }
  }
}
```

## Field Descriptions

### Core Fields

- **name**: Unique plugin identifier (e.g., "stripe-integration")
- **version**: Semantic version (e.g., "1.0.0")
- **type**: Plugin type - "integration" for service connectors, "ui" for UI extensions, "theme" for styling
- **description**: Human-readable description
- **author**: Plugin author name
- **license**: License identifier (e.g., "MIT", "Apache-2.0")

### Permissions

Declares what the plugin needs access to:

- **api**: API endpoint access (which endpoints, which methods)
- **database**: Database access (which tables, which operations)
- **ui**: UI modification permissions (which components/pages)
- **modules**: Module-related permissions (extend existing, create new)

### Dependencies

- **plugins**: Other plugins this plugin depends on
- **system**: Minimum system version required

### Entry Points

- **backend**: Path to backend entry point file (e.g., "index.js")
- **frontend**: Path to frontend entry point (optional, for UI plugins)

### Hooks

Lifecycle hooks that plugins can implement:
- **onInstall**: Called during installation
- **onActivate**: Called when plugin is activated
- **onDeactivate**: Called when plugin is deactivated
- **onUninstall**: Called during uninstallation

### API Routes

For plugins that add API endpoints:
- **path**: Route path (relative to `/api/plugins/{plugin-id}/`)
- **method**: HTTP method
- **handler**: Function name in plugin code

### UI Components

For UI/Theme plugins:
- **components**: List of UI components provided
- **theme**: Theme customization options

## Example Manifest

```json
{
  "name": "stripe-payment-integration",
  "version": "1.0.0",
  "type": "integration",
  "description": "Stripe payment gateway integration",
  "author": "Acme Corp",
  "license": "MIT",
  "permissions": {
    "api": {
      "endpoints": ["/api/payments/*"],
      "methods": ["POST", "GET"]
    },
    "database": {
      "tables": ["payments", "transactions"],
      "operations": ["read", "write"]
    },
    "modules": {
      "create": true
    }
  },
  "dependencies": {
    "system": {
      "minVersion": "1.0.0"
    }
  },
  "entry": {
    "backend": "index.js"
  },
  "hooks": {
    "onActivate": "initializeStripe",
    "onDeactivate": "cleanupStripe"
  },
  "api": {
    "routes": [
      {
        "path": "/webhook",
        "method": "POST",
        "handler": "handleWebhook"
      }
    ]
  }
}
```
