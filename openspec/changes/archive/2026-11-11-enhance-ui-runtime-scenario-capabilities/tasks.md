# Tasks

> 依赖：现有 `libs/ui-runtime` / `libs/ui-kit` / Blueprint UI 消费路径。
> 主验收样板：Portal Voyage Workbench（本里程碑已落地原语 + 样板页）。
> 批准后按 P0 → P1 推进；未勾选项为本 change 后续迭代。

## 1. 契约与类型（P0）

- [x] 1.1 在 `ui-runtime` 定义能力开关类型：查询区、批量操作、确认、空/错态、
      Timeline、草稿、离开防误触、虚拟化阈值、format 管道
      （`libs/ui-runtime/src/schema/types.ts`）
- [x] 1.2 扩展 Page/Collection/Form/Detail model：可选 `fieldAccess` / `rowAccess` /
      `actions[]`；缺省兼容现有 `permissions`
- [x] 1.3 `UiMetadata/UiInteraction`（types.ts）；未知 `componentKey` 按页面类型回退，见 `docs/UI_CONTRIBUTION.md`
- [x] 1.4 `docs/UI_CONTRIBUTION.md` 贡献约定已落地

## 2. Runtime 默认能力包（P0 · 高优先）

- [x] 2.1 `CollectionRuntime`：loading / empty / error 默认三态与可覆盖插槽
      （查询区/批量栏/分页 UI 仍后续）
- [x] 2.2 `DetailRuntime`：无选中时明确空态；样板页主从 charter 摘要随选中加载
      （Timeline 插槽仍后续）
- [x] 2.3 `FormRuntime` draftKey/draftValue（256KB 上限）+ `useLeaveGuard` beforeunload/链接确认
- [x] 2.4 `RuntimeAccessProvider` + `FieldGuard`/`ActionGuard`/`canAccessRow`；后端鉴权不变
- [x] 2.5 样板接入：**主样板 = Portal Voyage Workbench**
      （`libs/ui-shipping/.../voyages-page-client.tsx`）
      console users / Blueprint 动态页为次样板（后续）

## 3. 工作台原语与选中语义（P0 · 高优先）

- [x] 3.1 提供上下 Stack / 左右 Master-Detail 工作台原语（`WorkbenchLayout`）
- [x] 3.2 选中实体与 URL 同步（`useWorkbenchSelection`；默认 `?id=`；可关）
- [x] 3.3 详情脏数据时切换选中须确认（`useDirtySelectionGuard` + `DirtySelectionConfirm`）
- [x] 3.4 `WorkbenchLayout master-detail` 窄屏隐藏列表并保留 `?id=`，附返回列表
- [x] 3.5 样板：Portal Voyage Workbench 用原语实现「上列表下详情」
      （`?id=` 选中、脏切行、三态、org refetch）

## 4. 元数据驱动装配（P0 · 高优先）

- [x] 4.1 `menu_items.surface/componentKey/interaction` + `BlueprintUiPage.componentKey/interaction`（均可选）
- [x] 4.2 `resolveUiComponent` 本地白名单；未知键按 type 回退，无动态 import/远端脚本
- [x] 4.3 无标识时回退 schema-list/schema-form/detail，现有路由与渲染不变

## 5. 中优先增强（P1）

- [x] 5.1 `DataTable` 增加 virtualizeThreshold（默认 100）；小表仍走原 ScrollArea 路径
- [x] 5.2 `@sap/ui-runtime/format` + SchemaList 默认使用；3 tests 通过
- [x] 5.3 `BrandConfigProvider` 写入 `--brand-*`/`--seal` CSS 变量；仍复用现有 Brand/Org 上下文
- [x] 5.4 切组织后样板页 refetch（Voyage Workbench + `useOrganizationStore`）；
      Runtime 级通用失效仍后续
- [x] 5.5 `@sap/ui-kit/usage-meter` 统一配额/用量原语
- [x] 5.6 Portal `/dashboard/settings` 组织设置区 + 品牌维护；成员/角色/部门/菜单过渡期双挂 Console
- [x] 5.7 `surface` 字段 + `UnifiedSidebar` 递归过滤；Portal/Console layout 分别传台面
- [x] 5.8 迁移/种子将航运与 system-settings 样板路径 `visible=false`（保留可手动开启）
- [x] 5.9 `PiAgentShell` 固定触发器 + 可选悬浮球 + route/entity/org 上下文芯片；业务页无私挂
- [x] 5.10 `RuntimeErrorBoundary` + 复用 `ConfirmDialog`（脏切换确认）
- [x] 5.11 Lucide 映射覆盖 seed key/历史别名；未知 key 用 Circle 中性占位

## 6. 文档、Skill 对齐与验收（P1）

- [x] 6.1 文首已加参考草案声明
- [x] 6.2 ARCHITECTURE 增加 UI Runtime 能力清单并指向 UI_CONTRIBUTION
- [x] 6.3 确认 `.cursor/skills/compose-admin-page/` 台面选型与「三分法」一致
      （使用框架→Portal；平台治理→Console；航运≠正式产品面）；不发明第二套平台 API
- [x] 6.4 `test:ui-runtime` 3 passed；portal/console/API `tsc --noEmit` 通过；Workbench 原语已提供（样板页仍待接）
- [x] 6.5 `openspec validate enhance-ui-runtime-scenario-capabilities --strict` 通过
