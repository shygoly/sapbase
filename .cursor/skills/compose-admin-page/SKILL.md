---
name: compose-admin-page
description: >-
  Compose new admin/portal pages by reusing sapbase Runtime, ui-kit, and existing
  feature patterns with minimal new code and restrained enterprise aesthetics.
  Use when the user asks for a new page, admin screen, list/detail/form UI,
  dashboard section, or to assemble UI from existing components instead of
  writing from scratch; also when mentioning 拼页面、复用组件、少写代码、
  Runtime、PageRuntime、CollectionRuntime, layout 分栏、订单工作台,
  SaaS、多租户、组织切换、品牌、配额、PiAgent、AI 助手入口、悬浮球, or
  frontend-design-like polish inside this monorepo.
---

# Compose Admin Page (sapbase)

拼装优先于创造。新页面必须优先复用本仓 Runtime / ui-kit / 同类页模式；
只在缺口真实存在时写最小新代码。观感对齐现有管理台，克制美观，禁止营销风 AI slop。

## Skill vs OpenSpec（先读）

| 写进 **本 Skill** | 写进 **OpenSpec** `enhance-ui-runtime-scenario-capabilities` |
|-------------------|--------------------------------------------------------------|
| Agent 当下怎么搜、怎么选、怎么接线 | Runtime/ui-kit **必须提供**的可复用能力与不变量 |
| 布局/模式**选型表**与临时拼法 | 分栏工作台、选中同步、切行未保存等**平台原语**的 MUST |
| **SaaS 台面选型**、复用 Org/App/Brand 壳积木 | 切组织失效、品牌主题、扩展字段、配额条等**平台契约** |
| PiAgent **入口选型**（壳按钮/侧栏 vs 菜单页 vs 球） | PiAgent 当前页上下文面板 MUST；独立页仅辅 |
| 路由/菜单/API 的**操作清单** | 菜单元数据 `componentKey` / `interaction` 契约 |
| 邻页复制结构、import 偏好 | 细粒度权限、虚拟化、format、Error Boundary 等产品能力 |
| 缺口时的降级做法 + 指出应提 OpenSpec | 验收场景（Scenario）与 tasks |

规则：Skill **不发明**第二套平台 API；若某能力尚不存在，按本 Skill 用现有块拼出最小可用页，并在回复中标明「应由 OpenSpec 落地的缺口」。

平台契约真源：`openspec/changes/enhance-ui-runtime-scenario-capabilities/`。  
吸收范围以该 change `design.md` 的「前端规范.md 逐条吸收对照」为准；Skill 不得静默扩大到已拒绝项（AntD 双栈、Marketing 壳、agent 改 libs）。

## When to use

- 新管理页 / Portal 业务页 / 列表·详情·表单 / 单据工作台
- 「尽量复用现有组件」「少写新代码」
- 需要好看但不破坏 ERP 一致性

## Non-goals

- 不引入 Ant Design；不新建第二套 Button/Table/Dialog
- 不用 StandardListPage 等外规范品牌替代 Runtime
- 不让 Agent 旁路改 `libs/*` 核心来「生成页面」；租户行为走蓝图/提议
- 不做 landing 式花活（大渐变、花哨字体、卡片堆砌营销布局）
- 不在 Skill 里规定后端表结构或发布闸门（那是 DOMAIN / release OpenSpec）

## Hard rules

1. **先搜后写**：写任何 UI 前必须 inventory。已有 primitive / Runtime / 同类页则复用。
2. **拼装顺序**：定内容布局 → Schema/model → Runtime 壳 → ui-kit 原子 → 仅业务特有交互可新写。
3. **导入偏好**：
   - Runtime：`@sap/app-shared/components/runtime`
   - 原子 UI：`@sap/app-shared/components/ui/*`
   - 权限/通知：`PermissionGuard`、`useNotification`
   - 路由前缀：`useLocalePrefix`
   - API：`@sap/app-shared/lib/api` 或 `@sap/api-client`
4. **禁止**：硬编码色值；平行实现 Dialog/Table；`window.confirm` 新路径。
5. **破坏性操作**用 `ConfirmDialog`（或 OpenSpec 落地后的统一确认原语）。

## Workflow（必须按序）

### 1) Inventory

```text
Glob: apps/web-console/src/app/**/page.tsx
Glob: apps/web-portal/src/app/**/page.tsx
Grep: PageRuntime|CollectionRuntime|FormRuntime|DetailRuntime|ResizablePanel
Grep: OrgSwitcher|AppSwitcher|BrandConfig|useOrganizationStore|BrandLogo
Grep: PiAgent|piagent|AgentPanel|agent/chat
Grep: from '@sap/app-shared/components/ui
Grep: 相关 api / permission（如 orders:read）
Grep: nav-config|menu|useLocalePrefix|brand-config
```

产出：参考页路径、复用组件、布局候选、缺口（是否仅 Skill 降级 / 需 OpenSpec）。

详见 [reference.md](reference.md)。

### 2) Surface + SaaS 积木（先定台面，再定布局）

本仓是 **B2B 多组织 SaaS**：组织 ≈ 租户边界；应用安装是组织内运行边界（元语 `$C$` / AppInstallation）。
拼页前必须定台面与上下文，禁止在业务页里重造壳级 SaaS 组件。

对齐 OpenSpec「台面三分」（禁止「路径含 `/admin` ⇒ Console」启发式）：

| 台面 | App | 典型内容 | SaaS 约束 |
|------|-----|----------|-----------|
| 租户业务 + **使用框架** | `web-portal`（3050） | 业务单据、蓝图动态页、概览；**用户/角色/部门/本组织菜单/品牌/组织设置/审计** 等租户自助 | 数据与菜单随 **当前组织 + 当前应用** |
| 瘦平台治理 | `web-console`（3060） | 发布/提议/自动化、插件、模块注册、知识库、Agent/AI 治理等 | 平台级能力；**不要**把用户/角色/部门/菜单当 Console 产品面 |
| 蓝图动态页 | portal `apps/[packageId]/…` | 租户业务 CRUD | 优先 Blueprint；勿手写整棵业务树 |
| 域试验样板（非产品面） | 如 portal `shipping/**`、部分船运 settings | 能力/Runtime 验收样板 | **勿**当默认导航正式入口；正式业务走蓝图或批准的领域包 |

**已有基础组件（必须复用，禁止平行实现）**

| 积木 | 位置 | 拼装规则 |
|------|------|----------|
| `OrgSwitcher` | `libs/ui-layout` → sidebar | 只在壳层；业务页 **不要** 再放组织选择器 |
| `AppSwitcher` | 同上 | 随 `currentOrganization`；无组织则不渲染 |
| `useOrganizationStore` | `@sap/shared-state` | 读 `currentOrganization`；切组织后列表/详情必须重取或 remount |
| `BrandConfigProvider` / `BrandThemeApplier` / `BrandLogo` | `app-shared` | 只用 token（`primary` 等）；禁止页内写死品牌色 |
| 品牌配置页 | **Portal** 组织设置区（目标落点）；现状若仍在 console 属迁移债 | 租户自助配置；业务页只消费主题 |
| 权限 | `PermissionGuard` + org 角色 | 前端隐藏 ≠ 后端放行；权限点按组织生效 |
| PiAgent 壳入口 | `ui-layout` / portal 壳（待 OpenSpec 原语） | **当前页侧栏/抽屉**为主；见 §2f |

**SaaS 拼装检查（写页前过一遍）**

1. 台面三分选对了吗？使用框架（用户/角色/部门/菜单/品牌）→ **Portal**；平台治理 → **Console**；航运等样板 → 非产品面。放错 = 架构错误。
2. 是否依赖当前组织？是 → API/query key 必须含 org（或依赖全局拦截器已注入）；`currentOrganization` 变化时刷新。
3. 是否属于某已安装应用？是 → 走 Blueprint / `packageId` 路由，不要做成全局裸页。
4. 是否展示品牌元素？是 → `BrandLogo` / CSS 变量，不要内联 hex。
5. 配额/用量/套餐入口：壳或设置区统一入口；不要每个 List 私自造进度条组件（平台原语见 OpenSpec；未落地则先复用邻页或标缺口）。
6. 扩展字段/自定义列：跟组织元数据，不要写死仅某租户可见的列到公共页。
7. 主从页：行项目随主选中加载；切主或无选中时清从表。
8. **禁止** 新建 `tenant-core` 包或第二套 AntD 主题；上下文用现有 Org/Brand store。
9. 需要 AI 助手时走壳层 PiAgent 入口（§2f），业务页禁止私自再挂一套聊天窗。

### 2a) Static admin vs Blueprint

| 判断 | 选择 |
|------|------|
| 租户使用框架（用户/角色/部门/本组织菜单/品牌/组织设置）或强定制交互 | **静态页优先 `web-portal`**；勿仅因「像管理页」丢进 Console |
| 平台治理（发布/提议/插件/模块/知识库/Agent·AI）或强定制交互 | **静态页 `web-console`** |
| 租户业务实体 CRUD，可由蓝图 list/form/detail 描述 | **优先 Blueprint** 动态路由 / `BlueprintAppRuntime`，勿手写整页 |
| 半定制（蓝图不够） | 蓝图页 + 薄本地插槽；禁止复制一整棵业务树到 apps |

不确定时：问清「是否 Blueprint 实体」与「谁用（租户管理员 vs 平台运营）」；默认使用框架→Portal 静态、平台治理→Console 静态、业务域→蓝图。

### 2b) Content layout（内容区，不是 App 壳）

壳 = `ui-layout` sidebar（已含 Org/App switcher）。下表选**主内容区**：

| 业务形态 | 布局 | 拼法（Skill 降级） |
|----------|------|-------------------|
| 治理 CRUD | List + Dialog/Sheet | `CollectionRuntime` + Dialog；参考 `admin/users` |
| 单据工作台（订单上下对照） | **上下 Stack** | 上列表下详情；选中驱动下方；`ResizablePanelGroup` vertical |
| 重详情对照 | 左右 Master-Detail | horizontal resizable；窄屏 → 独立详情路由 |
| 深链路/可分享 | 独立 Detail 路由 | `/…/[id]` + `DetailRuntime` |
| 主从单据（头+行） | Detail + 从表插槽 / Stack 下方含行表 | 主选中驱动行项目；无主选中行表空态 |
| 多视角 | Tabs | 参考 workflows/plugins |
| 多步创建 | Wizard / 全页 Form | `FormRuntime` |
| 概览 | Dashboard grid | 参考 portal overview |
| 租户自助设置 | Portal 壳/组织设置入口，不进业务 List | 用户/角色/品牌等挂 Portal；勿每页自建设置树，勿默认丢 Console |

订单「上列表 + 下详情」→ **Stack**。

约束：选中高亮 ↔ 详情；分区 `overflow-auto`；窄屏可降级列表→路由；禁止新造 layout 框架。

平台若已提供 Workbench 原语（OpenSpec），优先用原语而非手写 flex。

### 2c) Selection, URL, dirty state

| 议题 | Skill 默认做法 |
|------|----------------|
| 分栏选中谁 | 有分享/刷新需求 → URL `?id=` 或子路由；仅会话内对照 → `useState` 可接受 |
| locale | 一切内部跳转经 `useLocalePrefix()` / `prefix(path)` |
| 切行时详情脏 | 若下方/侧栏有未保存编辑：先 `ConfirmDialog` 或 FormRuntime 离开钩子；无编辑则直接切 |
| 无选中 | 详情区明确空态文案，禁止骨架装有数据 |

OpenSpec 落地后：改用 Runtime 的 selection/dirty 能力，删除页内重复逻辑。

### 2d) Mount: route + menu

新静态页清单：

1. 添加 `app/[locale]/…/page.tsx`（及必要 `loading.tsx` 仅在邻页有时）
2. 若需导航：更新菜单数据源（API 菜单 / seed / `nav-config`——以该 app 现用方式为准，先 Grep）
3. 权限点与后端 `@Auth` / 角色种子对齐；无权限不挂菜单或挂了由 Runtime 拒渲
4. 登录回跳：需要时用 `returnUrl`，且带 locale

### 2e) Data + tri-state + permissions wiring

- 列表：复用邻页的 page/pageSize/search 状态机；错误 `notification.error`；成功轻提示
- **三态**：loading → `TableSkeleton`/既有 skeleton；empty → 短文案+主操作；error → 可重试，勿空白
- 写操作：`PermissionGuard` 包按钮；页面 model 写 `permissions`；前端隐藏 ≠ 后端放行
- 批量：多选 + 确认后再请求；无确认能力时用 `ConfirmDialog`
- i18n：邻页已用 `useTranslation` 则跟；新文案不要硬编码中英混杂一屏（至少与邻页策略一致）

### 2f) PiAgent 入口（当前页为主）

对齐 `docs/protocols/piagent.md`：PiAgent 是业务操作面之一，上下文含 **当前页 / 记录 / 选中项**。

| 入口 | 用途 | 规则 |
|------|------|------|
| **壳层触发 + 侧栏/抽屉**（主） | runtime 答疑、查数、改数（确认令牌） | 叠在当前页打开；带上 org/app/release/选中实体 |
| **顶栏或侧栏固定按钮**（主触发器） | 打开上述面板 | 优先于悬浮球；不遮挡表格主操作区 |
| **悬浮球**（可选增强） | 同打开面板 | 不得作为唯一入口；注意不挡分栏拖拽/主 CTA |
| **菜单独立页**（辅） | 会话历史、Builder 工作台、SSE 联调 | 不得作为 runtime「在这张单上帮我改」的主路径 |

拼装约束：

1. 业务页 **禁止** 再实现第二套 Chat/Agent 浮层。
2. 需要把选中行交给助手时：经壳上下文（或 OpenSpec 落地后的 Context 挂钩），不要 `window.open` 到无上下文的 `/piagent`。
3. 现有 `/dashboard/piagent` 整页视为联调/辅入口，新功能默认接到壳层面板。
4. 写操作确认 UI 跟 PiAgent 协议（确认令牌），不要用裸 `window.confirm`。

### 3) Scaffold thinly

- 薄 page + `./components/*` 只放业务列/对话框内容
- 组件必须基于 ui-kit
- 图标：`lucide-react`

### 4) Aesthetics（克制）

- Token only：`bg-background`、`text-muted-foreground`、`border`、`primary`
- 一页一主标题 + 一句说明；一个 primary 主操作
- `p-6` / `space-y-6`；表格密度优先
- 微交互可有；禁渐变网格/营销三列 card/AI slop 字体配色

### 5) Self-check

- [ ] 台面三分正确（使用框架→Portal；平台治理→Console；样板≠产品面）；SaaS 积木复用壳层，未重造 Org/App/Brand（§2）
- [ ] 切组织/切应用后数据会刷新；无写死品牌色
- [ ] PiAgent 走壳层当前页面板，未在业务页私挂聊天窗（§2f）
- [ ] 布局已按 §2b 选型，不是误用 Dialog 当工作台
- [ ] 选中态/URL/脏切行已处理（§2c）
- [ ] 路由+菜单+权限点已挂（§2d）
- [ ] 三态与 notification 齐全（§2e）
- [ ] 无重复 primitive；无 antd；无新建 tenant-core
- [ ] 静态 vs 蓝图选择合理（§2a）
- [ ] 若用了手写分栏/脏检查/配额条/Agent 浮层，已注明 OpenSpec 缺口

## Minimal template（列表 + Dialog）

见邻页 users（现状多在 console，**新页落 Portal 使用框架区**）；优先复制结构，替换 API、model、列、权限点。

Stack 工作台：上 `CollectionRuntime` 列表，下详情面板（只读字段 + 操作），`selectedId` 与 URL 同步策略按 §2c。

## Examples

**User：** 「订单页上面列表下面详情」  
**Agent：** §2b → Stack；§2c → `?id=`；inventory 订单 API；拼装；脏切行确认；说明 Workbench 原语若未落地则手写 resizable。

**User：** 「加标签管理」  
**Agent：** 治理 CRUD → List+Dialog；对齐 users/departments。
