# Speckit ERP 前端技术栈 v3.0（实际依赖核对版）

> 更新日期：2026-09-24
> v2.0 基于规划意图编写，其中部分版本号与库清单与实际安装不一致。本版依据 `speckit/package.json`、`speckit/components.json` 与源码实际用法逐项核对修正。
> 与 ERP Space Platform 目标技术栈的差距分析见 [TECH_STACK_GAP.md](./TECH_STACK_GAP.md)。

---

## 1. 核心技术栈（实际安装版本）

### 1.1 框架与语言

| 技术 | 版本 | 用途 | 状态 |
|------|------|------|------|
| Next.js | ^15.3.0 | 全栈框架 (App Router) | ✅ 已安装 |
| React | ^18.3.1 | UI 库 | ✅ 已安装（**非 v19**） |
| React DOM | ^18.3.1 | 渲染器 | ✅ 已安装 |
| TypeScript | 5.7.2 | 类型系统 | ✅ 已安装（版本锁定） |

### 1.2 样式与 UI 系统

| 技术 | 版本 | 用途 | 状态 |
|------|------|------|------|
| Tailwind CSS | ^4.0.0 | 实用优先 CSS 框架 | ✅ 已安装（**v4，非 v3**） |
| @tailwindcss/postcss | ^4.0.0 | Tailwind v4 PostCSS 集成 | ✅ 已安装 |
| shadcn/ui | CLI + `components.json` | 组件生成规范（**不是 npm 依赖**） | ✅ 已配置（style: new-york, baseColor: zinc） |
| Radix UI Primitives | ^1.x / ^2.x | 无头组件基础 | ✅ 30+ 个包 |
| lucide-react | ^0.476.0 | 图标库 | ✅ 已安装 |
| @tabler/icons-react | ^3.31.0 | 图标库（第二套） | ✅ 已安装 |
| clsx / tailwind-merge / cva | ^2.1 / ^3.0 / ^0.7 | 类名与变体工具 | ✅ 已安装 |
| motion | ^11.17.0 | 动画库 | ✅ 已安装 |
| tw-animate-css | ^1.2.4 | 动画样式 | ✅ 已安装 |

### 1.3 表单与验证

| 技术 | 版本 | 用途 | 状态 |
|------|------|------|------|
| React Hook Form | ^7.54.1 | 表单状态管理 | ✅ 已安装 |
| Zod | ^4.1.8 | 数据验证 Schema | ✅ 已安装（**v4，非 v3**） |
| @hookform/resolvers | ^5.2.1 | Hook Form 验证集成 | ✅ 已安装 |

### 1.4 状态管理

| 技术 | 版本 | 用途 | 状态 |
|------|------|------|------|
| Zustand | ^5.0.2 | 轻量级全局状态 | ✅ 已安装（**v5，非 v4**） |
| React Context | 内置 | 系统级状态（禁止业务数据） | ✅ 已使用 |

### 1.5 数据获取与 API

| 技术 | 版本 | 用途 | 状态 |
|------|------|------|------|
| Axios | ^1.x | HTTP 客户端 | ⚠️ 代码在用，但**未在 `speckit/package.json` 声明**（见 5.4） |
| SWR | — | 数据获取与缓存 | ❌ **未安装、未使用**（v2.0 记载有误） |
| socket.io-client | ^4.8.1 | WebSocket | ✅ 已安装 |
| nuqs | ^2.4.1 | URL 状态管理 | ✅ 已安装 |

### 1.6 工具与领域库

| 技术 | 版本 | 用途 | 状态 |
|------|------|------|------|
| date-fns | ^3.6.0 | 日期处理 | ✅ 已安装 |
| sonner | ^1.7.1 | 通知 / Toast | ✅ 已安装（**非 react-toastify**） |
| @tanstack/react-table | ^8.21.2 | 表格 | ✅ 已安装 |
| recharts | ^2.15.1 | 图表 | ✅ 已安装 |
| @xyflow/react + reactflow | ^12.10 / ^11.11 | 流程画布 | ✅ 已安装 |
| @dnd-kit/* | ^6 ~ ^8 | 拖拽 | ✅ 已安装 |
| @sentry/nextjs | ^9.47.1 | 前端错误监控 | ✅ 已安装 |
| cmdk + kbar | ^1.1 / ^0.1 | 命令面板 | ✅ 已安装 |
| @clerk/nextjs, @clerk/themes | ^6.12 / ^2.2 | 认证 | ⚠️ 依赖存在但 `src` 中无引用（模板残留，建议清理） |
| eslint | 8.48.0 | Lint | ⚠️ 版本锁定在 v8（根工作区使用 v9） |

---

## 2. 已安装的库清单

以下清单摘自 `speckit/package.json` 并归类，可直接与 `npm ls --workspace speckit` 对照。

```bash
# 核心框架
next@^15.3.0
react@^18.3.1
react-dom@^18.3.1
typescript@5.7.2

# 样式与 UI
tailwindcss@^4.0.0
@tailwindcss/postcss@^4.0.0
@radix-ui/*（30+ 包）
lucide-react@^0.476.0
@tabler/icons-react@^3.31.0
clsx@^2.1.1
tailwind-merge@^3.0.2
class-variance-authority@^0.7.1
motion@^11.17.0

# 表单与验证
react-hook-form@^7.54.1
zod@^4.1.8
@hookform/resolvers@^5.2.1

# 状态管理
zustand@^5.0.2

# 数据获取与实时
axios@^1.x          # ⚠️ 未在本包声明，需补
socket.io-client@^4.8.1
nuqs@^2.4.1

# 领域组件
@tanstack/react-table@^8.21.2
recharts@^2.15.1
@xyflow/react@^12.10.0
reactflow@^11.11.4
@dnd-kit/core@^6.3.1
cmdk@^1.1.1
kbar@^0.1.0-beta.45

# 工具库
date-fns@^3.6.0
sonner@^1.7.1
uuid@^11.0.3
sharp@^0.33.5

# 监控
@sentry/nextjs@^9.47.1
```

---

## 3. 项目结构（实际）

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # 根布局
│   ├── page.tsx                 # 首页入口
│   ├── providers.tsx            # 全局 Provider
│   ├── global-error.tsx / not-found.tsx
│   ├── [locale]/                # i18n 路由段
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── admin/               # 后台页面（用户、角色、部门、AI 模块等）
│   │   ├── dashboard/
│   │   └── docs/
│   ├── login/                   # 登录页（已重新设计）
│   ├── auth/                    # 认证流程页
│   ├── invitations/
│   └── 500/
│
├── core/                         # 前端运行时内核（Runtime-First 的落点）
│   ├── schema/                  # Schema 系统：types / registry / resolver / validator / adapters
│   ├── page-model/              # 页面模型校验器
│   ├── patch/                   # Patch DSL：validator / executor / patch-manager /
│   │                            #   audit-logger / version-control / hot-reload / gateway
│   ├── plugins/                 # 插件运行时（plugin-runtime / component-loader / theme-service）
│   ├── auth/                    # permission-guard / permission-hooks / auth-hooks
│   ├── navigation/              # 菜单 hooks
│   ├── store/                   # Zustand stores：auth / permission / organization / menu / ui
│   ├── theme/                   # 主题运行时
│   ├── ui/                      # UI hooks
│   └── error/                   # 统一错误处理
│
├── components/
│   ├── ui/                      # 组件库（当前 51 个文件）
│   ├── runtime/                 # PageRuntime / FormRuntime / CollectionRuntime / DetailRuntime
│   ├── layout/                  # 布局：Sidebar、Header 等
│   ├── forms/                   # 表单组件
│   ├── brand/                   # 白标与品牌配置
│   ├── collaboration/           # 协作组件
│   ├── kbar/                    # 命令面板
│   ├── modal/ i18n/ themes/ performance/
│   └── [业务组件]/
│
├── features/                     # 业务特性：auth / profile / overview
├── lib/
│   ├── api/client.ts            # Axios 实例（JWT、组织上下文、刷新队列）
│   ├── api/*.api.ts             # 各领域 API：auth / menu / departments / audit-logs / ai-modules …
│   ├── api/cached-api.ts        # 缓存层（替代 SWR）
│   ├── ai/kimi-client.ts        # LLM 客户端
│   ├── websocket/               # WebSocket 客户端
│   └── utils.ts / format.ts / parsers.ts / searchparams.ts / data-table.ts
│
├── i18n/                         # 自研多语言（7 语言，未使用 next-intl）
├── config/ constants/ contexts/ hooks/ types/ pages/ layouts/ styles/
└── middleware.ts                 # i18n 路由中间件
```

---

## 4. 核心设计原则（保持不变）

```markdown
✅ Business-Agnostic：不包含任何业务假设
✅ Runtime-First：这是前端运行时，而非项目模板
✅ Schema-Driven：页面、表单、列表均可由 Schema 描述
✅ State-Aware：UI 必须感知业务状态
✅ Permission-First：所有可见性与操作先过权限
✅ Evolution-Friendly：允许被真实项目不断"污染"和修正
```

---

## 5. 关键实现指南

### 5.1 UI 组件使用

**所有新组件必须使用 shadcn/ui**：

```typescript
// ✅ 正确
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

// ❌ 错误
import Button from 'some-ui-library'
```

### 5.2 表单处理

**使用 React Hook Form + Zod**：

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })
  // ...
}
```

### 5.3 状态管理

**系统级状态用 Zustand，业务数据用 API**：

```typescript
// ✅ 正确：系统状态
const useUIStore = create((set) => ({
  isModalOpen: false,
  toggleModal: () => set((state) => ({ isModalOpen: !state.isModalOpen })),
}))

// ❌ 错误：业务数据不应该在全局状态
const useUserStore = create((set) => ({
  users: [], // 应该从 API 获取
}))
```

### 5.4 数据获取

**使用 `lib/api/client` 的统一实例，不要直接 `import axios`**：

```typescript
// ✅ 正确：走统一客户端（自带 JWT、组织上下文、刷新队列、错误处理）
import { apiClient } from '@/lib/api/client'   // 或从 '@/lib/api' 统一导入

const data = await apiClient.get('/api/users')

// ✅ 领域 API 放在 lib/api/*.api.ts，页面只调用领域方法
import { usersApi, moduleRegistryApi } from '@/lib/api'

const users = await usersApi.findAll()
```

现状与待办：

- 统一客户端 `speckit/src/lib/api/client.ts` 已实现 JWT 注入、`organizationId` 头、401 刷新队列与错误归一化；`speckit/src/core/error/error-handler.ts` 识别 `AxiosError`。
- 领域 API 在 `speckit/src/lib/api/*.api.ts`，缓存层在 `speckit/src/lib/api/cached-api.ts`。
- ⚠️ **axios 未在 `speckit/package.json` 声明**：它只作为 `backend` 的依赖存在，前端对它的引用属于幽灵依赖（依赖工作区提升或 pnpm store 的偶然解析）。**必须补进 `speckit/package.json` 的 dependencies**，否则在只安装前端的干净环境下会解析失败。
- 本项目**未使用 SWR**（v2.0 文档记载有误）。如需引入数据缓存策略，应在统一客户端或 `cached-api` 层扩展，而不是混用两套请求范式。

---

## 6. 已完成的改进

### 6.1 Login 页面重新设计

✅ **使用 shadcn/ui 组件**
- Button、Input、Card、Label、Checkbox

✅ **表单验证**
- React Hook Form + Zod
- 实时验证反馈

✅ **用户体验**
- 加载状态显示
- 错误提示
- 成功反馈
- 记住我功能
- 忘记密码链接

✅ **设计**
- 深色主题
- 渐变背景
- 专业的卡片设计
- 响应式布局

### 6.2 组件库基础

✅ **已创建的 shadcn/ui 组件**
- Button
- Input
- Card (CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
- Label
- Checkbox
- Select
- Textarea
- Table
- Dialog
- Tabs
- Dropdown Menu
- Tooltip

✅ **工具函数**
- `cn()` - 条件类名合并

---

## 7. 后续需要实现的组件

### 7.1 表单组件

- [x] Select
- [x] Textarea
- [x] Combobox
- [x] Radio Group
- [x] Switch
- [x] Slider
- [x] Date Picker

### 7.2 数据展示组件

- [x] Table
- [x] Pagination
- [x] Tabs
- [x] Accordion
- [x] Breadcrumb

### 7.3 反馈组件

- [x] Dialog / Modal
- [x] Alert Dialog
- [x] Toast / Notification（实际使用 sonner）
- [x] Popover
- [x] Tooltip

### 7.4 导航组件

- [x] Sidebar（shadcn 版本已实现）
- [x] Navigation Menu
- [x] Dropdown Menu
- [x] Command Palette

---

## 8. 最佳实践

### 8.1 组件开发

```typescript
// ✅ 使用 shadcn/ui 作为基础
import { Button } from '@/components/ui/button'

// ✅ 创建业务组件
export function UserCard({ user }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{user.email}</p>
      </CardContent>
    </Card>
  )
}
```

### 8.2 表单开发

```typescript
// ✅ 使用 React Hook Form + Zod
const schema = z.object({
  name: z.string().min(1, '名称必填'),
  email: z.string().email('邮箱格式错误'),
})

export function UserForm() {
  const form = useForm({ resolver: zodResolver(schema) })
  // ...
}
```

### 8.3 样式规范

```typescript
// ✅ 使用 Tailwind CSS 类名
<div className="flex items-center justify-between p-4 rounded-lg bg-slate-100">
  <span className="text-sm font-medium">Title</span>
</div>

// ✅ 使用 cn() 合并条件类名
<button className={cn(
  "px-4 py-2 rounded",
  isActive && "bg-blue-600 text-white",
  isDisabled && "opacity-50 cursor-not-allowed"
)}>
  Click me
</button>
```

---

## 9. 依赖关系图

```
Next.js (App Router)
├── React 18.3
├── TypeScript 5.7
├── Tailwind CSS v4（@tailwindcss/postcss）
│   └── UI 体系：components.json (new-york) + Radix Primitives + cva + tailwind-merge
│       ├── components/ui（51 个组件文件）
│       └── components/runtime（Page / Form / Collection / Detail）
├── React Hook Form 7.54
│   └── Zod 4（验证）
├── Zustand 5（系统级状态）
├── lib/api/client（Axios 实例 + 缓存层）  ← axios 需补声明
├── socket.io-client（实时）
│
├── 表格 @tanstack/react-table
├── 图表 recharts
├── 流程画布 @xyflow/react
├── 拖拽 @dnd-kit
├── 图标 lucide-react / @tabler/icons-react
├── 日期 date-fns
├── 通知 sonner
└── 监控 @sentry/nextjs
```

---

## 10. 迁移检查清单

- [x] 安装 shadcn/ui 及相关库
- [x] 创建 shadcn/ui 基础组件
- [x] 重新设计 login 页面
- [x] 迁移其他页面到 shadcn/ui（首页、admin/users、roles、departments）
- [x] 创建表单组件库（Select、Textarea、Combobox、Radio Group、Switch、Slider、Date Picker）
- [x] 创建数据展示组件库（Table、Tabs、Pagination、Accordion、Breadcrumb）
- [x] 创建反馈组件库（Dialog、Tooltip、Alert Dialog、Popover）
- [x] 创建导航组件库（Dropdown Menu、Navigation Menu、Sidebar、Command Palette）
- [x] 更新所有现有 admin 页面与 Sidebar 为 shadcn 组件
- [x] 补充所有缺失的 shadcn/ui 组件（13 个新组件）
- [ ] 添加深色模式支持（已有 theme-toggle，可接 shadcn 主题）
- [ ] 性能优化
- [ ] 文档完善

---

## 11. 参考资源

- [shadcn/ui 文档](https://ui.shadcn.com)
- [Tailwind CSS v4 文档](https://tailwindcss.com)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
- [React Hook Form 文档](https://react-hook-form.com)
- [Zod v4 文档](https://zod.dev)
- [Zustand 文档](https://github.com/pmndrs/zustand)
- [TanStack Table 文档](https://tanstack.com/table)
- [Sonner 文档](https://sonner.emilkowal.ski)
- [React Flow (@xyflow/react) 文档](https://reactflow.dev)

---

**版本历史**：
- v1.0 (2026-02-07): 原始规划
- v2.0 (2026-02-07): 完整实现版本，添加 shadcn/ui 和相关库
- v2.1 (2026-02-07): 迁移推进：补充 Select/Textarea/Table/Dialog/Tabs/Dropdown/Tooltip；首页与 admin 三页、Sidebar 全部迁至 shadcn；components.json 修正为 new-york 风格
- v3.0 (2026-09-24): 依据 `speckit/package.json` 与源码实际用法核对修正：React 19→18.3、Tailwind 3→4、Zod 3→4、Zustand 4→5、@hookform/resolvers 3→5；删除不存在的 SWR 与 react-toastify（实际为 sonner）；标注 axios 幽灵依赖与 @clerk 残留；按真实目录重写项目结构与依赖关系图
