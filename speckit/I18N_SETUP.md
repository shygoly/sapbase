# i18n 多语言支持设置指南

## 概述

已实现完整的国际化（i18n）支持系统，支持 7 种语言。

## 支持的语言

- 🇺🇸 English (en) - 默认
- 🇨🇳 中文 (zh)
- 🇯🇵 日本語 (ja)
- 🇰🇷 한국어 (ko)
- 🇪🇸 Español (es)
- 🇫🇷 Français (fr)
- 🇩🇪 Deutsch (de)

## 安装步骤

### 1. 安装依赖（如果需要）

当前实现使用自定义 i18n 方案，不需要额外依赖。但如果需要更高级功能，可以安装：

```bash
npm install next-intl
# 或
npm install react-i18next i18next
```

### 2. 文件结构

已创建的文件：
- `src/i18n/config.ts` - i18n 配置
- `src/i18n/messages/*.json` - 翻译文件
- `src/i18n/hooks/` - React hooks
- `src/components/i18n/` - UI 组件
- `src/middleware.ts` - 路由中间件

## 使用方法

### 在组件中使用翻译

```tsx
'use client'

import { useTranslation } from '@/i18n'

export function MyComponent() {
  const t = useTranslation()
  
  return (
    <div>
      <h1>{t('common.appName')}</h1>
      <button>{t('common.save')}</button>
    </div>
  )
}
```

### 添加语言切换器

```tsx
import { LanguageSwitcher } from '@/components/i18n/language-switcher'

export function Header() {
  return (
    <header>
      <LanguageSwitcher />
    </header>
  )
}
```

### URL 路由

URL 会自动添加语言前缀：
- `/en/dashboard` - 英文
- `/zh/dashboard` - 中文
- `/ja/dashboard` - 日文

## 添加新翻译

### 1. 在英文文件中添加

编辑 `src/i18n/messages/en.json`:

```json
{
  "mySection": {
    "title": "My Title",
    "description": "My Description"
  }
}
```

### 2. 在其他语言文件中添加翻译

编辑对应的语言文件（如 `zh.json`）:

```json
{
  "mySection": {
    "title": "我的标题",
    "description": "我的描述"
  }
}
```

### 3. 在组件中使用

```tsx
const t = useTranslation()
<h1>{t('mySection.title')}</h1>
```

## 迁移现有组件

### 步骤 1: 导入 hook

```tsx
import { useTranslation } from '@/i18n'
```

### 步骤 2: 使用翻译

```tsx
// 之前
<h1>Dashboard</h1>
<button>Save</button>

// 之后
const t = useTranslation()
<h1>{t('navigation.dashboard')}</h1>
<button>{t('common.save')}</button>
```

### 步骤 3: 添加翻译

确保所有语言文件中都有对应的翻译。

## 语言检测

系统按以下顺序检测语言：
1. URL 路径 (`/zh/dashboard`)
2. Cookie (`locale`)
3. 浏览器 `Accept-Language` 头
4. 默认语言（英文）

## 持久化

用户的语言偏好保存在：
- Cookie: `locale`
- localStorage: `locale`

## 组件示例

### 语言切换器

```tsx
import { LanguageSwitcher } from '@/components/i18n/language-switcher'

// 完整版本（带文字）
<LanguageSwitcher />

// 紧凑版本（仅图标）
<LanguageSwitcherCompact />
```

### 使用翻译

```tsx
import { useTranslation } from '@/i18n'

function MyComponent() {
  const t = useTranslation()
  const { locale, setLocale } = useLocale()
  
  return (
    <div>
      <h1>{t('common.appName')}</h1>
      <p>Current locale: {locale}</p>
      <button onClick={() => setLocale('zh')}>
        Switch to Chinese
      </button>
    </div>
  )
}
```

## 翻译文件结构

翻译文件按功能分组：

```json
{
  "common": { ... },      // 通用翻译
  "auth": { ... },        // 认证相关
  "navigation": { ... },  // 导航
  "organizations": { ... }, // 组织
  "users": { ... },       // 用户
  "workflows": { ... },   // 工作流
  "aiModules": { ... },   // AI 模块
  "notifications": { ... }, // 通知
  "errors": { ... }       // 错误消息
}
```

## 最佳实践

1. **使用描述性键名**: `auth.login` 而不是 `login`
2. **分组相关翻译**: 将相关翻译放在同一部分
3. **保持键一致**: 在所有语言文件中使用相同的键结构
4. **测试所有语言**: 确保所有支持的语言都能正常工作
5. **处理缺失翻译**: 系统会在翻译缺失时回退到键名

## 故障排除

### 翻译未找到

- 检查键是否存在于 `en.json`
- 验证键的拼写
- 查看控制台警告

### 语言未切换

- 清除 cookies 和 localStorage
- 检查中间件是否运行
- 验证 locale 是否有效

### 缺少翻译

- 在所有语言文件中添加缺失的键
- 使用英文作为后备
- 检查翻译文件结构

## 下一步

1. 迁移现有组件使用翻译
2. 添加更多翻译内容
3. 实现 RTL（从右到左）语言支持（如阿拉伯语）
4. 添加日期/时间本地化
5. 添加数字/货币格式化
