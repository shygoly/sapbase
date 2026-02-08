# Speckit ERP 前端技术栈规划 v2.0

> 更新日期：2026-02-07
> 基于原始规划 v1.0 的完整实现版本

---

## 1. 核心技术栈（已实现）

### 1.1 框架与语言

| 技术 | 版本 | 用途 | 状态 |
|------|------|------|------|
| Next.js | ^15.x | 全栈框架 (App Router) | ✅ 已安装 |
| React | ^19.x | UI 库 | ✅ 已安装 |
| TypeScript | ^5.x | 类型系统 | ✅ 已安装 |

### 1.2 样式与 UI 系统

| 技术 | 版本 | 用途 | 状态 |
|------|------|------|------|
| Tailwind CSS | ^3.x | 实用优先 CSS 框架 | ✅ 已安装 |
| shadcn/ui | latest | Headless UI 组件库 | ✅ 新增 |
| lucide-react | ^0.x | 图标库 | ✅ 新增 |
| clsx | ^2.x | 条件类名工具 | ✅ 新增 |

### 1.3 表单与验证

| 技术 | 版本 | 用途 | 状态 |
|------|------|------|------|
| React Hook Form | ^7.x | 表单状态管理 | ✅ 新增 |
| Zod | ^3.x | 数据验证 Schema | ✅ 新增 |
| @hookform/resolvers | ^3.x | Hook Form 验证集成 | ✅ 新增 |

### 1.4 状态管理

| 技术 | 版本 | 用途 | 状态 |
|------|------|------|------|
| Zustand | ^4.x | 轻量级全局状态 | ✅ 已安装 |
| React Context | 内置 | 系统级状态（禁止业务数据） | ✅ 已使用 |

### 1.5 数据获取与 API

| 技术 | 版本 | 用途 | 状态 |
|------|------|------|------|
| SWR | ^2.x | 数据获取与缓存 | ✅ 新增 |
| Axios | ^1.x | HTTP 客户端 | ✅ 新增 |

### 1.6 工具库

| 技术 | 版本 | 用途 | 状态 |
|------|------|------|------|
| date-fns | ^3.x | 日期处理 | ✅ 新增 |
| react-toastify | ^10.x | 通知/Toast | ✅ 新增 |

---

## 2. 已安装的库清单

```bash
# 核心框架
next@^15.x
react@^19.x
typescript@^5.x

# 样式与 UI
tailwindcss@^3.x
shadcn-ui@latest
lucide-react@^0.x
clsx@^2.x

# 表单与验证
react-hook-form@^7.x
zod@^3.x
@hookform/resolvers@^3.x

# 状态管理
zustand@^4.x

# 数据获取
swr@^2.x
axios@^1.x

# 工具库
date-fns@^3.x
react-toastify@^10.x
```

---

## 3. 项目结构

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # 根布局
│   ├── page.tsx                 # 首页
│   ├── login/
│   │   └── page.tsx             # 登录页面（已重新设计）
│   └── [其他页面]/
│
├── components/
│   ├── ui/                      # shadcn/ui 组件库
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── label.tsx
│   │   ├── checkbox.tsx
│   │   └── [其他组件]/
│   │
│   ├── forms/                   # 表单组件
│   │   ├── login-form.tsx
│   │   └── [其他表单]/
│   │
│   └── [业务组件]/
│
├── core/
│   ├── store/                   # Zustand stores
│   │   ├── workflow.store.ts
│   │   ├── form.store.ts
│   │   ├── ui.store.ts
│   │   ├── permission.store.ts
│   │   └── hooks.ts
│   │
│   ├── auth/                    # 认证相关
│   │   ├── hooks.ts
│   │   └── context.ts
│   │
│   └── api/                     # API 适配层
│       ├── client.ts            # Axios 实例
│       └── endpoints.ts
│
├── lib/
│   ├── utils.ts                 # 工具函数（cn 等）
│   ├── validators.ts            # Zod schemas
│   └── [其他工具]/
│
├── hooks/                       # 自定义 hooks
│   ├── useAuth.ts
│   ├── useForm.ts
│   └── [其他 hooks]/
│
└── types/                       # TypeScript 类型定义
    ├── auth.ts
    ├── api.ts
    └── [其他类型]/
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

**使用 SWR 或 Axios**：

```typescript
import useSWR from 'swr'
import axios from 'axios'

// 使用 SWR
const { data, error, isLoading } = useSWR('/api/users', fetcher)

// 或使用 Axios
const response = await axios.get('/api/users')
```

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
- [x] Toast / Notification（已用 react-toastify）
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
├── React 19
├── TypeScript
├── Tailwind CSS
│   └── shadcn/ui (基于 Tailwind)
│       ├── Button, Input, Card, Label, Checkbox
│       ├── Select, Textarea
│       ├── Table, Tabs
│       ├── Dialog, Tooltip, Dropdown Menu
│       └── …
├── React Hook Form
│   └── Zod (验证)
├── Zustand (状态管理)
├── SWR (数据获取)
├── Axios (HTTP)
├── lucide-react (图标)
├── date-fns (日期)
└── react-toastify (通知)
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
- [Tailwind CSS 文档](https://tailwindcss.com)
- [React Hook Form 文档](https://react-hook-form.com)
- [Zod 文档](https://zod.dev)
- [Zustand 文档](https://github.com/pmndrs/zustand)
- [SWR 文档](https://swr.vercel.app)

---

**版本历史**：
- v1.0 (2026-02-07): 原始规划
- v2.0 (2026-02-07): 完整实现版本，添加 shadcn/ui 和相关库
- v2.1 (2026-02-07): 迁移推进：补充 Select/Textarea/Table/Dialog/Tabs/Dropdown/Tooltip；首页与 admin 三页、Sidebar 全部迁至 shadcn；components.json 修正为 new-york 风格
