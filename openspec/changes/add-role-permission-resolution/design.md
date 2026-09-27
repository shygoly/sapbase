# Design: 角色 → JWT 有效权限

## Context

现状（已核对代码）：

- `User.role` 是单个字符串（默认 `'user'`），`User.permissions` 是 `simple-array`（直授）。
- `Role` 继承 `TenantAwareEntity`，唯一键是 `(organizationId, name)`，带
  `permissions: simple-array` 与 `status: 'active' | 'inactive'`。
- `RolesService` 有 `create` / `findAll(organizationId)` / `findOne(id, organizationId)` /
  `update` / `remove`，**没有按名字查**。
- `AuthService.login(user, organizationId?)` 会先算出 `selectedOrgId`
  （传入则校验访问权，只有一个组织则自动选中，否则为 `undefined`），然后签发
  `{ sub, email, role, permissions: user.permissions || [], organizationId }`。
- `RolesGuard` 判 `user.role`；`PermissionsGuard` 与 `missingPermissions` 判 `user.permissions`。

## Goals / Non-Goals

- Goals：让"给角色配的权限点"真正到达判定点；组织隔离；fail-closed；判定只有一份。
- Non-Goals：不做多角色（`user_roles` 关联表）—— 那是更大的模型变更，本变更只解决
  "单个角色名的权限没生效"；不改 `RolesGuard` 的角色名判定；不引入权限继承/层级。

## Decisions

### 决策 1：有效权限 = 组织内同名 active 角色的权限 ∪ 用户直授（并集）

- 并集而不是"角色优先"或"覆盖"：直授是 `add-chat-first-erp` C2.5 刚建立的授予面，
  不能被角色解析吃掉；并集也保证**不会减少任何人的现有权限**，降低回归风险。
- 去重，且保持稳定顺序（先角色、后直授）以免测试与审计出现无意义的抖动。

### 决策 2：组织隔离靠"选中组织"，而不是靠用户

- 解析必须在 `selectedOrgId` 之内进行。`selectedOrgId` 为 `undefined`（用户没有组织、
  或多组织且未选择）时 **不做角色解析**，只给直授 —— 没有组织上下文就没有组织内的角色，
  fail-closed。这条必须有专门测试。

### 决策 3：fail-closed，且"查不到"不是错误

- 角色不存在、已停用、组织不匹配 → 直授权限原样返回，登录**不失败**。
  理由：`users.role` 是自由字符串，历史上可能对不上任何角色行；
  把登录打挂是更坏的失败模式，而"权限少"永远是安全方向。

### 决策 4：抽成一个可注入服务，不做在 AuthService 里内联

- `login` 与 `switchOrganization` 都要用；以后"刷新令牌"也要用。
  内联会造成第二份判定（元语不变量 12）。建议
  `backend/src/auth/effective-permissions.service.ts`，依赖 `RolesService`。

### 决策 5：JWT 与响应都换成有效权限

- `JwtPayload.permissions` 与登录响应里的 `user.permissions` 都换成**有效权限**，
  否则前端与守卫看到的不是一回事。`role` 字段不变。

## Risks / Trade-offs

| 风险 | 对策 |
| --- | --- |
| 配了角色权限的用户**权限变多**（行为变更） | 只并 `active` 角色、严格组织内、并集不减权限；proposal 里显式声明这是行为变更 |
| 跨组织取到同名角色 → 越权 | 强制 `findByName(name, selectedOrgId)`；专测"别的组织的同名角色不生效" |
| `users.role` 对不上角色行 | fail-closed：只留直授，不报错；专测 |
| 停用角色仍然生效 | 只认 `status='active'`；专测 |
| 变成第二份权限判定 | 单一服务，`login` / `switchOrganization` 共用；测试断言两者一致 |
