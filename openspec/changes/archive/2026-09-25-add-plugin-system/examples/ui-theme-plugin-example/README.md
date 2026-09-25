# UI/Theme Plugin Example

This is an example UI/Theme plugin that demonstrates how to create a plugin that adds UI components and theme customizations.

## Structure

```
ui-theme-plugin-example/
├── manifest.json
├── backend/
│   └── index.js
├── frontend/
│   ├── components/
│   │   └── ExampleWidget.jsx
│   ├── pages/
│   │   └── example-page.jsx
│   └── theme.css
└── README.md
```

## manifest.json

```json
{
  "name": "example-ui-theme",
  "version": "1.0.0",
  "type": "ui",
  "description": "Example UI/Theme plugin",
  "author": "Example Author",
  "license": "MIT",
  "permissions": {
    "ui": {
      "components": ["ExampleWidget"],
      "pages": ["example-page"]
    }
  },
  "entry": {
    "backend": "backend/index.js",
    "frontend": "frontend/index.js"
  }
}
```

## backend/index.js

```javascript
class ExampleUIThemePlugin {
  async initialize(context) {
    context.logger.log('Example UI/Theme plugin initialized');
  }

  async cleanup() {
    // Cleanup if needed
  }
}

module.exports = ExampleUIThemePlugin;
```

## frontend/components/ExampleWidget.jsx

```jsx
import React from 'react';

export default function ExampleWidget() {
  return (
    <div className="example-widget">
      <h3>Example Widget</h3>
      <p>This is an example widget from a plugin!</p>
    </div>
  );
}
```

## frontend/pages/example-page.jsx

```jsx
import React from 'react';

export default function ExamplePage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-4">Example Plugin Page</h1>
      <p className="text-gray-600">
        This page is provided by the example UI/Theme plugin.
      </p>
      <div className="mt-8">
        <ExampleWidget />
      </div>
    </div>
  );
}
```

## frontend/theme.css

```css
/* Example theme customizations */
:root {
  --plugin-example-ui-theme-primary: #007bff;
  --plugin-example-ui-theme-secondary: #6c757d;
}

.example-widget {
  padding: 1rem;
  border: 1px solid var(--plugin-example-ui-theme-primary);
  border-radius: 0.5rem;
  background-color: #f8f9fa;
}

.example-widget h3 {
  color: var(--plugin-example-ui-theme-primary);
  margin-bottom: 0.5rem;
}
```

## Usage

### Using the Component

In your React code:

```jsx
import { PluginComponentRenderer } from '@/core/plugins/plugin-runtime';

<PluginComponentRenderer
  pluginId="example-ui-theme"
  componentName="ExampleWidget"
/>
```

### Accessing the Page

The page is accessible at: `/plugins/example-ui-theme/example-page`

## Installation

1. Package the plugin as a ZIP file:
   ```bash
   zip -r example-ui-theme-plugin.zip manifest.json backend/ frontend/
   ```

2. Install via admin UI at `/admin/plugins`

3. Activate the plugin

4. The theme CSS will be automatically applied

5. Use components and pages as shown above
