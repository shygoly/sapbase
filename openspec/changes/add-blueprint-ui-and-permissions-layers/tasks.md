## 1. 协议

- [x] 1.1 `schemas/blueprint-ui.schema.json`
- [x] 1.2 `schemas/blueprint-permissions.schema.json`
- [x] 1.3 `blueprint-ir.schema.json` + `shared-schemas` 增加 `ui` / `permissions` 摘要

## 2. 编译

- [x] 2.1 `FILE_SCHEMAS` 覆盖 `ui.json` / `permissions.json`
- [x] 2.2 `detectConflicts`：页面实体/字段存在、重复页面/菜单、权限资源存在
- [x] 2.3 IR 计算 ui/permissions digest
- [x] 2.4 `CompiledBlueprint` 携带两层

## 3. 作者链

- [x] 3.1 `definitionToBlueprint` 映射 pages/menus/permissions
- [x] 3.2 `writeBlueprintDir` 写两层
- [x] 3.3 Patch 支持 page/permission/menu add/update/remove

## 4. 运行时读取

- [x] 4.1 `GET /blueprints/:id/ui`
- [x] 4.2 `GET /blueprints/:id/permissions`
- [x] 4.3 api-client 增加对应方法

## 5. 验收

- [x] 5.1 单测：页面/权限层可编译、可装载、摘要进 IR
- [x] 5.2 单测：页面引用不存在实体 → 编译失败
- [x] 5.3 单测：page/permission/menu patch 可应用
- [x] 5.4 `apps/api` 全量 jest 绿；build / check:all / lint:boundaries 0 error
- [x] 5.5 证据：`definitionToBlueprint` 产出 ui/permissions 层；页面引用不存在实体→冲突；`compiled-model` 装载后含 ui/permissions；page/permission/menu patch 可应用
