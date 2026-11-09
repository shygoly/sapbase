# Change: PiAgent 悬浮入口 — 用法答疑 + 代操确认

## Why

租户与平台用户需要在**当前页**问「怎么用」或让 AI **帮忙完成操作**，而不是离开业务屏去翻文档或自己点完整表单。
现有 PiAgent 协议已有会话 / 工具网关 / 写确认令牌；`enhance-ui-runtime-scenario-capabilities`
已规定壳层当前页面板与「悬浮球非唯一入口」。缺口是把悬浮球（及同面板）产品化成两条清晰意图：
**帮助理解** vs **协助执行**，并保证写操作仍走确认令牌。

## What Changes

- **ADDED** `piagent-contextual-assistant`：壳层助手产品契约。
  - 悬浮球 MAY 作为打开同一当前页面板的触发器；MUST NOT 作为唯一入口（固定壳按钮仍 MUST）。
  - 面板 MUST 支持两类意图（可用空态快捷提示区分）：
    1. **用法 / 导航答疑**（只读）：基于已发布知识与当前页上下文解释「如何使用 / 为何灰显 / 去哪配置」。
    2. **协助操作**：经 `contracts/tools.json` 工具面查数或起草写操作；写操作 MUST 先出确认卡，
       再消费平台签发的确认令牌；MUST NOT 静默写业务数据。
  - 打开面板时 MUST 注入 org / app / release / 当前路由 / 选中实体等上下文芯片（可移除）。
  - 业务页 MUST NOT 再私挂第二套聊天浮层；独立 `/piagent` 页仍仅为历史 / Builder / 联调。
- **依赖**：`docs/protocols/piagent.md`；壳面板原语见
  `enhance-ui-runtime-scenario-capabilities`（PiAgent Contextual Shell Entry）。
- **非目标**：替换工具网关；让模型绕过确认令牌；把悬浮球做成唯一入口；营销风「全权接管」无确认自动化。

## Impact

- 新增能力：`piagent-contextual-assistant`
- 受影响实现（实现阶段）：
  - `libs/ui-layout` 壳层悬浮球 + 侧栏/抽屉面板
  - Portal / Console 布局挂载（两台面同一套入口组件）
  - 既有 `/agent/*` SSE、确认令牌 UI、知识检索（`pi_help_search` 等）
- 配套：`.cursor/skills/compose-admin-page/` §2f 保持「壳入口为主、禁业务页私挂」；
  本 change 补齐「帮助 vs 代操」产品场景。
