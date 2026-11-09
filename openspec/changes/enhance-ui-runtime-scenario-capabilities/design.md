## Context

当前前端已是 Nx 多应用（`web-portal` / `web-console`）+ `ui-kit`（Shadcn）+
`ui-runtime`（Schema / Permission 驱动）。根目录 `前端规范.md` 是另一套目标蓝图
（Standard*Page + AntD 双栈 + tenant-core + agent-bridge）。经评审决定：**吸收能力、
拒绝换栈**。

## Goals / Non-Goals

### Goals

- 把列表/详情/表单的「企业场景默认能力」收敛进现有 Runtime，页面只声明 Schema。
- 按钮 / 字段 / 行级权限由 Runtime 统一判定，业务页不再散落 `if (canXxx)`。
- 菜单与 Blueprint UI 元数据可声明组件映射与交互开关，Runtime 按标识装配。
- 提供工作台分栏原语、选中↔URL、脏切行确认、三态默认，消除业务页手写骨架。
- 固化 SaaS 上下文：切组织/应用失效；**台面三分**（Portal 业务+组织管理 / Console 平台治理 /
  航运等为样板非产品面）；品牌走现有 Org/Brand；可选配额原语。
- 明确 AI/Agent 只能走蓝图与发布闭环，不能旁路改前端核心库。
- 补齐虚拟化、格式化、品牌/扩展字段、Error Boundary / 长事务确认等中优先缺口。

### Non-Goals

- 引入 Ant Design 默认依赖或双主题体系。
- 用 `StandardListPage` 等新品牌替换 `*Runtime`。
- 重建 `tenant-core` / `scenario-components` / `marketing-*` 目录。
- 实现 `agent-bridge` 直接写 `apps/*/features` 或 `libs/*`。
- 在本 change 中规定具体业务页文案/列定义或 Agent 拼页操作步骤（后者属 skill）。

## Decisions

1. **能力落点 = Runtime 插件/默认选项，不是新页面基类品牌**  
   `CollectionRuntime` / `DetailRuntime` / `FormRuntime` 增加可选 capability flags
   与插槽；现有页面渐进开启，避免大爆炸重写。

2. **权限模型扩展但兼容**  
   Page/Collection/Form model 增加可选 `fieldAccess` / `rowAccess` / `actions[]`。
   缺省时行为与今天一致（仅页面级 `permissions`）。

3. **元数据交互标识放在菜单 / UI 声明，不造第二份前端路由表**  
   后端或 Blueprint UI 层增加可选字段（如 `interaction: { pagination, confirm }`、
   `componentKey`）。Runtime 识别未知 `componentKey` 时 MUST 安全降级（占位或拒绝），
   MUST NOT 动态 `eval` 远端代码。

4. **工作台原语与选中语义进 Runtime**  
   Stack / Master-Detail 作为可复用原语；选中默认可与 URL 同步（key 可配、可关）；
   脏详情切换必须确认，并与 FormRuntime 离开防误触共用语义。窄屏可降级独立路由。

5. **虚拟化按阈值启用**  
   data-table 在行数或预估高度超过阈值时启用虚拟滚动；小表保持现状，避免回归。

6. **格式化管道单一入口**  
   扩展 `libs/ui-kit` 的 format 工具（DateTime / Currency / Unit），Runtime 字段渲染
   默认走管道；租户/品牌覆盖通过主题与 locale，不复制第二套 format。

7. **Agent 边界写进能力不变量**  
   本能力的演进产物是 Runtime 行为与元数据，不是生成的页面源码文件。与
   `instance-evolution`「只到蓝图层」一致。拼页操作手册放在
   `.cursor/skills/compose-admin-page/`，不替代本契约。

8. **台面按「谁用、管什么」三分，禁止 `/admin` ⇒ Console 启发式**  
   - **Portal**：租户业务（含蓝图动态页）+ 租户使用框架（用户/角色/部门/本组织菜单/品牌/组织设置）。  
   - **Console**：平台运行时治理（发布、提议、插件、模块注册、Agent/AI、知识库等）。  
   - **航运 shipping / 船运 system-settings**：域试验样板，不写入正式产品台面边界。  
   现状 Console 挂满用户角色部门菜单属实现债；契约要求迁回 Portal，菜单按 `surface` 过滤。

9. **侧栏菜单图标统一 Lucide，不换库**  
   现状 `libs/ui-layout` `UnifiedSidebar` 用 emoji `iconMap`，与 seed 中
   `home` / `rocket` / `git-pull-request` / `zap` / `book` / `eye` / `cog` 等 key 不对齐，
   表现为菜单缺图标。选型结论：保持 **Lucide**（与 shadcn / `ui-kit` 一致），
   MUST NOT 整库迁 Tabler/Phosphor（覆盖更广或字重更灵活，但混库/换库成本高于缺口修补）。
   标准映射（方案 1）：

   | 菜单语义 | `icon` key（含 seed 别名） | Lucide |
   |----------|---------------------------|--------|
   | 工作台/概览 | `home` / `dashboard` | `LayoutDashboard` |
   | 系统管理 | `settings` | `Settings` |
   | 用户 | `users` | `Users` |
   | 角色 | `shield` | `ShieldCheck` |
   | 部门 | `building` | `Building2` |
   | 菜单 | `menu` | `ListTree` |
   | 发布 | `rocket` | `Rocket` |
   | 变更提议 | `git-pull-request` | `GitPullRequest` |
   | 发布自动化 | `zap` | `Zap` |
   | 知识库 | `book` | `BookOpen` |
   | Agent 治理 | `eye` / `bot` | `Bot` |
   | 审计 | `history` | `ScrollText` |
   | 系统设置 | `cog` | `SlidersHorizontal` |
   | 插件 | `puzzle` / `plugin` | `Puzzle` |
   | 工作流 | `workflow` | `Workflow` |
   | 品牌 | `palette` / `brand` | `Palette` |

   历史 emoji 别名（`chart` / `shopping` / `dollar` 等）可保留为兼容映射；未知 key
   MUST 降级为中性 Lucide 占位（如 `Circle`），MUST NOT 回落 emoji 或裸 `•`。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 一次性改造所有管理页成本高 | 分阶段：先 Runtime API + 1～2 个样板页，再批量接入 |
| 字段/行级权限与后端不一致 | 前端仅做展示拦截；写操作仍以后端鉴权为准 |
| 元数据 `componentKey` 被滥用为远程代码 | 只允许白名单组件键；禁止 URL/脚本载荷 |
| 虚拟化与现有列固定/选择状态冲突 | 阈值开关 + 针对选中行/横向滚动的回归用例 |

## Migration Plan

1. 落地 Runtime 能力类型与默认实现（含三态）（高优先）。
2. 落地 Workbench 原语 + selection/URL + dirty 切行；样板一页上下工作台。
3. 选 `users` / 一个 Blueprint list 页作样板接入能力包。
4. 菜单/UI 元数据加可选交互字段（向后兼容）。
5. ui-kit 虚拟化与 format 管道。
6. 布局 Error Boundary + 确认/草稿标配。
7. 文档标明 `前端规范.md` 为参考草案；真源为本 change 归档后的 `ui-runtime` spec；
   skill 与本 change 分工表保持同步。

## Skill vs This Change

| 放在 compose-admin-page skill | 放在本 OpenSpec |
|------------------------------|-----------------|
| Portal/Console 拼页选型、Org/App/Brand 复用 | 台面三分 MUST；菜单 surface；使用框架在 Portal |
| PiAgent 入口选型（按钮/侧栏 vs 菜单页 vs 球） | 当前页面板 MUST；独立页辅；球非唯一 |
| 何时选 Dialog / Stack / 左右栏的**决策表** | Workbench 分栏**组件/原语**的 MUST |
| 某一页用 `?id=` 还是 state 的**默认接线** | selection 与 URL 同步的**平台约定与 API** |
| 菜单文件改哪、如何 Grep 邻页 | 元数据字段与白名单解析 |
| 拼页自检清单 | Scenario 级验收与回归 |

Agent 在平台原语未就绪时，按 skill 用 resizable + 本地 state **降级拼装**；原语落地后业务页应改用原语并删除重复逻辑。

## 前端规范.md 逐条吸收对照（防再漏）

> 过程教训：不可只按「用户刚指出的洞」增量补；必须以源文档章节为清单做一次全量对拍。

| 规范章节 | 处置 | 落点 |
|----------|------|------|
| §1 Standard*Page 场景封装 | **吸收能力，拒绝品牌** | Runtime 能力包（本 change） |
| §1 AntD + Shadcn 双栈 | **拒绝** | — |
| §2 admin-web / marketing-web / tenant-core / scenario-components 目录 | **拒绝换名换包** | 现状 `web-console` / `web-portal` / Org+Brand |
| §3 按钮/字段/行级权限 | **吸收** | Fine-Grained Access |
| §3 虚拟化 | **吸收** | Virtualized Large Collections |
| §3 DateTime/Currency/Unit | **吸收** | Unified Formatting Pipeline |
| §3 草稿 / 二次确认 / Error Boundary | **吸收** | Capability Pack + Layout Safety |
| §3 详情 Timeline / 操作痕迹 | **吸收** | Capability Pack |
| §3 主从表联动 | **吸收（曾漏）** | Master-Detail Lines（本 design 补 Requirement） |
| §4 租户 Context / 数据隔离 | **吸收为 Org+App 上下文** | Organization And App Context Invalidation |
| §4 域名识别 | **暂缓** | 仓内无稳定宿主解析链；见 Open Questions |
| §4 品牌色/Logo/扩展字段 | **吸收** | Tenant Presentation + Extension Fields Scenario |
| §4 配额进度条 | **吸收** | Optional Quota And Plan Affordance |
| §4 租户管理员自助配置入口 | **吸收并纠正落点=Portal** | Tenant Self-Service Entry |
| §4 轻量 App 壳 | **吸收为 Blueprint 动态页** | SaaS Surface Separation |
| （评审纠正）用户/角色/部门/菜单属使用框架 | **MUST 在 Portal，非 Console** | SaaS Surface Separation 台面三分 |
| （评审纠正）航运样板非产品面 | **降级/不写入正式台面** | SaaS Surface Separation |
| §5 agent-bridge 生成代码 Payload | **拒绝**（与元语冲突） | Agent Must Not Bypass… |
| §5 租户/领域模型 Spec | **外置** | `DOMAIN.md` / Blueprint，不在本 change 重写 |
| §5 自进化发布流水线（ESLint/Nx 拦 libs） | **外置** | 发布/Agent 协议与 CI；本 change 只锁「不改 libs 当页面生成」 |
| §5 菜单 component / interaction 元数据 | **吸收** | Metadata-Driven Interaction Hints |
| §6 Marketing 域平移 | **拒绝** | — |
| （规范未写）工作台 Stack / 选中 URL / 脏切行 / 三态 | **仓内刚需补强** | Workbench / Selection / Dirty / Tri-State |
| （规范未写）PiAgent 菜单页 vs 当前页/悬浮球 | **仓内刚需补强**（对齐 `docs/protocols/piagent.md`） | PiAgent Contextual Shell Entry |

## Open Questions

- 行级权限表达式是前端可解释子集，还是一律向后端 filter 参数透传？
- 表单草稿存储选 `localStorage` 还是 IndexedDB（大表单）？默认建议 localStorage + 体积上限。
- Workbench 选中同步默认 query key（如 `id`）是否全局统一，还是按 model 配置？
- 自定义域名 → 组织解析是否纳入本能力后续迭代，还是独立 networking/tenancy change？
