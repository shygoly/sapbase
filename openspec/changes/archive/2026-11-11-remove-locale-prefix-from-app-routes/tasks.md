# Tasks

> 状态：已实现并通过 6.x 验收。7.x 为发布后跟踪项，不在本 change 的完成范围内。

## 1. 契约与基础

- [x] 1.1 评审并批准 `locale-resolution` delta（解析顺序、cookie 名、docs 策略）
- [x] 1.2 实现 `resolveLocale(cookies, headers)` 与 `negotiateLocale(acceptLanguage)`
- [x] 1.3 定义 `NEXT_LOCALE` 常量、cookie 写入 helper 与一次性 `localStorage.locale` 迁移
- [x] 1.4 预留用户 / 组织偏好接入位（空实现 + 注释指向后续 change）

## 2. 中间件

- [x] 2.1 `apps/web-portal/src/middleware.ts`：旧前缀 307、`?lang` 处理、cookie 写入
- [x] 2.2 `apps/web-console/src/middleware.ts`：同上
- [x] 2.3 matcher 排除 `_next` / `api` / `plugins` / `images` / `favicon.ico` / `robots.txt` / `sitemap.xml`
- [x] 2.4 单测：`/`、`/en`、`/en/`、`/zh/admin/users?x=1`、`?lang=ja`、非法 `?lang`、静态资源

## 3. Portal 迁移（PR 1）

- [x] 3.1 `git mv apps/web-portal/src/app/[locale]/* apps/web-portal/src/app/`
- [x] 3.2 合并 `[locale]/layout.tsx` 的 provider 到根 layout；`<html lang>` 改为解析结果
- [x] 3.3 删除 `generateStaticParams` 与 `params.locale` 依赖
- [x] 3.4 `/` 跳转改为 `/dashboard/overview`
- [x] 3.5 登录默认跳转、`returnUrl`、SSO callback 改为稳定路径
- [x] 3.6 删除 portal `next.config.ts` 的临时 redirects（由 middleware 接管）
- [x] 3.7 旧 `/en/dashboard/*`、`/en/docs/*` 307 验证

## 4. Console 迁移（PR 2）

- [x] 4.1 `git mv apps/web-console/src/app/[locale]/* apps/web-console/src/app/`
- [x] 4.2 合并 provider 到根 layout；`<html lang>` 动态化
- [x] 4.3 删除 `generateStaticParams` 与 `params.locale` 依赖
- [x] 4.4 `/` 跳转改为 `/admin/releases`
- [x] 4.5 登录默认跳转、`returnUrl`、SSO callback 改为稳定路径
- [x] 4.6 删除 console `next.config.ts` 的临时 redirects
- [x] 4.7 旧 `/en/admin/*` 307 验证

## 5. 客户端与清理（PR 3）

- [x] 5.1 `I18nProvider` 去掉本地 locale state，直接使用服务端 locale / messages
- [x] 5.2 `useLocale` 只读 context；`useSetLocale` 写 cookie + `router.refresh()`，不导航
- [x] 5.3 删除 `useLocalePrefix` / `getLocalePrefix`，清理 18 处调用
- [x] 5.4 删除 `libs/app-shared/src/lib/locale-path.ts` 与 `withLocalePath` 调用
- [x] 5.5 移除登录页 / SSO 回调上的 `data-theme='sapbase'` 临时挂载（provider 已上移后复核）
- [x] 5.6 删除 `localStorage.locale` 作为运行时真源的读取
- [x] 5.7 更新 `I18N_SUMMARY.md`、`docs/ARCHITECTURE.md` 的 i18n 小节

## 6. 验收

- [x] 6.1 `npx tsc --noEmit -p apps/web-portal/tsconfig.json`
- [x] 6.2 `npx tsc --noEmit -p apps/web-console/tsconfig.json`
- [x] 6.3 `npx tsc --noEmit -p libs/app-shared/tsconfig.json`
- [x] 6.4 `npx eslint <changed files>`
- [x] 6.5 `npm run build:web`
- [x] 6.6 Playwright：Portal / Console 登录后路径稳定，无 404
- [x] 6.7 Playwright：语言切换 URL 不变、刷新保持、首屏不闪
- [x] 6.8 Playwright：旧 `/{locale}/...`、`?lang=`、非法 `?lang`、`Accept-Language`
- [x] 6.9 Playwright：SSO 回调与邀请链接回跳
- [x] 6.10 `openspec validate remove-locale-prefix-from-app-routes --strict`
- [x] 6.11 `npm run meta:openspec-ledger` 并提交台账变更

## 7. 发布后跟踪（不在本 change 完成范围）

以下为上线后的运维/后续 change，需要真实流量与时间窗口，因此不作为本次实现的验收项：

- 观察一个发布周期内的 307 命中与 404。
- 删除 307 兼容层，另开 cleanup change。
- 启动后续 `add-user-and-org-locale-preference`。
- 如需 docs SEO，启动 `add-localized-docs-routes`。
