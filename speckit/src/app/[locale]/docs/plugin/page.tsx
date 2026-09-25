/**
 * Plugin configuration documentation page (docs/plugin).
 * Explains how to configure plugins and provides examples.
 */

import Link from 'next/link'
import { BookOpen, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: '插件配置说明 | Plugin Configuration',
  description: '如何配置插件及示例',
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-muted overflow-auto rounded-lg border p-4 text-sm">
      <code>{children}</code>
    </pre>
  )
}

type Props = { params: Promise<{ locale: string }> }

export default async function DocsPluginPage({ params }: Props) {
  const { locale } = await params
  const pluginsPath = `/${locale}/admin/plugins`

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          href={pluginsPath}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回插件管理
        </Link>

        <header className="mb-10">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <BookOpen className="h-5 w-5" />
            <span className="text-sm font-medium">文档</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            插件配置说明
          </h1>
          <p className="mt-2 text-muted-foreground">
            本文说明如何为系统配置插件，以及 UI、Integration、Theme 三类插件的完整示例。
          </p>
        </header>

        <article className="space-y-10 text-foreground">
          {/* 一、如何配置插件 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">一、如何配置插件</h2>
            <p className="text-muted-foreground mb-4">
              插件安装并激活后，可在管理后台进行配置。配置入口与插件是否提供配置页有关。
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
              <li>
                <strong className="text-foreground">列表入口</strong>：管理后台 → 插件管理 → 每个插件行的「配置」按钮（齿轮图标）。
              </li>
              <li>
                <strong className="text-foreground">配置页 URL</strong>：<code className="rounded bg-muted px-1.5 py-0.5 text-sm">/{'{locale}'}/admin/plugins/{'{pluginId}'}/config</code>
                ，例如 <code className="rounded bg-muted px-1.5 py-0.5 text-sm">/en/admin/plugins/abc-123/config</code>。
              </li>
            </ul>
            <p className="text-muted-foreground mb-4">
              若插件在 manifest 的 <code className="rounded bg-muted px-1.5 py-0.5 text-sm">permissions.ui.pages</code> 中声明了 <code className="rounded bg-muted px-1.5 py-0.5 text-sm">config</code> 并提供了对应前端资源，则会加载并渲染插件的配置组件；否则会显示「该插件暂无配置项」。
            </p>
            <h3 className="text-lg font-medium mt-6 mb-2">插件端如何提供配置页</h3>
            <p className="text-muted-foreground mb-2">1. 在 manifest.json 中声明配置页：</p>
            <CodeBlock>{`{
  "permissions": {
    "ui": {
      "pages": ["config"]
    }
  }
}`}</CodeBlock>
            <p className="text-muted-foreground mt-4">
              2. 在插件包内提供前端资源，使运行时能通过 <code className="rounded bg-muted px-1.5 py-0.5 text-sm">/plugins/{'{pluginId}'}/pages/config</code> 加载到配置组件。
            </p>
          </section>

          {/* 二、插件类型 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">二、插件类型</h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">类型</th>
                    <th className="text-left p-3 font-medium">说明</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3 font-mono">ui</td>
                    <td className="p-3 text-muted-foreground">提供前端组件、页面、小组件，扩展管理界面能力。</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-mono">integration</td>
                    <td className="p-3 text-muted-foreground">对接外部服务或 API，后端逻辑为主，可附带简单 UI。</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono">theme</td>
                    <td className="p-3 text-muted-foreground">提供主题变量与样式，覆盖或扩展系统主题。</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 三、示例 1：UI 插件 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">三、示例 1：UI 插件</h2>
            <p className="text-muted-foreground mb-4">
              目录结构示例：
            </p>
            <CodeBlock>{`my-ui-plugin/
├── manifest.json
├── backend/
│   └── index.js
└── frontend/
    ├── pages/
    │   └── config.jsx    # 配置页组件
    └── components/
        └── MyWidget.jsx`}</CodeBlock>
            <p className="text-muted-foreground mt-4 mb-2">manifest.json：</p>
            <CodeBlock>{`{
  "name": "my-ui-plugin",
  "version": "1.0.0",
  "type": "ui",
  "description": "示例 UI 插件，提供小组件与配置页",
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
}`}</CodeBlock>
            <p className="text-muted-foreground mt-4 mb-2">配置页示例（frontend/pages/config.jsx）：</p>
            <CodeBlock>{`import React, { useState } from 'react'

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
}`}</CodeBlock>
          </section>

          {/* 四、示例 2：Integration 插件 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">四、示例 2：Integration 插件</h2>
            <p className="text-muted-foreground mb-4">
              对接外部 API 的插件，可在 manifest 中声明 API 路由与配置项，并提供配置页填写 API Key、Endpoint 等。
            </p>
            <CodeBlock>{`{
  "name": "my-integration-plugin",
  "version": "1.0.0",
  "type": "integration",
  "description": "对接外部 API 的示例插件",
  "permissions": {
    "api": {
      "endpoints": ["/api/plugins/:pluginId/sync"],
      "methods": ["GET", "POST"]
    },
    "ui": {
      "pages": ["config"]
    }
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
}`}</CodeBlock>
            <p className="text-muted-foreground mt-4">
              配置页中可提供 API Key、Endpoint 等表单项，保存后由插件后端或宿主系统持久化到 <code className="rounded bg-muted px-1.5 py-0.5 text-sm">config</code>。
            </p>
          </section>

          {/* 五、示例 3：Theme 插件 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">五、示例 3：Theme 插件</h2>
            <p className="text-muted-foreground mb-4">
              提供主题变量与样式覆盖：
            </p>
            <CodeBlock>{`{
  "name": "my-theme-plugin",
  "version": "1.0.0",
  "type": "theme",
  "description": "自定义主题示例",
  "permissions": {
    "ui": {
      "pages": ["config"]
    }
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
}`}</CodeBlock>
            <p className="text-muted-foreground mt-4">
              配置页可提供颜色选择器等，用户修改主色等选项后，插件更新 <code className="rounded bg-muted px-1.5 py-0.5 text-sm">ui.theme.variables</code> 并应用。
            </p>
          </section>

          {/* 六、管理 API */}
          <section>
            <h2 className="text-xl font-semibold mb-4">六、插件管理 API</h2>
            <p className="text-muted-foreground mb-4">
              宿主系统提供的插件管理接口（前端通过 <code className="rounded bg-muted px-1.5 py-0.5 text-sm">pluginsApi</code> 或 HTTP 调用）：
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">方法</th>
                    <th className="text-left p-3 font-medium">路径</th>
                    <th className="text-left p-3 font-medium">说明</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3 font-mono">GET</td>
                    <td className="p-3 font-mono">/api/plugins</td>
                    <td className="p-3 text-muted-foreground">获取已安装插件列表</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-mono">GET</td>
                    <td className="p-3 font-mono">/api/plugins/:id</td>
                    <td className="p-3 text-muted-foreground">获取单个插件详情</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-mono">POST</td>
                    <td className="p-3 font-mono">/api/plugins/install</td>
                    <td className="p-3 text-muted-foreground">安装插件（multipart/form-data，file 为 ZIP）</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-mono">POST</td>
                    <td className="p-3 font-mono">/api/plugins/:id/activate</td>
                    <td className="p-3 text-muted-foreground">激活插件</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-mono">POST</td>
                    <td className="p-3 font-mono">/api/plugins/:id/deactivate</td>
                    <td className="p-3 text-muted-foreground">停用插件</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-mono">DELETE</td>
                    <td className="p-3 font-mono">/api/plugins/:id</td>
                    <td className="p-3 text-muted-foreground">卸载插件</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono">GET</td>
                    <td className="p-3 font-mono">/api/plugins/registry</td>
                    <td className="p-3 text-muted-foreground">浏览注册表中的可用插件</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground mt-4">
              插件自定义路由挂载在 <code className="rounded bg-muted px-1.5 py-0.5 text-sm">/api/plugins/{'{pluginId}'}{'{route.path}'}</code>，例如 <code className="rounded bg-muted px-1.5 py-0.5 text-sm">/api/plugins/abc-123/sync</code>。调用时需携带宿主鉴权（如 JWT），且 manifest 的 <code className="rounded bg-muted px-1.5 py-0.5 text-sm">permissions.api</code> 需声明对应 path 与 method。
            </p>
          </section>
        </article>

        <footer className="mt-12 pt-8 border-t">
          <Link href={pluginsPath}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回插件管理
            </Button>
          </Link>
        </footer>
      </div>
    </div>
  )
}
