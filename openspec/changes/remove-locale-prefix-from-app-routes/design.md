## Context

当前国际化是 `[locale]` 动态段 + 手写前缀工具，不是 next-intl：

- server 从 `params.locale` 读；client 从 `localStorage` 读；根入口又写死 `/en`；
- `getLocaleFromHeaders()` 存在但未接线；
- 语言切换通过替换 URL 第一段完成；
- 105 个路由文件挂在 `[locale]` 下，18 处手动拼前缀。

这带来三类持续成本：

1. **链接正确性**：每个 `Link` / `router.push` / `returnUrl` / SSO 回跳都必须记得加前缀；
2. **双真源**：URL 与 `localStorage` 可能不一致，首屏存在中英闪烁风险；
3. **路由噪音**：所有页面都在 `[locale]` 下，根 layout 无法直接承载登录页与邀请页的 provider。

sapbase 的登录后区域是纯 B2B 控制台，不需要按语言做 SEO。locale 应跟用户走，而不是跟 URL 走。

## Goals / Non-Goals

### Goals

- 应用路由稳定：`/dashboard/overview`、`/admin/users`，不再出现 locale 段。
- locale 按请求解析并持久化，服务端与客户端一致。
- 登录、SSO、邀请、邮件链接不再需要感知 locale。
- 旧 URL 平滑过渡，保留一个发布周期。
- 删除前缀工具与所有手动拼接。

### Non-Goals

- 不引入 next-intl 或新的 i18n 框架。
- 不做公开站点的 hreflang / SEO / 语言专属站点地图。
- 不改 API 错误文案的语言；后端仍返回单一语言，翻译在前端展示层。
- 不在本 change 增加用户表 / 组织表字段。

## Decisions

### 1. 解析顺序与位置

```
合法 ?lang 覆盖
  → 已登录用户偏好（后续 change 接入）
  → 组织默认语言（后续 change 接入）
  → NEXT_LOCALE cookie
  → Accept-Language
  → defaultLocale
```

本 change 实现 1、4、5、6；2、3 预留函数签名与调用位，由
`add-user-and-org-locale-preference` 填充。

解析发生在根 layout，只读 `cookies()` 与 `headers()`，**不做 DB 查询**。
用户 / 组织偏好由登录与个人设置写入 cookie，cookie 是请求时的“已物化偏好”，
避免每个 RSC 请求多一次用户表查询。

### 2. Cookie

| 项 | 值 |
|---|---|
| 名称 | `NEXT_LOCALE` |
| Path | `/` |
| Max-Age | 31536000（一年） |
| SameSite | `Lax` |
| HttpOnly | 否（语言切换器直接写；影响面仅语言） |
| Secure | 生产开启 |

选择 `NEXT_LOCALE` 是为了与 next-intl 生态兼容，未来若引入框架可平滑迁移。
现有 `localStorage.locale` 仅作为一次性迁移来源：首次读取后写入 cookie，随后不再读取。

### 3. 路由迁移

- `apps/web-portal/src/app/[locale]/**` → `apps/web-portal/src/app/**`
- `apps/web-console/src/app/[locale]/**` → `apps/web-console/src/app/**`
- 并行路由 `@sales` / `@area_stats` / `@bar_stats` / `@pie_stats` 随目录整体移动，slot 名不变。
- 删除 `generateStaticParams` 与所有 `params.locale` 依赖。
- `/[locale]/layout.tsx` 的 provider 合并进根 layout：
  - 根 layout 读 locale，设置 `<html lang={locale}>`；
  - `AppProviders` 包住全部路由，登录 / SSO / 邀请页因此也获得 i18n、主题与通知上下文；
  - 这允许后续移除登录页上的 `data-theme='sapbase'` 临时挂载。

### 4. Provider 与语言切换

- `I18nProvider` 去掉 locale 的本地 state，直接使用服务端传入的 `locale` 与 `messages[locale]`。
- `useLocale()` 只读 context，不再从 pathname 猜测。
- `useSetLocale()`：
  1. 写 `NEXT_LOCALE` cookie；
  2. `localStorage.setItem('locale', ...)` 仅作兼容读；
  3. `router.refresh()`。
  **不调用 `router.push`**，URL 不变。
- 这样刷新后服务端直接按新 cookie 渲染，不存在“先英文再中文”的闪烁。

### 5. 中间件

两个 app 各一个 middleware，职责固定：

1. 第一段是合法 locale → 307 到去掉该段的路径，并把该 locale 写入 cookie（保留旧链接意图）。
2. 存在合法 `?lang` → 写 cookie，307 到去掉 `lang` 的同一路径（保留其他 query）。
3. 其余请求放行。

matcher 排除：

```
/_next/*  /api/*  /plugins/*  /images/*  /favicon.ico  /robots.txt  /sitemap.xml
```

不使用 `next.config.redirects()`，因为它无法同时处理 `?lang` 与动态 cookie。

### 6. 旧 URL 兼容

- `/{locale}/...` → 307 `/{...}`，保留 path / query。
- `/{locale}` → 307 `/`。
- 使用 307（临时）而不是 301，保证回滚与后续 SEO 策略调整。
- 保留至少一个发布周期，之后单独删除。

### 7. 公开文档

本 change 将 `/docs` 一并去前缀，保持同一 app 只有一套规则。
若后续需要 SEO，新增 `add-localized-docs-routes`，只对 `/docs` 引入 `/[locale]`，
不影响应用区。

### 8. 分阶段迁移

两个 app 共享 hook，因此需要窗口期兼容：

1. **PR 1 · Portal**：路由上移、根 layout 合并、middleware、登录 / SSO 改稳定路径；
   共享 hook 同时支持“路径里还有 locale”和“cookie 模式”。
2. **PR 2 · Console**：同样迁移；完成后删除双模式分支。
3. **PR 3 · 清理**：删除 `useLocalePrefix` / `getLocalePrefix` / `withLocalePath`、
   旧 `next.config` redirects、`localStorage` 读取、文档更新。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 105 个文件移动破坏相对 import / 并行路由 | 先 `git mv` 再跑 `tsc` + `next build`；并行路由目录整体移动 |
| 根 layout 读 `cookies()` 使全站动态 | 应用本来就是动态；docs 若需静态，后续单独拆 route group |
| 中间件重定向循环 | 单测覆盖 `/`、`/en`、`/en/`、带 query、静态资源、RSC 预取 |
| 旧链接覆盖不全（邮件 / 工单） | 入站 307 覆盖一个版本；出站模板统一改为稳定路径 |
| 旧 URL 的 locale 覆盖用户偏好 | 307 时写入 URL 的 locale，仅迁移期接受；文档记录 |
| 语言偏好跨设备不同步 | 由后续 `add-user-and-org-locale-preference` 解决 |
| docs SEO 丢失 | 本次接受；需要时单独 change |
| 双模式窗口期复杂度 | 明确窗口只跨两个 PR，PR 3 删除分支并加测试防回归 |

## Migration Plan

1. 合并本 proposal，确认解析顺序、cookie 名、docs 策略。
2. PR 1：Portal 迁移 + middleware + 登录 / SSO 回跳；旧 `/en/dashboard/*` 307。
3. PR 2：Console 迁移 + middleware；旧 `/en/admin/*` 307。
4. PR 3：删除前缀工具、双模式分支、`localStorage` 真源与旧 redirects；更新文档。
5. 验收：两 app 登录、语言切换、刷新、旧 URL、`?lang`、`Accept-Language`、
   SSO 回调、邀请链接、静态资源不被拦截。
6. 一个发布周期后删除 307 兼容层。

## Open Questions

无。已确认：

- cookie 名用 `NEXT_LOCALE`；
- docs 本次一并去前缀；
- 用户 / 组织偏好拆后续 change。
