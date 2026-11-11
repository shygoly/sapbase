# Change: 让角色携带的权限点真正生效（角色 → JWT 有效权限）

## Why

`roles` 表有 `permissions: string[]`；`RolesService` 能读写它；`seeds/mock-data.seed.ts` 里
`role.permissions = permissions.slice(...)` 赋值得很认真 —— 但 `AuthService.login` 只读
`user.permissions`，`role.permissions` **从来没有进入过 JWT**。

于是：**给角色配权限，配了等于没配**。`PermissionsGuard`（静态 any-of）与原子/工具面的
`missingPermissions`（运行时 all-of）读的都是 `user.permissions`，
"角色 → 权限"这条路上是断的，只有"用户直授"（`add-chat-first-erp` 的 C2.5 刚接通）能用。

这也解释了为什么平台上很多接口实际只靠 `@Roles('Admin')` 这类**角色名**守卫在工作：
按权限点判定的那部分一直是空的。

## What Changes

- **ADDED**: 登录与切换组织时解析**有效权限** = 「本次选中组织内、与该用户 `role` 同名且
  `status='active'` 的角色所携带的权限点」∪「用户直授权限点」，去重后写进 JWT 的 `permissions`。
- **ADDED**: **组织隔离是硬约束**：角色解析只在该用户本次选中的组织内进行，
  不允许跨组织取同名角色 —— 否则 A 组织的角色会授予 B 组织的权限。
- **ADDED**: fail-closed：角色不存在 / 已停用 / 无法确定组织 → 只保留直授权限；
  报错或放宽都是错的方向。
- **ADDED**: `RolesService.findByName(name, organizationId)`（当前只有 `findAll` / `findOne`）。
- **ADDED**: 判定只有一份 —— 抽成一个可注入的服务，`login` 与 `switchOrganization` 共用，
  以后"刷新令牌"也复用它。
- **MODIFIED**: 无。`users.permissions` 的语义不变，仍然是"直授"。

## Impact

- 受影响规格：新增能力 `authorization`
- 受影响代码：`backend/src/auth/auth.service.ts`（login / switchOrganization）、
  `backend/src/auth/effective-permissions.service.ts`（新增）、
  `backend/src/roles/roles.service.ts`、对应 spec、`.github/workflows/ci.yml`（若新增 e2e）
- **这是一次访问控制的**行为变更**：以前配了不生效，以后会生效。**
  风险是"某些用户的权限突然变多"。对策（写死在设计与测试里）：
  只并 `active` 角色、严格组织内解析、直授权限与角色权限取**并集**（不会减少任何人的现有权限，
  也不会让直授失效）、并且专测"跨组织角色不生效"与"停用角色不生效"。
- 风险 2：`users.role` 是自由字符串，可能与 `roles.name` 对不上（例如默认值 `'user'`
  在某些组织里没有对应角色）。此时按 fail-closed 处理：只拿直授权限，不报错。
