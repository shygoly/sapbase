# Change: Blueprint 增加 UI 与权限发布层

## Why

AI 六步定义包含 pages / permissions，但 Blueprint 只发布 semantic / flows / rules /
experience；`definitionToBlueprint` 直接把页面和权限丢掉。结果：

- AI 模块没有可发布的页面/菜单声明；
- AI 修改的 `page` / `permission` / `menu` patch 在服务端只能拒绝；
- 前端无法从已签名的包里读到“有哪些页面、哪些角色能看”。

## What Changes

- **ADDED** `ui.json`（`blueprint-ui/v1`）：页面（list/form/detail）与菜单声明。
- **ADDED** `permissions.json`（`blueprint-permissions/v1`）：角色 → 资源 → 数据范围/动作。
- **ADDED** 编译器覆盖两层：逐文件 Schema、跨字段冲突（页面实体/字段存在、权限资源存在、重复页面/菜单）。
- **ADDED** IR 层摘要 `ui` / `permissions`，改页面/权限会变 `irDigest`。
- **MODIFIED** `definitionToBlueprint` / `writeBlueprintDir` 输出两层。
- **MODIFIED** `CompiledBlueprint` 携带 `ui` / `permissions`。
- **ADDED** `GET /blueprints/:id/ui` 与 `/permissions`（经 license/tenant 装载后读取）。
- **MODIFIED** 服务端 Patch：支持 `page` / `permission` / `menu` 的 add/update/remove。
- 不生成 Next 路由、不做服务端角色映射；发布层先作为声明供渲染器/导航消费。

## Impact

- Affected specs: `blueprint-delivery`、`blueprint-semantic`、`semantic-runtime`
- Affected code:
  - `schemas/blueprint-{ui,permissions}.schema.json`
  - `libs/platform-release/src/blueprint/{compiler,compiled-model}.ts`
  - `libs/shared-schemas/src/v1/blueprint.ts`
  - `apps/api/src/ai-modules/{definition-to-blueprint,definition-patch.service}.ts`
  - `libs/platform-release/src/blueprint/blueprint.controller.ts`
- 兼容性：两层均 optional；旧包不写文件、行为不变。
- 不做的事：不把页面声明自动变成静态路由；不把角色规则自动映射成平台权限点。
