## ADDED Requirements

### Requirement: Runtime Scenario Capability Pack

`PageRuntime` / `CollectionRuntime` / `DetailRuntime` / `FormRuntime` MUST 以可选能力包形式
提供企业场景默认行为，业务页面 MUST 通过 Schema / model 声明启用，MUST NOT 为获得这些行为
而复制一套 Standard*Page 基类。

能力包至少覆盖：

- 列表：标准查询区、批量操作、二次确认、分页、空态、错误态
- 详情：状态 Timeline / 操作痕迹（有数据才渲染）
- 表单：草稿保存（含体积上限）、离开防误触

#### Scenario: 列表页启用批量删除确认

- **WHEN** Collection model 声明批量删除 action 且 `confirm: true`
- **THEN** 用户触发批量删除时 MUST 先出现确认
- **AND** 取消确认 MUST NOT 发起删除请求

#### Scenario: 未启用能力时行为不变

- **WHEN** 页面未声明草稿或 Timeline 能力
- **THEN** Runtime MUST 保持与变更前等价的渲染与交互
- **AND** MUST NOT 强制插入空 Timeline 或草稿提示

### Requirement: Fine-Grained Access Interception

Runtime MUST 支持在 model 上声明按钮级、字段级与行级访问控制，并在渲染层拦截。
前端拦截 MUST NOT 替代服务端鉴权；任何写操作仍 MUST 由后端再次校验。

缺省仅配置页面级 `permissions` 时，行为 MUST 与现有 PermissionGuard 兼容。

#### Scenario: 无更新权限隐藏字段编辑

- **WHEN** 用户缺少某字段的 update 权限且 model 声明了 `fieldAccess`
- **THEN** 该字段 MUST 以只读或不渲染方式呈现
- **AND** 客户端 MUST NOT 仅因 UI 隐藏就认为服务端会接受写入

#### Scenario: 行级不可见数据不展示操作

- **WHEN** 某行未通过 `rowAccess` 判定
- **THEN** 该行 MUST NOT 展示写操作入口
- **AND** 列表仍可展示策略允许的只读摘要（若 model 允许）

### Requirement: Metadata-Driven Interaction Hints

Runtime / 布局 MUST 支持菜单项或 Blueprint UI 声明可选携带 `componentKey` 与
`interaction` 标识（例如 `pagination`、`confirm`、`draft`），并按白名单解析
`componentKey`；对未知键 MUST 安全降级，MUST NOT 执行远端脚本或动态字符串模块路径。

无此类标识的既有菜单 MUST 继续按硬编码路由工作。

#### Scenario: 元数据声明分页与确认

- **WHEN** 菜单/UI 元数据包含 `interaction.pagination=true` 与 `interaction.confirm=true`
- **THEN** 对应列表 Runtime MUST 启用分页并在破坏性操作前确认

#### Scenario: 未知 componentKey 降级

- **WHEN** 元数据中的 `componentKey` 不在前端白名单
- **THEN** 系统 MUST 展示降级占位或拒绝渲染该页
- **AND** MUST NOT 根据元数据字符串加载任意远程代码

### Requirement: Agent Must Not Bypass Blueprint Evolution

对本能力相关的前端行为演进，Agent 或自动化 MUST 通过蓝图 / 变更提议 / 发布激活闭环完成。
MUST NOT 经旁路直接修改 `libs/ui-runtime`、`libs/ui-kit`、`libs/app-shared` 或 App 壳生产源码
作为「页面生成」手段。

人工维护平台 Runtime 能力本身不在此禁令内，但 MUST 走正常代码评审，不得伪装成租户实例热更新。

#### Scenario: 租户要改列表查询字段

- **WHEN** 实例需要调整某业务列表的查询与展示字段
- **THEN** 变更 MUST 落在蓝图或等价元数据并提出议发布
- **AND** MUST NOT 以写入 `apps/web-*/src/**` 源文件作为交付形态

### Requirement: Virtualized Large Collections

`ui-kit` data-table MUST 在行数或预估渲染成本超过约定阈值时启用虚拟滚动。
低于阈值时 MUST 保持非虚拟化路径，以避免小表回归。

#### Scenario: 超过阈值启用虚拟化

- **WHEN** 列表数据量达到或超过阈值
- **THEN** 表格 MUST 使用虚拟滚动渲染可见行
- **AND** 选择态 / 横向滚动等既有行为 MUST 有回归覆盖

### Requirement: Unified Formatting Pipeline

DateTime、Currency、Unit 等展示 MUST 经 `ui-kit`（或经其再导出的 app-shared）统一格式化管道。
Runtime 字段渲染默认 MUST 使用该管道；租户/品牌差异 MUST 通过 locale 与主题变量覆盖，
MUST NOT 在各业务页复制第二套 format 实现。

#### Scenario: 金额字段一致格式化

- **WHEN** 两个不同业务页渲染同一 currency 字段类型
- **THEN** 小数位、分组与符号规则 MUST 一致（同一 locale / 主题下）

### Requirement: Tenant Presentation Hooks Without New Stack

品牌色、Logo 与租户扩展字段可见性 MUST 在现有组织 / 品牌上下文上增强。
MUST NOT 为这些能力新建 `tenant-core` 包或 Ant Design 主题双栈。

#### Scenario: 品牌主题覆盖

- **WHEN** 组织配置了品牌主色
- **THEN** 门户壳 MUST 通过 CSS 变量应用该主色
- **AND** MUST NOT 引入第二套组件库主题引擎作为前提

#### Scenario: 扩展字段按组织可见

- **WHEN** 组织启用了某扩展列或扩展表单字段且当前用户有读权限
- **THEN** Collection/Form Runtime MUST 按元数据渲染该字段
- **AND** 未启用该扩展的组织 MUST NOT 看到该列/字段

### Requirement: Organization And App Context Invalidation

Runtime 与壳层 MUST 以当前组织（及当前业务应用安装，若适用）为数据边界。
用户切换组织或切换应用后，依赖该上下文的列表 / 详情 / 表单 MUST 失效并重新加载，
MUST NOT 继续展示上一组织或上一应用的数据或写入口。

组织切换器与应用切换器 MUST 由布局壳提供；业务页 MUST NOT 平行实现第二套切换器。

#### Scenario: 切换组织后列表不串数据

- **WHEN** 用户在壳层从组织 A 切换到组织 B
- **THEN** 当前页 Collection/Detail MUST 清空或重取组织 B 数据
- **AND** MUST NOT 仍显示组织 A 的行或允许对 A 的写操作

#### Scenario: 切换应用后菜单与页边界

- **WHEN** 用户切换到另一已安装应用
- **THEN** 导航与 Runtime 装配 MUST 对应该应用的 Blueprint / 安装边界
- **AND** MUST NOT 暴露仅属于上一应用的私有页面入口

### Requirement: SaaS Surface Separation

平台 MUST 按「谁用、管什么」区分三层台面，MUST NOT 仅因路径含 `/admin` 就把页面归到
`web-console`（3060）。

| 台面 | 应用 | 职责 |
|------|------|------|
| 租户业务 | `web-portal`（3050） | 单据工作台、蓝图动态应用页、概览/会话等使用壳 |
| 租户组织管理（使用框架） | **`web-portal`（3050）** | 用户、角色、部门、本组织菜单、组织/品牌、组织设置、审计等租户管理员能力 |
| 平台 / 运行时治理 | `web-console`（3060） | 发布/激活、变更提议、发布自动化、插件、模块注册、知识库、Agent 治理、AI 模块流水线等 |

`web-console` MUST 保持瘦身：仅承载平台级能力；MUST NOT 把用户/角色/部门/菜单等租户使用框架
长期只挂在 3060 作为产品真源。
菜单与导航 MUST 可按台面（`surface`）过滤；Portal 与 Console MUST NOT 共用同一份无边界菜单树。
租户业务 CRUD 在可由蓝图描述时 MUST 优先 Blueprint 动态页，MUST NOT 为每个租户复制静态业务树。

航运（`dashboard/shipping/**` 及 console `system-settings` 下船型/燃料/年份等）属**域试验/样板**，
MUST NOT 当作正式产品台面边界；正式业务交付 MUST 走蓝图动态页或经批准的领域包，而非把样板树当默认入口。

#### Scenario: 租户使用框架落在 Portal

- **WHEN** 租户管理员需要管理本组织用户、角色、部门或本组织菜单
- **THEN** 产品入口 MUST 在 `web-portal`（或 Portal 内组织管理分区）可达
- **AND** MUST NOT 要求用户仅因「组织管理」而进入 `web-console` 作为唯一入口

#### Scenario: Console 仅平台治理

- **WHEN** 用户打开 `web-console`
- **THEN** 主导航 MUST 以发布、提议、插件、模块注册、Agent/AI 治理等平台能力为主
- **AND** MUST NOT 把租户业务单据工作台或航运样板树作为 Console 的默认产品面

#### Scenario: 租户业务优先蓝图页

- **WHEN** 新增可由 list/form/detail 元数据描述的租户业务实体页
- **THEN** 交付形态 MUST 优先 Blueprint / 动态路由消费
- **AND** MUST NOT 以在 `apps/web-portal` 复制整棵静态 CRUD 树（含航运样板树）作为默认交付

### Requirement: Optional Quota And Plan Affordance

平台 MUST 提供可复用的配额 / 用量 / 套餐提示原语（如进度条或告警条），
供列表或设置区按 model 开关启用；未在 model 启用时 MUST NOT 强制插入。
业务页 MUST NOT 私自实现互不兼容的第二套计量 UI。
计量数据源与计费真相仍 MUST 以后端为准；前端仅展示。

本要求为中优先增强；未启用时既有页面行为 MUST 保持不变。

#### Scenario: 列表启用用量提示

- **WHEN** Collection model 启用配额提示且后端返回用量与上限
- **THEN** 列表或工具区 MUST 展示统一配额原语
- **AND** 达到告警阈值时 MUST 可见警告（具体文案可配置）

### Requirement: Tenant Self-Service Entry

租户管理员自助配置（用户/角色/部门/本组织菜单/品牌/组织设置/用量相关入口等）MUST 收敛在
**`web-portal` 壳或组织设置区**，与租户业务台同一产品入口；业务列表页 MUST NOT 各自复制一套
「租户设置」导航。

无相应权限时 MUST 隐藏入口；MUST NOT 仅靠前端隐藏作为安全保障。
迁移完成前，若页面仍暂居 `web-console`，MUST 在台面清单中标为技术债并规划迁回 Portal，
MUST NOT 将「长期只在 3060」写成产品契约。

#### Scenario: 有权限可见自助入口

- **WHEN** 用户具备组织管理相关权限并在 Portal 登录
- **THEN** Portal 壳或组织设置区 MUST 展示自助配置入口
- **AND** 业务 Collection 页 MUST NOT 再实现平行的租户设置菜单树

### Requirement: PiAgent Contextual Shell Entry

布局壳 MUST 提供 PiAgent 在**当前页面**叠开的入口（侧栏或抽屉），并在打开时携带
当前组织、应用、release（若可得）以及页面/选中实体等上下文，以符合
`docs/protocols/piagent.md` 的 Context Envelope 语义。

主触发器 MUST 为壳层固定控件（顶栏或侧栏按钮等）。悬浮球 MAY 作为附加触发器，
MUST NOT 作为唯一入口。菜单上的独立 PiAgent 页面 MAY 用于会话历史、
`piagent-builder` 工作台或联调，MUST NOT 作为 `piagent-runtime` 答疑/改数的默认主路径。

业务页面 MUST NOT 平行实现第二套 Agent/Chat 浮层；写操作仍 MUST 走确认令牌，
MUST NOT 用无审计的 `window.confirm` 替代。

#### Scenario: 当前页打开并带选中上下文

- **WHEN** 用户在业务单据页选中一条记录后打开 PiAgent 壳入口
- **THEN** 助手面板 MUST 叠在当前页打开（不强制整页跳转）
- **AND** 请求/上下文 MUST 能关联当前组织与该选中记录（或显式标明无选中）

#### Scenario: 悬浮球不是唯一入口

- **WHEN** 产品启用了悬浮球触发器
- **THEN** 壳层仍 MUST 保留固定按钮或等价可达入口
- **AND** 仅隐藏悬浮球时用户仍 MUST 能打开同一面板

#### Scenario: 业务页禁止私挂聊天窗

- **WHEN** 新增或改造业务 Collection/Detail 页
- **THEN** 该页 MUST NOT 再实现独立的 Agent 聊天浮层
- **AND** MUST 复用壳层 PiAgent 入口

### Requirement: Master-Detail Line Association

`DetailRuntime`（及工作台详情区）MUST 支持主实体与从表/行项目的关联展示与编辑插槽
（主从结构由 Blueprint / model 声明）。从表 MUST 随主实体选中加载；主实体无选中或加载失败时
从表 MUST 进入空态或错误态，MUST NOT 展示陈旧行项目。

写从表 MUST 走与主实体一致的权限与确认策略；服务端仍 MUST 做鉴权与主从完整性校验。

#### Scenario: 选中主单加载从表

- **WHEN** 用户选中主实体且 model 声明了从表
- **THEN** 详情区 MUST 加载并展示对应行项目
- **AND** 切换主实体后 MUST 替换为新主实体的从表数据

#### Scenario: 无主选中不展示陈旧从表

- **WHEN** 当前无主实体选中
- **THEN** 从表区域 MUST 为空态
- **AND** MUST NOT 继续显示上一主实体的行项目

### Requirement: Layout Safety Defaults

应用布局 MUST 提供 Error Boundary，避免单页渲染异常拖垮整壳。
破坏性操作（删除、卸载、回退、批量写等）MUST 可复用统一确认组件；长表单 SHOULD
启用离开防误触（与 FormRuntime 草稿能力配合）。

#### Scenario: 子树抛错不白屏整站

- **WHEN** 某业务页渲染抛出未捕获错误
- **THEN** Error Boundary MUST 展示可恢复的错误态
- **AND** 壳层导航 MUST 仍可用

### Requirement: Workbench Layout Primitives

`ui-runtime`（或经 `ui-kit` / `app-shared` 再导出）MUST 提供可复用的工作台布局原语，
至少覆盖上下 Stack 与左右 Master-Detail 两种分栏；业务页 MUST 通过原语组合列表与详情，
MUST NOT 为同类工作台各自复制一套分栏骨架。

原语 MUST 支持分区独立滚动、可调整分隔比例；窄屏 MUST 可降级为「列表 → 独立详情路由」
而不破坏选中语义。

本要求规定平台原语；具体业务页何时选 Stack / 左右栏由页面组装约定（skill）决定，
不在本 spec 枚举业务域。

#### Scenario: 上下 Stack 工作台装配

- **WHEN** 页面声明上下 Stack 工作台（上列表、下详情）
- **THEN** Runtime/原语 MUST 渲染可调分隔的上下分区
- **AND** 列表选中变更 MUST 驱动下方详情内容更新
- **AND** 上下分区 MUST 可独立滚动

#### Scenario: 窄屏降级不丢选中语义

- **WHEN** 视口宽度低于约定断点且工作台配置了路由降级
- **THEN** 系统 MUST 允许从列表进入独立详情路由
- **AND** 详情标识（如实体 id）MUST 仍可从 URL 或等价状态恢复

### Requirement: Selection Synchronized With URL

分栏工作台 MUST 支持将当前选中实体与 URL 同步（默认 query 如 `id`，或 model 配置的 key）。
刷新或分享链接后 MUST 能恢复同一选中；仅会话内对照且 model 关闭 URL 同步时，
MAY 使用内存选中态。

locale 前缀路由 MUST 与既有 `useLocalePrefix` 约定兼容；选中同步 MUST NOT 剥离 locale。

#### Scenario: 刷新后恢复选中

- **WHEN** 用户在工作台选中实体且 URL 已写入该实体 id
- **AND** 用户刷新页面
- **THEN** 工作台 MUST 恢复同一选中并加载对应详情
- **AND** URL locale 前缀 MUST 保持有效

#### Scenario: 关闭 URL 同步时仅内存选中

- **WHEN** model 显式关闭 URL 选中同步
- **THEN** 切换选中 MUST NOT 改写实体 id 相关 query
- **AND** 离开页面后再次进入 MUST NOT 要求恢复上次选中

### Requirement: Dirty Guard On Selection Change

当分栏内详情或嵌入表单存在未保存变更时，用户切换列表选中或关闭详情 MUST 先经确认；
取消确认 MUST 保持原选中与未保存内容；确认丢弃后 MUST 才切换选中并加载新详情。

无未保存变更时 MUST 直接切换，MUST NOT 弹出确认。

本能力 MUST 与 FormRuntime 离开防误触语义一致，避免两套互相打架的脏检查。

#### Scenario: 脏详情切换选中需确认

- **WHEN** 详情区有未保存编辑且用户点击另一列表行
- **THEN** 系统 MUST 展示确认（丢弃或取消）
- **AND** 用户取消 MUST NOT 改变当前选中与表单值
- **AND** 用户确认丢弃后 MUST 切换选中并加载新详情

#### Scenario: 无脏数据直接切换

- **WHEN** 详情区无未保存变更且用户点击另一列表行
- **THEN** 系统 MUST 立即切换选中
- **AND** MUST NOT 展示丢弃确认

### Requirement: Collection And Detail Tri-State Defaults

`CollectionRuntime` 与分栏/独立 `DetailRuntime` MUST 提供 loading / empty / error 默认呈现
与可覆盖插槽。loading MUST 使用既有骨架或等价占位；empty MUST 短文案且可配主操作；
error MUST 可重试，MUST NOT 以空白区域冒充成功态。

无选中实体时详情区 MUST 展示明确空态，MUST NOT 用加载骨架暗示已有数据。

#### Scenario: 列表三态

- **WHEN** Collection 处于 loading / 无数据 / 请求失败之一
- **THEN** Runtime MUST 分别展示骨架、空态、可重试错误态
- **AND** MUST NOT 在失败时渲染伪造的成功空表且无错误提示

#### Scenario: 无选中时详情空态

- **WHEN** 工作台或详情容器当前无选中实体
- **THEN** 详情区 MUST 展示明确空态文案或插槽
- **AND** MUST NOT 展示假装已加载实体的骨架行

### Requirement: Sidebar Menu Icons Use Lucide

壳层侧栏（`UnifiedSidebar` 及等价导航）MUST 以 **Lucide**（`lucide-react`）渲染
`menu_items.icon`，MUST NOT 使用 emoji 字符表作为默认图标源，MUST NOT 混入
Tabler / Phosphor / Heroicons 等第二套图标库。

图标 key → 组件映射 MUST 至少覆盖生产 seed 中的菜单 key（含
`home`、`settings`、`users`、`shield`、`building`、`menu`、`rocket`、
`git-pull-request`、`zap`、`book`、`eye`、`history`、`cog`），并按本 change
`design.md` 方案 1 语义对齐（如 `home`→`LayoutDashboard`、`eye`→`Bot`、
`cog`→`SlidersHorizontal`、`history`→`ScrollText`）。历史兼容别名 MAY 保留。

未知 `icon` key MUST 降级为中性 Lucide 占位图标；MUST NOT 回落为裸 `•` 或 emoji
与线性图标混搭。

#### Scenario: seed 菜单 key 均有 Lucide 图标

- **WHEN** 侧栏渲染来自 API/seed 的菜单项且 `icon` 为已知生产 key
- **THEN** 该项 MUST 展示对应 Lucide 线性图标
- **AND** MUST NOT 展示 emoji 或空白圆点占位

#### Scenario: 未知 icon key 中性降级

- **WHEN** 菜单项 `icon` 不在映射表中
- **THEN** 侧栏 MUST 使用中性 Lucide 占位（如 `Circle`）
- **AND** MUST NOT 混用 emoji 或仅显示 `•`

#### Scenario: 禁止第二图标库

- **WHEN** 实现或扩展侧栏菜单图标
- **THEN** 新增映射 MUST 取自 Lucide
- **AND** MUST NOT 为单个菜单引入 Tabler / Phosphor 等其它库图标
