## 1. 权限判定

- [x] 1.1 `shared-core` 增加 `canAccessBlueprintResource` / `canAccessBlueprintPage`
- [x] 1.2 `permissions.json` 增加 `roleMappings`；Schema/compiler/definition 映射同步
- [x] 1.3 语义运行时 write/list/read/transition/delete/import 接入
- [x] 1.4 单测：角色、roleMappings、resource/action、默认放行

## 2. UI 消费

- [x] 2.1 `GET /blueprints/:id/entities` 返回完整实体字段
- [x] 2.2 api-client：getEntities / getUi / getPermissions / createRecord
- [x] 2.3 `BlueprintAppRuntime`：菜单 + list/form/detail，按角色过滤
- [x] 2.4 portal 动态路由 `/[locale]/dashboard/apps/[packageId]/[[...page]]`

## 3. 验收

- [x] 3.1 `ui-runtime` typecheck 通过
- [x] 3.2 portal `next build` 输出动态 app 路由
- [x] 3.3 `apps/api` 全量 jest 绿
- [x] 3.4 build / check:all / lint:boundaries 0 error
- [x] 3.5 证据：`apps/api` 142 suites / 1042 tests 绿；`ui-runtime` typecheck / portal build 通过；构建输出 `/[locale]/dashboard/apps/[packageId]/[[...page]]` 动态路由
