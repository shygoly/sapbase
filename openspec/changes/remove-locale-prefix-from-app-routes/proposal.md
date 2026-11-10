# Change: 移除应用路由的 locale 前缀

## Why

Portal / Console 的 locale 现在放在 URL 第一段（`/en/dashboard/overview`、`/zh/admin/users`），
但这是手写路由段，不是 next-intl：

- `[locale]` 下共有 **105** 个路由文件（portal 44 + console 61）；
- **18** 处手动 `useLocalePrefix()` / `getLocalePrefix()` 拼接；
- **3** 处硬编码 `/en`；
- `getLocaleFromHeaders()` 已实现，但**全仓 0 处调用**，`Accept-Language` 实际未生效；
- 语言切换靠替换 URL 第一段 + `router.push`；
- locale 同时存在于 URL（服务端）、`localStorage`（客户端）和写死的入口跳转里。

这套结构把“语言”变成了“链接的一部分”：任何 `router.push`、SSO 回跳、邀请链接、邮件链接
或外部回调漏加前缀就会 404。最近登录后跳 `/admin/users` 的 404 就是这一类问题，不是一次性 bug。

sapbase 是登录后的 B2B 控制台：页面不需要被搜索引擎按语言索引，链接基本只在同一组织内流转。
locale 是**用户偏好**，不是**内容属性**。URL 前缀在这里收益接近于零，维护税却落在每个链接上。

## What Changes

- **ADDED** `locale-resolution`：请求级 locale 解析与持久化。
  - 解析顺序：合法 `?lang` → `NEXT_LOCALE` cookie → `Accept-Language` → `defaultLocale`。
  - 应用路由不带 locale 段；语言切换不导航。
  - 服务端首屏与客户端一致，不再以 `localStorage` 作为唯一真源。
- **REMOVED** Portal / Console 的 `[locale]` 路由段（105 个文件整体上移）。
- **REMOVED** `useLocalePrefix()` / `getLocalePrefix()` 的路径拼接职责（18 处调用）。
- **REMOVED** 硬编码 `/en` 入口跳转与 `withLocalePath()` 临时补丁。
- **MODIFIED** 根 layout：合并 `[locale]/layout` 的 provider，`<html lang>` 由解析结果决定；
  登录页、SSO 回调、邀请页因此也获得同一套 i18n 与主题上下文。
- **MODIFIED** 登录默认跳转、`returnUrl`、SSO `pending.returnUrl`、邀请链接：一律使用稳定路径。
- **MODIFIED** middleware：旧 `/{locale}/...` 307 去前缀，`?lang` 写 cookie 后 307 去参数；
  静态资源与 API 不参与。
- **DEFERRED** 用户 / 组织级语言偏好（`users.locale`、`organizations.default_locale`、
  登录写 cookie、个人设置页）拆到后续 change `add-user-and-org-locale-preference`；
  本 change 预留解析入口与优先级槽位。
- **NON-GOALS**：不引入 next-intl；不做公开站点 hreflang/SEO；不改后端错误文案语言；
  不做营销页多语言。
- **BREAKING**：旧 `/{locale}/...` 应用链接会 307 到无前缀路径；保留一个发布周期。

## Impact

- 受影响规格：`locale-resolution`（新增）
- 受影响代码：
  - `apps/web-portal/src/app/[locale]/**`（44 文件）
  - `apps/web-console/src/app/[locale]/**`（61 文件）
  - 两个 `app/[locale]/layout.tsx` 合并进根 layout
  - `apps/web-portal/src/middleware.ts`、`apps/web-console/src/middleware.ts`（新增）
  - `libs/ui-layout/src/hooks/use-locale.ts`
  - `libs/app-shared/src/i18n/hooks/use-locale.ts`
  - `libs/app-shared/src/components/i18n/i18n-provider.tsx`
  - `libs/app-shared/src/components/i18n/language-switcher.tsx`
  - `libs/app-shared/src/lib/locale-path.ts`（删除）
  - 两个 `login/page.tsx`、两个 `login/sso/callback/page.tsx`
  - 两个 `next.config.ts` 的临时 redirects
- 文档：`I18N_SUMMARY.md`、`docs/ARCHITECTURE.md` 的 i18n 小节、`docs/OPENSPEC_CHANGES.md`。
- 依赖 / 后续：
  - `add-user-and-org-locale-preference`（用户 / 组织偏好）
  - `add-localized-docs-routes`（若文档需要 SEO，再单独加 `/[locale]/docs`）
- 迁移与回滚：
  - 旧 URL 307 保留一个版本；回滚时恢复 `[locale]` 目录与 middleware 即可。
  - 两个 app 可分 PR 迁移；共享 hook 在窗口期同时支持“URL 模式”和“cookie 模式”。
- 风险：105 个文件移动、并行路由、根 layout 动态化、cookie 与旧链接的优先级、
  出站邮件中的旧链接只覆盖入站重定向。
