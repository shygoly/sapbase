# 插件前端配置与类型说明

本文档说明插件在前端的配置页展示方式，以及各插件类型（UI / Integration / Theme）的完整示例与接口约定。

## 一、插件配置页

### 入口

- **列表入口**：管理后台 → 插件管理 → 每个插件行的「配置」按钮（齿轮图标）。
- **URL**：`/{locale}/admin/plugins/{pluginId}/config`  
  例如：`/en/admin/plugins/abc-123/config`。

### 行为

- 若插件在 manifest 的 `permissions.ui.pages` 中声明了 `config`，并提供了对应前端资源，则加载并渲染插件的配置组件。
- 若插件未提供 config 页面或加载失败，则显示占位文案：「该插件暂无配置项 / No configuration options for this plugin。」

### 插件端如何提供配置页

1. 在 **manifest.json** 中声明配置页：

```json
{
  "permissions": {
    "ui": {
      "pages": ["config"]
    }
  }
}
```

2. 在插件包内提供前端资源，使运行时能通过 `/plugins/{pluginId}/pages/config` 加载到组件（具体加载方式由宿主前端的 plugin-component-loader 决定，通常为静态资源或打包后的 chunk）。

---

## 二、插件类型与完整示例

### 类型枚举

| 类型 | 说明 |
|------|------|
| `ui` | 提供前端组件、页面、小组件，扩展管理界面能力。 |
| `integration` | 对接外部服务或 API，后端逻辑为主，可附带简单 UI。 |
| `theme` | 提供主题变量与样式，覆盖或扩展系统主题。 |

---

### 1. UI 插件完整示例

**目录结构：**

```
my-ui-plugin/
├── manifest.json
├── backend/
│   └── index.js
└── frontend/
    ├── pages/
    │   └── config.jsx    # 配置页组件
    └── components/
        └── MyWidget.jsx
```

**manifest.json：**

```json
{
  "name": "my-ui-plugin",
  "version": "1.0.0",
  "type": "ui",
  "description": "示例 UI 插件，提供小组件与配置页",
  "author": "Your Name",
  "license": "MIT",
  "permissions": {
    "ui": {
      "components": ["MyWidget"],
      "pages": ["config"]
    }
  },
  "entry": {
    "backend": "backend/index.js",
    "frontend": "frontend/index.js"
  },
  "config": {
    "title": "My UI Plugin",
    "options": {}
  }
}
```

**配置页示例（frontend/pages/config.jsx）：**

```jsx
import React, { useState } from 'react'

export default function ConfigPage() {
  const [saved, setSaved] = useState(false)
  return (
    <div className="rounded-lg border p-6">
      <h2 className="text-lg font-semibold mb-4">My UI Plugin 配置</h2>
      <p className="text-muted-foreground text-sm mb-4">
        在此配置插件行为，保存后生效。
      </p>
      <button
        type="button"
        onClick={() => setSaved(true)}
        className="px-4 py-2 bg-primary text-primary-foreground rounded"
      >
        保存
      </button>
      {saved && <p className="mt-2 text-green-600">已保存</p>}
    </div>
  )
}
```

---

### 2. Integration 插件完整示例

**目录结构：**

```
my-integration-plugin/
├── manifest.json
├── backend/
│   └── index.js
└── frontend/
    └── pages/
        └── config.jsx
```

**manifest.json：**

```json
{
  "name": "my-integration-plugin",
  "version": "1.0.0",
  "type": "integration",
  "description": "对接外部 API 的示例插件",
  "author": "Your Name",
  "license": "MIT",
  "permissions": {
    "api": {
      "endpoints": ["/api/plugins/:pluginId/sync"],
      "methods": ["GET", "POST"]
    },
    "ui": {
      "pages": ["config"]
    }
  },
  "entry": {
    "backend": "backend/index.js",
    "frontend": "frontend/index.js"
  },
  "api": {
    "routes": [
      {
        "path": "/sync",
        "method": "POST",
        "handler": "handleSync"
      }
    ]
  },
  "config": {
    "apiKey": "",
    "endpoint": "https://api.example.com"
  }
}
```

**配置页示例（frontend/pages/config.jsx）：**

```jsx
import React, { useState } from 'react'

export default function ConfigPage() {
  const [apiKey, setApiKey] = useState('')
  const [endpoint, setEndpoint] = useState('https://api.example.com')
  return (
    <div className="rounded-lg border p-6 space-y-4">
      <h2 className="text-lg font-semibold">Integration 插件配置</h2>
      <div>
        <label className="block text-sm font-medium mb-1">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="border rounded px-3 py-2 w-full max-w-md"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Endpoint</label>
        <input
          type="url"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          className="border rounded px-3 py-2 w-full max-w-md"
        />
      </div>
      <button type="button" className="px-4 py-2 bg-primary text-primary-foreground rounded">
        保存
      </button>
    </div>
  )
}
```

---

### 3. Theme 插件完整示例

**目录结构：**

```
my-theme-plugin/
├── manifest.json
├── backend/
│   └── index.js
└── frontend/
    ├── theme.css
    └── pages/
        └── config.jsx
```

**manifest.json：**

```json
{
  "name": "my-theme-plugin",
  "version": "1.0.0",
  "type": "theme",
  "description": "自定义主题示例",
  "author": "Your Name",
  "license": "MIT",
  "permissions": {
    "ui": {
      "pages": ["config"]
    }
  },
  "entry": {
    "backend": "backend/index.js",
    "frontend": "frontend/index.js"
  },
  "ui": {
    "theme": {
      "variables": {
        "--primary": "#0066cc",
        "--primary-foreground": "#ffffff"
      },
      "styles": ".sidebar { border-right-width: 2px; }"
    }
  },
  "config": {
    "primaryColor": "#0066cc"
  }
}
```

**配置页示例（frontend/pages/config.jsx）：**

```jsx
import React, { useState } from 'react'

export default function ConfigPage() {
  const [primary, setPrimary] = useState('#0066cc')
  return (
    <div className="rounded-lg border p-6 space-y-4">
      <h2 className="text-lg font-semibold">主题配置</h2>
      <div>
        <label className="block text-sm font-medium mb-1">主色</label>
        <input
          type="color"
          value={primary}
          onChange={(e) => setPrimary(e.target.value)}
          className="h-10 w-20 cursor-pointer"
        />
        <span className="ml-2 text-muted-foreground">{primary}</span>
      </div>
      <button type="button" className="px-4 py-2 bg-primary text-primary-foreground rounded">
        应用主题
      </button>
    </div>
  )
}
```

---

## 三、接口文档（后端 API）

以下为宿主系统提供的插件管理接口，前端通过 `pluginsApi` 或直接请求调用。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/plugins` | 获取当前组织的已安装插件列表 |
| GET | `/api/plugins/:id` | 获取单个插件详情（含 manifest、状态等） |
| POST | `/api/plugins/install` | 安装插件（Body: multipart/form-data，字段 `file` 为 ZIP） |
| POST | `/api/plugins/:id/activate` | 激活插件 |
| POST | `/api/plugins/:id/deactivate` | 停用插件 |
| DELETE | `/api/plugins/:id` | 卸载插件 |
| GET | `/api/plugins/registry` | 浏览注册表中的可用插件（列表） |

### 插件自定义 API 路由

插件在 manifest 的 `api.routes` 中声明的路由，会挂载在：

- **路径**：`/api/plugins/{pluginId}{route.path}`  
  例如：`/api/plugins/abc-123/sync`
- **方法**：与 manifest 中声明的 `method` 一致（GET / POST / PUT / DELETE）。
- **鉴权**：需携带宿主系统的鉴权信息（如 JWT），且插件的 `permissions.api` 需声明对应 path 与 method。

前端调用示例（在插件配置页或其它前端逻辑中）：

```ts
// 调用插件自定义接口
const res = await httpClient.post(
  `/api/plugins/${pluginId}/sync`,
  { key: 'value' }
)
```

---

## 四、前端运行时

- **配置页路由**：`/[locale]/admin/plugins/[pluginId]/[page]`，其中 `page=config` 即配置页。
- **组件渲染**：宿主使用 `PluginComponentRenderer`，传入 `pluginId` 与 `componentName`（如 `config`），加载并渲染插件暴露的页面组件；加载失败时显示占位或 `fallbackOnError`。
- **插件列表中的「配置」**：跳转到 `/{locale}/admin/plugins/{plugin.id}/config`，保证每种类型的插件都可进入同一配置入口；无配置时由占位文案说明。

更多后端上下文、生命周期与权限说明见：`openspec/changes/add-plugin-system/docs/plugin-development-guide.md` 与 `plugin-api-reference.md`。
