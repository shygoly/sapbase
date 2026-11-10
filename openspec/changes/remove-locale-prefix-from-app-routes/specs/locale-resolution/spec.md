## ADDED Requirements

### Requirement: Request-Scoped Locale Resolution

系统 SHALL 在每次请求解析 locale，优先级为：合法 `?lang` 覆盖 → `NEXT_LOCALE` cookie → `Accept-Language` → `defaultLocale`。已登录用户偏好与组织默认语言在后续能力落地后 MUST 插入 cookie 之前，解析入口 MUST 保持单一。locale MUST NOT 作为构建期静态配置；配置只提供支持列表与默认值。非法 `?lang` MUST 被忽略，且 MUST NOT 改变已有偏好。

#### Scenario: 首次访问按浏览器语言

- **WHEN** 请求不带 `NEXT_LOCALE` cookie
- **AND** `Accept-Language` 为 `zh-CN,zh;q=0.9`
- **THEN** 页面 SHALL 以 `zh` 渲染
- **AND** URL MUST NOT 包含 locale 段

#### Scenario: 显式覆盖

- **WHEN** 请求 `/dashboard/overview?lang=ja`
- **THEN** 本次请求 SHALL 以 `ja` 渲染
- **AND** 系统 SHALL 写入 `NEXT_LOCALE=ja`
- **AND** SHALL 307 到不带 `lang` 的 `/dashboard/overview`

#### Scenario: 非法覆盖参数

- **WHEN** 请求 `/dashboard/overview?lang=xx`
- **THEN** 系统 SHALL 忽略 `xx` 并按既有偏好渲染
- **AND** MUST NOT 写入非法 cookie

### Requirement: Locale-Agnostic App Routes

应用路由 MUST NOT 包含 locale 段。内部链接、重定向、SSO 回跳、邀请链接 MUST 使用稳定路径。语言切换 MUST NOT 改变当前 URL。

#### Scenario: 旧前缀链接

- **WHEN** 访问 `/en/admin/users?page=2`
- **THEN** 系统 SHALL 307 到 `/admin/users?page=2`
- **AND** 查询参数 MUST 保留

#### Scenario: 切换语言

- **WHEN** 用户在 `/dashboard/overview` 把语言切到 `ja`
- **THEN** URL SHALL 保持 `/dashboard/overview`
- **AND** 刷新后页面内容 SHALL 仍为 `ja`

### Requirement: Locale Preference Persistence

语言偏好 SHALL 持久化到 `NEXT_LOCALE` cookie：`Path=/`、`SameSite=Lax`、`Max-Age=31536000`；生产环境 MUST 带 `Secure`。服务端首屏 locale MUST 与客户端一致；MUST NOT 依赖 `localStorage` 作为唯一真源。

#### Scenario: 刷新保持

- **WHEN** 用户切到 `zh` 后刷新页面
- **THEN** 页面 SHALL 仍为 `zh`
- **AND** 首屏 MUST NOT 先以默认语言渲染再切换

#### Scenario: 服务端与客户端一致

- **WHEN** 服务端按 `NEXT_LOCALE=ja` 渲染 HTML
- **THEN** 客户端首次渲染 MUST 使用同一 locale
- **AND** MUST NOT 出现 hydration 不一致

### Requirement: Auth and Callback Locale Independence

登录默认跳转、`returnUrl`、SSO `pending.returnUrl`、邀请链接 MUST NOT 携带 locale 前缀；登录成功后的落点 SHALL 由调用方显式给出，且 MUST 是稳定路径。

#### Scenario: SSO 回跳

- **WHEN** SSO 回调携带 `returnUrl=/admin/users`
- **THEN** 登录完成后 SHALL 进入 `/admin/users`
- **AND** MUST NOT 返回 404

#### Scenario: 登录默认跳转

- **WHEN** 用户在 Portal 登录且没有 `returnUrl`
- **THEN** SHALL 进入 `/dashboard/overview`
- **AND** 在 Console 登录 SHALL 进入 `/admin/releases`

### Requirement: Legacy URL Compatibility

旧 `/{locale}/{app-path}` SHALL 307 到 `/{app-path}`，至少保留一个发布周期；`/{locale}` SHALL 307 到 `/`；middleware MUST NOT 拦截 `/_next`、`/api`、`/plugins`、`/images`、`/favicon.ico`、`/robots.txt`、`/sitemap.xml`。

#### Scenario: 旧书签

- **WHEN** 用户打开 `/zh/dashboard/overview`
- **THEN** 系统 SHALL 307 到 `/dashboard/overview`
- **AND** 本次请求 SHALL 以 `zh` 渲染

#### Scenario: 静态资源

- **WHEN** 浏览器请求 `/_next/static/...` 或 `/api/...`
- **THEN** 请求 MUST 原样通过
- **AND** MUST NOT 发生 locale 重定向

#### Scenario: 根路径

- **WHEN** 用户打开 `/en`
- **THEN** 系统 SHALL 307 到 `/`
- **AND** 不得产生重定向循环
