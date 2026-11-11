# 前端贡献约定（Runtime 边界）

> 适用范围：`apps/web-portal`、`apps/web-console`、`libs/ui-runtime`、`libs/ui-kit`、
> `libs/ui-layout`、`libs/ui-shipping`。与 `docs/META_LANGUAGE.md` 冲突时以后者为准。

## 1. 页面演进走蓝图/提议

- 业务页面（列表/表单/详情/工作台）的字段、权限、交互优先通过 **Blueprint UI / 页面模型**声明，
  由 `ui-runtime` 渲染；不要在 app 内再写一套同义页面模型。
- Agent 或人 **不得旁路修改 `libs/*` 的生产行为**来“顺手修页面”。需要改 Runtime 能力时：
  1. 在 OpenSpec change / 提议中写清契约与回退；
  2. 先加类型与测试，再改实现；
  3. 保持缺省行为向后兼容。
- 页面私有逻辑（数据获取、业务校验）留在 app；跨页面能力（权限、草稿、格式、确认、错误边界）
  留在 Runtime/ui-kit，避免每个业务页各写一份。

## 2. Runtime 能力清单

| 能力 | 入口 | 说明 |
|---|---|---|
| 页面权限 | `PageRuntime` / `PermissionGuard` | 页面级 RBAC |
| 字段/动作权限 | `RuntimeAccessProvider`、`FieldGuard`、`ActionGuard` | UI 可见性；写操作仍由后端鉴权 |
| 集合三态 | `CollectionRuntime` | loading / empty / error 插槽 |
| 草稿 | `FormRuntime` `draftKey/draftValue` | localStorage，默认 256KB 上限 |
| 离开防误触 | `useLeaveGuard` / `FormRuntime isDirty` | beforeunload + 同页链接确认 |
| 格式管道 | `@sap/ui-runtime/format` | date / currency / unit / number |
| 工作台 | `WorkbenchLayout` / `useWorkbenchSelection` | 上下列表详情 + URL 选中 |
| 破坏性确认 | `ConfirmDialog` | 统一确认组件 |
| 错误边界 | `RuntimeErrorBoundary` | 布局级兜底 |

## 3. 组件键与交互标识

- 菜单/页面元数据可带 `componentKey` 与 `interaction`（分页/确认/草稿/虚拟化阈值）。
- `componentKey` 只允许 Runtime 白名单内的值；**未知值回退默认组件**（按 list/form/detail/dashboard），
  禁止远端脚本、动态 import 或任意组件路径。
- 无 `componentKey` 时保持现有硬编码路由行为不变。

## 4. 图标与主题

- 侧栏图标统一用 `lucide-react` 映射；未知 key 用中性占位，不混用其它图标库。
- 品牌主题与租户扩展字段走现有 Brand/Org 上下文，不新建 tenant-core 包。

## 5. 验收

- `npx tsc --noEmit -p apps/web-portal/tsconfig.json`（或对应 app）
- `npx tsc --noEmit -p libs/ui-runtime/tsconfig.json`
- 相关单测：`npx jest -c apps/api/jest.config.js ui-runtime`（如适用）
- 页面改动需附实际路由 200 / 截图或 e2e 证据；不能用“类型通过”代替运行时验收。
