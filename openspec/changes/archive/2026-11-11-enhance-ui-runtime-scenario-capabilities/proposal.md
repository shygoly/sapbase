# Change: 增强 UI Runtime 场景能力（吸收前端规范精华）

## Why

仓库根目录 `前端规范.md` 描述了一套「Nx + Standard*Page + AntD/Shadcn 双栈 +
tenant-core + agent-bridge 改代码」的目标蓝图。对照现状后结论是：

- **不宜整包切换**：会与已落地的 Runtime-First（`PageRuntime` /
  `CollectionRuntime` / `FormRuntime` / Blueprint UI 消费）、发布/Agent 元语
  （变更只到蓝图层、不造第二条代码路径）冲突。
- **应吸收高/中优先能力**：把规范中的场景能力、细粒度权限、元数据交互标识、
  虚拟化、格式化、租户定制深化、Error Boundary / 长事务确认，收敛进现有
  `libs/ui-runtime` + `libs/ui-kit` + `libs/app-shared`，而不是另起 Standard*Page /
  AntD 双栈 / marketing 应用壳。

本变更只固化「吸收清单」为可验收契约，不引入规范中的否决项。

## What Changes

- **ADDED** `ui-runtime`（新能力）：前端 Runtime 场景能力与元数据适配契约。
  - Runtime 默认能力包：标准查询区、批量操作 + 二次确认、分页/空态/错误态、
    详情 Timeline / 操作痕迹、表单草稿与离开防误触。
  - 细粒度权限上收：按钮级 / 字段级 / 行级可见性由 Runtime 统一拦截渲染。
  - 菜单与页面元数据 MUST 可携带 `component` 映射与交互标识
    （如 `pagination`、`confirm`），供 Runtime 零缝隙挂载。
  - AI / Agent 边界：只允许经蓝图/提议演进页面行为；MUST NOT 经旁路直接改
    `libs/` 或 App 壳生产代码。
  - 中优先增强：data-table 虚拟化阈值策略、统一 DateTime/Currency/Unit 格式化管道、
    品牌/扩展字段定制深化、布局级 Error Boundary 与长事务确认标配。
  - **工作台原语（补强）**：可复用的上下 Stack / 左右 Master-Detail 分栏容器；
    选中实体与 URL 同步约定；分栏内详情脏数据切换确认。
  - **三态默认**：Collection/Detail 的 loading / empty / error 插槽与默认呈现。
  - **SaaS 台面三分（纠正）**：
    - `web-portal`（3050）= 租户业务 + **租户组织管理/使用框架**
      （用户、角色、部门、本组织菜单、品牌、组织设置等）；
    - `web-console`（3060）= **瘦平台治理**
      （发布/提议/自动化、插件、模块注册、知识库、Agent/AI 治理等）；
    - MUST NOT 仅因路径含 `/admin` 就把使用框架归到 3060；
    - 航运 `shipping/**` 及船运 system-settings 为**试验样板**，非正式产品台面。
  - **SaaS 上下文（补强）**：切组织/切应用后数据失效；品牌/扩展字段走现有 Org/Brand
    （不新建 `tenant-core`）；可选配额原语；租户自助入口收敛到 **Portal**。
  - **主从表（补强）**：Detail/工作台支持主实体 ↔ 行项目随选中加载，禁止陈旧从表。
  - **PiAgent 入口（补强）**：壳层当前页侧栏/抽屉为主；固定按钮为主触发器；悬浮球可选非唯一；
    菜单独立页仅历史/Builder/联调；业务页禁止私挂聊天窗。
  - **侧栏菜单图标（补强）**：`UnifiedSidebar` 用 **Lucide**（`lucide-react`）整套替换现有
    emoji `iconMap`；`menu_items.icon` key 与 Lucide 组件映射须覆盖 seed 全量
    （含 `home` / `rocket` / `git-pull-request` / `zap` / `book` / `eye` / `cog` 等缺口）；
    MUST NOT 混用 Tabler/Phosphor 等第二套库；未知 key 降级为中性占位，禁止裸 `•`/emoji 混搭。
  - **吸收对照**：`design.md` 含对 `前端规范.md` 全文逐条「吸收 / 拒绝 / 外置 / 暂缓」表，防增量补洞再漏章。
- **分工**：Agent 拼页操作流程见项目 skill
  `.cursor/skills/compose-admin-page/`（台面选型、Org/App/Brand 复用、接线、降级拼法）。
  本 change 只规定平台 MUST 提供的能力，不规定某个业务页怎么写。
- **非目标（明确拒绝吸收）**：
  - Ant Design 作为默认双栈
  - 新建 `StandardListPage` / `StandardDetailPage` / `StandardFormPage` 品牌替代 Runtime
  - 重命名为 `admin-web` / `marketing-web` 或新建 `tenant-core` /
    `scenario-components` / `shared-domain` 目录宗教
  - Marketing 域平移范例
  - `agent-bridge` 直接生成或修改前端 features/libs 代码
  - 把具体业务页（如某订单页）的文案/列定义写进本 spec
  - 在业务页平行实现第二套 Org/App 切换器或品牌主题引擎

## Impact

- 新增能力：`ui-runtime`
- 受影响实现（实现阶段）：
  - `libs/ui-runtime`（能力包、权限拦截、Workbench、selection/dirty、三态、Error Boundary 挂载点）
  - `libs/ui-kit`（data-table 虚拟化、format 管道、resizable 工作台封装）
  - `libs/app-shared` / `libs/ui-layout`（布局 Error Boundary、二次确认、品牌主题；
    侧栏 Lucide 菜单图标映射）
  - 菜单 / Blueprint UI 元数据契约（交互标识字段）
  - 管理台与 portal 中已用 Runtime 的页面（渐进接入，不强制一次性改完）
- 配套 skill：`.cursor/skills/compose-admin-page/`（不替代本契约）
- 主验收样板（Runtime 工作台能力）：Portal Voyage Workbench（`ui-shipping` voyages）；
  该页属航运试验样板，**不**代表正式业务应静态挂在 Portal——正式业务仍优先蓝图动态页。
- 台面迁移（后续 tasks）：用户/角色/部门/菜单等从 Console 迁回 Portal 组织管理区；
  Console 菜单按平台治理面过滤；航运样板从默认产品导航降级或移除。
- 依赖：`add-blueprint-ui-runtime-consumer` 的 Runtime 消费路径；组织/品牌上下文已存在。
- 文档：实现完成后在贡献约定或 `docs/ARCHITECTURE.md` 前端小节注明「吸收自前端规范、
  拒绝双栈与 agent 改代码」；`前端规范.md` 可标为参考草案而非真源。
