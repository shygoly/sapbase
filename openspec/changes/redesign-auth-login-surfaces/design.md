## Context

现状两登录页：`bg-gradient-to-br from-blue-50 to-indigo-100` + 居中卡片 + 测试用户 Select，
Portal/Console 几乎无法区分。认证流（login → 可选选组织 → 写 store → `returnUrl`）可保留。

## Deepseek 调研摘要（选型依据）

来源要点（2025–2026 B2B / shadcn admin）：

1. **B2B 登录宜「无聊且可信」**（Cieden *Login page best practices*）：少装饰、少决策；
   单栏表单优先；第二栏仅用于品牌或必要公告，否则删掉。
2. **Identifier + 明确错误**：校验在 blur/submit；文案可行动；不泄露账号是否存在（现有若已模糊可保持）。
3. **多租户**：主题用 token（logo / primary）；我们已有 Brand/Org 体系，登录页先做产品级
   台面标识，组织品牌可后置（登录前可能尚无 org 主题）。
4. **shadcn admin 模板共性**：Auth 独立 layout、light/dark token、表单组件复用；
   避免 ThemeForest 向「Galaxy / 玻璃拟态」营销皮肤——与本仓 skill「禁营销 AI slop」一致。
5. **不采纳为本里程碑**：强制 SSO/Passkey 主路径（企业需要但属身份提供方 change）；
   重紫霓虹 AI 风；Portal/Console 两套完全不同的插画系统。

## Goals / Non-Goals

### Goals

- 一张可复用登录表面 + 台面 variant（portal | console）。
- 视觉克制、token 化、移动端单栏可用。
- 开发快捷账号不抢主层级。

### Non-Goals

- SSO / Passkey / 找回密码完整产品化（可列后续）。
- 登录后壳层 redesign。
- 为登录页引入 AntD 或新图标库。

## Decisions

1. **布局**：桌面可用「左品牌说明 | 右表单」或「居中单栏 + 顶区产品名」；窄屏一律单栏堆叠。
   推荐默认：**居中单栏 + 清晰产品标题**（实现成本低、B2B 更稳）；若需更强品牌再开可选 split。
2. **台面区分**：标题/副文案不同（如「租户工作台」vs「平台治理台」）+ 可选小 badge；配色仍同一 token 体系。
3. **抽共享组件**：`LoginSurface` 收表单与组织选择；app 页只传 `surface` 与登录成功跳转默认值。
4. **测试账号**：`process.env.NODE_ENV !== 'production'` 或显式 `NEXT_PUBLIC_LOGIN_FIXTURES=1` 时显示；生产隐藏。
5. **图标**：Lucide；按钮/Input/Label 用现有 ui-kit。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 抽共享时漏掉某一 app 的跳转差异 | variant 传入 `defaultRedirect` |
| 去掉渐变后被认为「太素」 | 用细 border / 适度 `muted` 背景纹理，不用高饱和渐变 |
| 测试账号隐藏导致本地不便 | 非生产保留，文档写明开关 |

## Migration Plan

1. 落地共享 `LoginSurface` + token 化样式。
2. Portal / Console 改为薄包装。
3. 人工验收：登录、选组织、错误、returnUrl、两台面文案可辨。
