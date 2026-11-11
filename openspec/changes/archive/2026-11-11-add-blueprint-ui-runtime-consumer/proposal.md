# Change: Blueprint UI 运行时消费者与权限执行

## Why

`ui.json` / `permissions.json` 已经能发布、签名、装载，但没有消费者：

- 前端没有通用页面入口，用户看不到 AI 发布的页面/菜单；
- `permissions.json` 只是声明，服务端写/读仍只按平台 RBAC，AI 角色不生效；
- 角色名与平台权限点没有映射，声明无法落地。

## What Changes

- **ADDED** `@sap/shared-core` 的 `canAccessBlueprintResource`：规则匹配（role / roleMappings / 权限点、resource、action），并带单测。
- **MODIFIED** `permissions.json` 增加可选 `roleMappings`（AI 角色 → 平台权限点）。
- **MODIFIED** 语义运行时：write/list/read/transition/delete/import 按权限层判定；无层/空规则保持旧行为。
- **ADDED** `GET /blueprints/:id/entities`：返回完整实体字段（UI 渲染需要）。
- **ADDED** `BlueprintAppRuntime`（`ui-runtime`）：菜单 + list/form/detail，按角色过滤页面。
- **ADDED** 通用路由 `/[locale]/dashboard/apps/[packageId]/[[...page]]`。
- **ADDED** api-client：`getEntities` / `getUi` / `getPermissions` / `createRecord`。

## Impact

- Affected specs: `blueprint-delivery`、`semantic-runtime`、`ai-module-management`
- Affected code:
  - `libs/shared-core/src/lib/blueprint-access.ts`
  - `libs/ui-runtime/src/blueprint/BlueprintAppRuntime.tsx`
  - `apps/web-portal/src/app/[locale]/dashboard/apps/[packageId]/[[...page]]/page.tsx`
  - `apps/api/src/semantic-runtime/semantic-runtime.service.ts`
  - `libs/platform-release/src/blueprint/blueprint.controller.ts`
  - `libs/api-client/src/api/blueprints.api.ts`
- 兼容性：无权限层的旧包行为不变；新增路由不替换既有静态页面。
- 不做的事：不做可视化编辑器；不把 AI 页面自动变成 Next 静态路由。
