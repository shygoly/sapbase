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

- [ ] 4.1 菜单或 Blueprint UI 响应携带可选交互标识（向后兼容）
- [ ] 4.2 Runtime / 布局按 `componentKey` 白名单解析组件；禁止远端脚本执行
- [ ] 4.3 无标识时保持现有硬编码路由行为不变

## 5. 中优先增强（P1）

- [ ] 5.1 `ui-kit` data-table：超过阈值启用虚拟滚动；小表路径回归
- [x] 5.2 `@sap/ui-runtime/format` + SchemaList 默认使用；3 tests 通过
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
- [x] 5.10 `RuntimeErrorBoundary` + 复用 `ConfirmDialog`（脏切换确认）
- [x] 5.11 Lucide 映射覆盖 seed key/历史别名；未知 key 用 Circle 中性占位

## 6. 文档、Skill 对齐与验收（P1）

- [x] 6.1 文首已加参考草案声明
- [x] 6.2 ARCHITECTURE 增加 UI Runtime 能力清单并指向 UI_CONTRIBUTION
- [x] 6.3 确认 `.cursor/skills/compose-admin-page/` 台面选型与「三分法」一致
      （使用框架→Portal；平台治理→Console；航运≠正式产品面）；不发明第二套平台 API
- [x] 6.4 `test:ui-runtime` 3 passed；portal/console/API `tsc --noEmit` 通过；Workbench 原语已提供（样板页仍待接）
- [x] 6.5 `openspec validate enhance-ui-runtime-scenario-capabilities --strict` 通过
