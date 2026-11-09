# Change: 重做 Portal / Console 登录页观感

## Why

`web-portal` 与 `web-console` 登录页目前几乎同构，且视觉偏「蓝紫渐变居中卡片 + 开发态
测试账号下拉」，不符合 B2B 管理台应有的克制可信感，也难以让用户分辨 3050 / 3060 台面。
需要在**不改登录业务语义**（邮箱密码、多组织选择、`returnUrl`、权限灌入）的前提下重做布局与视觉，
并与 ui-kit token / 品牌能力对齐。

## What Changes

- **ADDED** `auth-login-ui`：登录表面观感与台面辨识契约。
  - Portal / Console **共用一套登录布局组件**（逻辑可抽到 `app-shared` 或 `ui-layout`），
    用产品名 / 副文案 / 轻量标识区分台面，MUST NOT 复制两套互漂的 JSX。
  - 布局采用 **单栏表单为主**（B2B 默认可扫）；可选第二栏仅承载品牌/产品说明，
    MUST NOT 堆营销三列卡、大面积玻璃拟态或紫靛渐变装饰。
  - 样式 MUST 走设计 token（`bg-background`、`primary` 等）；禁止硬编码蓝紫渐变底。
  - 开发态测试账号快捷填充 MAY 保留，但 MUST 仅非生产可见，且不得压过正式主表单层级。
  - 组织选择、错误提示、加载态、locale/`returnUrl` 行为 MUST 保持现有语义。
- **调研依据**：见本 change `design.md`（deepseek_search：B2B login 2026 + shadcn admin auth）。
- **非目标**：上 SSO/Passkey 全套（可后续独立 change）；改 JWT/后端鉴权；做 Marketing 落地页。

## Impact

- 新增能力：`auth-login-ui`
- 受影响代码（实现阶段）：
  - `apps/web-portal/src/app/login/page.tsx`
  - `apps/web-console/src/app/login/page.tsx`
  - 可能新增共享 `LoginSurface` / `AuthShell` 于 `libs/app-shared` 或 `libs/ui-layout`
- 对齐：`.cursor/skills/compose-admin-page` 克制美学；台面三分仅作文案/标识区分，不改变认证 API。
