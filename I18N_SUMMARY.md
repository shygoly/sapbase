# 多语言支持（i18n）实现总结

## 结论

locale 是**请求级偏好**，不进入应用 URL。

- 应用路由：`/dashboard/overview`、`/admin/users`
- 不再有：`/en/dashboard/overview`、`/zh/admin/users`
- 旧 URL 由 middleware 307 到无前缀路径，保留一个发布周期

## 解析顺序

每次请求按以下顺序解析：

1. 合法 `?lang=xx`（一次性覆盖，随后写入 cookie 并 307 去掉参数）
2. `NEXT_LOCALE` cookie
3. `Accept-Language`
4. `defaultLocale`（`en`）

后续 `add-user-and-org-locale-preference` 会把用户偏好与组织默认语言插入到 cookie 之前；
解析入口保持单一：`resolveLocale()`。

## 文件

| 位置 | 作用 |
|---|---|
| `libs/ui-layout/src/i18n/config.ts` | 支持列表、默认值、`resolveLocale()` / `negotiateLocale()` / `LOCALE_COOKIE` |
| `apps/web-portal/src/middleware.ts` | 旧前缀 307、`?lang`、canonical 跳转 |
| `apps/web-console/src/middleware.ts` | 同上 |
| `apps/*/src/app/layout.tsx` | 读 cookie/header，设置 `<html lang>`，挂 `AppProviders` |
| `libs/app-shared/src/components/i18n/i18n-provider.tsx` | 服务端 locale 注入；切换语言写 cookie + `router.refresh()` |
| `libs/app-shared/src/i18n/hooks/use-locale.ts` | `useLocale` / `useSetLocale` 读 Provider |
| `libs/ui-layout/src/hooks/use-locale.ts` | 非 Provider 场景：cookie → 默认值 |
| `libs/app-shared/src/i18n/messages/` | 7 种语言翻译文件 |

## Cookie

| 项 | 值 |
|---|---|
| 名称 | `NEXT_LOCALE` |
| Path | `/` |
| Max-Age | 31536000（一年） |
| SameSite | `Lax` |
| Secure | 生产开启 |

不再使用 `localStorage.locale` 作为运行时真源。

## 中间件行为

1. `/{locale}/...` → 307 到 `/{...}`，并把该 locale 写入 cookie。
2. `?lang=xx` → 合法则写 cookie，307 去掉参数；非法则原样忽略。
3. `/` → Portal `/dashboard/overview`，Console `/admin/releases`。
4. 不处理 `/_next`、`/api`、`/plugins`、`/images`、`favicon.ico`、`robots.txt`、`sitemap.xml`。
5. Portal 的 `/admin/*` 307 到 `NEXT_PUBLIC_CONSOLE_URL`（默认 `http://localhost:3060`）；
   Console 的 `/dashboard/*`、`/docs/*` 307 到 `NEXT_PUBLIC_PORTAL_URL`（默认 `http://localhost:3050`）。

## 客户端用法

```tsx
'use client'

import { useTranslation, useLocale, useSetLocale } from '@sap/app-shared/i18n'

export function MyComponent() {
  const t = useTranslation()
  const locale = useLocale()
  const setLocale = useSetLocale()

  return (
    <div>
      <h1>{t('common.appName')}</h1>
      <button onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}>
        switch
      </button>
    </div>
  )
}
```

切换语言不会改变 URL；只写 `NEXT_LOCALE` cookie 并刷新服务端组件。

## 服务端用法

```tsx
import { cookies, headers } from 'next/headers'
import { LOCALE_COOKIE, resolveLocale } from '@sap/app-shared/i18n/config'

const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
const locale = resolveLocale({
  cookie: cookieStore.get(LOCALE_COOKIE)?.value,
  acceptLanguage: headerStore.get('accept-language'),
})
```

## 添加翻译

1. 在 `libs/ui-layout/src/i18n/messages/en.json` 添加键。
2. 在其他语言文件同步。
3. 组件里用 `useTranslation()` / `getTranslations(locale)`。

## 迁移状态

- ✅ Portal / Console 路由已去前缀
- ✅ 旧 `/{locale}/...` 307 兼容
- ✅ `?lang`、`Accept-Language`、cookie 解析
- ✅ 语言切换不再导航
- ✅ 登录、SSO、邀请链接使用稳定路径
- ⏳ 用户 / 组织级偏好：`add-user-and-org-locale-preference`
- ⏳ 文档 SEO（`/[locale]/docs`）：按需另开 change

## 非目标

- 不引入 next-intl
- 不做公开站点 hreflang / 语言专属站点地图
- 不改后端错误文案语言；翻译在前端展示层
