# Tasks

> 依赖：现有 `libs/ui-runtime` / `libs/ui-kit` / Blueprint UI 消费路径。
> 主验收样板：Portal Voyage Workbench（本里程碑已落地原语 + 样板页）。
> 批准后按 P0 → P1 推进；未勾选项为本 change 后续迭代。

## 1. 契约与类型（P0）

- [x] 1.1 在 `ui-runtime` 定义能力开关类型：查询区、批量操作、确认、空/错态、
      Timeline、草稿、离开防误触、虚拟化阈值、format 管道
      （`libs/ui-runtime/src/runtime/types.ts`）
- [x] 1.2 扩展 Page/Collection/Form/Detail model：可选 `fieldAccess` / `rowAccess` /
      `actions[]`；缺省兼容现有 `permissions`
- [ ] 1.3 定义菜单/UI 元数据可选字段：`componentKey`、`interaction`
      （`pagination` / `confirm` / `draft` 等）；未知 `componentKey` 降级策略写清
- [ ] 1.4 贡献约定草稿：Agent/人不得旁路改 `libs/*` 生产行为；页面演进走蓝图/提议

## 2. Runtime 默认能力包（P0 · 高优先）

- [x] 2.1 `CollectionRuntime`：loading / empty / error 默认三态与可覆盖插槽
      （查询区/批量栏/分页 UI 仍后续）
- [x] 2.2 `DetailRuntime`：无选中时明确空态；样板页主从 charter 摘要随选中加载
      （Timeline 插槽仍后续）
- [ ] 2.3 `FormRuntime`：草稿读写（体积上限）、离开防误触提示
- [ ] 2.4 按钮/字段/行级权限拦截接入 Runtime；写操作仍依赖后端鉴权
- [x] 2.5 样板接入：**主样板 = Portal Voyage Workbench**
      （`libs/ui-shipping/.../voyages-page-client.tsx`）
      console users / Blueprint 动态页为次样板（后续）

## 3. 工作台原语与选中语义（P0 · 高优先）

- [x] 3.1 提供上下 Stack / 左右 Master-Detail 工作台原语（`WorkbenchLayout`）
- [x] 3.2 选中实体与 URL 同步（`useWorkbenchSelection`；默认 `?id=`；可关）
- [x] 3.3 详情脏数据时切换选中须确认（`useDirtySelectionGuard` + `DirtySelectionConfirm`）
- [ ] 3.4 窄屏降级路径：列表 → 独立详情路由且保留实体 id 语义
- [x] 3.5 样板：Portal Voyage Workbench 用原语实现「上列表下详情」
      （`?id=` 选中、脏切行、三态、org refetch）

## 4. 元数据驱动装配（P0 · 高优先）

- [ ] 4.1 菜单或 Blueprint UI 响应携带可选交互标识（向后兼容）
- [ ] 4.2 Runtime / 布局按 `componentKey` 白名单解析组件；禁止远端脚本执行
- [ ] 4.3 无标识时保持现有硬编码路由行为不变

## 5. 中优先增强（P1）

- [ ] 5.1 `ui-kit` data-table：超过阈值启用虚拟滚动；小表路径回归
- [ ] 5.2 统一 `formatDate` / Currency / Unit 管道；Runtime 字段渲染默认使用
- [ ] 5.3 品牌主题与租户扩展字段可见性：在现有 Brand/Org 上下文上加深，不新建 tenant-core 包
- [x] 5.4 切组织后样板页 refetch（Voyage Workbench + `useOrganizationStore`）；
      Runtime 级通用失效仍后续
- [ ] 5.5 可选配额/用量提示原语（壳或 Collection 工具区）；禁止业务页私自第二套计量 UI
- [ ] 5.6 租户自助入口收敛到 **Portal** 壳/组织设置区（用户/角色/部门/菜单/品牌等）；
      从 Console 迁回或双挂过渡期后下线 Console 唯一入口
- [ ] 5.7 菜单 `surface`（portal | console）：Portal/Console 导航按台面过滤；
      Console 默认仅平台治理项；Portal 含业务壳 + 组织管理，排除平台专属项
- [ ] 5.8 航运样板从正式产品导航降级：`dashboard/shipping/**` 与 console
      `system-settings/{fuel,vessel,years}` 不作为默认台面入口（保留作试验/能力样板可选）
- [ ] 5.9 PiAgent 壳层当前页面板（侧栏/抽屉）+ 固定触发器；悬浮球可选且非唯一；
      独立菜单页仅作历史/Builder/联调；业务页禁止私挂聊天窗；打开时注入页/选中上下文
      （样板页已遵守「不私挂」；壳面板实现后续）
- [ ] 5.10 布局级 Error Boundary；破坏性操作统一确认组件标配
- [ ] 5.11 侧栏菜单图标：`UnifiedSidebar` emoji `iconMap` → Lucide 整套映射
      （方案 1：`LayoutDashboard` / `Settings` / `Users` / `ShieldCheck` / `Building2` /
      `ListTree` / `Rocket` / `GitPullRequest` / `Zap` / `BookOpen` / `Bot` /
      `ScrollText` / `SlidersHorizontal` / `Puzzle` / `Workflow` / `Palette`；
      覆盖 seed key 与历史别名；未知 key 中性占位；禁止混用其它图标库）

## 6. 文档、Skill 对齐与验收（P1）

- [ ] 6.1 `前端规范.md` 文首标注「参考草案；可吸收项以本 change / `ui-runtime` 为准」
- [ ] 6.2 `docs/ARCHITECTURE.md` 或前端贡献约定同步 AI 边界与 Runtime 能力清单
- [x] 6.3 确认 `.cursor/skills/compose-admin-page/` 台面选型与「三分法」一致
      （使用框架→Portal；平台治理→Console；航运≠正式产品面）；不发明第二套平台 API
- [ ] 6.4 相关单测 / 类型检查通过；**航次工作台**验收：Stack、URL 刷新恢复选中、
      脏切行确认、三态、主从 charter 摘要、切组织 refetch、无私挂 Agent 聊天窗
      （本机 `tsc` 受缺失 `@types/react` 影响；以 IDE lint / 运行时人工验收为准）
- [x] 6.5 `openspec validate enhance-ui-runtime-scenario-capabilities --strict` 通过
