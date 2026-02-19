# Integration Plugin Example

This is an example integration plugin that demonstrates how to create a plugin that integrates with an external service.

## Structure

```
integration-plugin-example/
├── manifest.json
├── backend/
│   └── index.js
└── README.md
```

## manifest.json

```json
{
  "name": "example-integration",
  "version": "1.0.0",
  "type": "integration",
  "description": "Example integration plugin",
  "author": "Example Author",
  "license": "MIT",
  "permissions": {
    "api": {
      "endpoints": ["/api/example"],
      "methods": ["GET", "POST"]
    },
    "database": {
      "tables": ["users"],
      "operations": ["read"]
    },
    "modules": {
      "create": true
    }
  },
  "entry": {
    "backend": "backend/index.js"
  },
  "hooks": {
    "onActivate": "onActivate",
    "onDeactivate": "onDeactivate"
  },
  "api": {
    "routes": [
      {
        "path": "/example",
        "method": "GET",
        "handler": "handleExample"
      }
    ]
  }
}
```

## backend/index.js

```javascript
class ExampleIntegrationPlugin {
  constructor() {
    this.initialized = false;
  }

  async initialize(context) {
    this.context = context;
    this.initialized = true;
    context.logger.log('Example integration plugin initialized');
  }

  async cleanup() {
    this.initialized = false;
    if (this.context) {
      this.context.logger.log('Example integration plugin cleaned up');
    }
  }

  getApiHandlers() {
    return {
      '/example': async (req, res) => {
        if (!this.initialized) {
          return res.status(503).json({ error: 'Plugin not initialized' });
        }

        // Example: Query database
        const users = await this.context.database.executeQuery(
          'users',
          'read',
          'SELECT id, name FROM users WHERE organization_id = $1 LIMIT 10',
          [this.context.organizationId]
        );

        return res.json({
          message: 'Hello from example integration plugin',
          users: users
        });
      }
    };
  }
}

// Hook functions
async function onActivate(context) {
  context.logger.log('Example integration plugin activated');
  
  // Register a module
  const moduleId = await context.modules.register(
    'Example Module',
    'Module created by example integration plugin',
    'integration'
  );
  
  context.logger.log(`Registered module: ${moduleId}`);
}

async function onDeactivate(context) {
  context.logger.log('Example integration plugin deactivated');
}

module.exports = ExampleIntegrationPlugin;
module.exports.onActivate = onActivate;
module.exports.onDeactivate = onDeactivate;
```

## Installation

1. Package the plugin as a ZIP file:
   ```bash
   zip -r example-integration-plugin.zip manifest.json backend/
   ```

2. Install via admin UI at `/admin/plugins`

3. Activate the plugin

4. Test the API endpoint at `/api/plugins/{plugin-id}/example`
