# SaaS 多租户迁移指南

本指南对应 `migrate-to-saas-architecture`：组织/成员/邀请、租户隔离、订阅与活动日志。

## 1. 迁移顺序

1. 备份数据库。
2. 运行组织/成员/邀请/活动表迁移（`1737000000000-MigrateToSaaS` 及其后续迁移）。
3. 运行角色回填（dry-run 先看差异）：

   ```bash
   npm run identity:backfill-roles
   npm run identity:backfill-roles -- --apply
   ```

   回填只写主组织（最早加入的 `organization_members`），source=`legacy`。
4. 运行数据完整性检查：

   ```bash
   npm run saas:verify-integrity
   ```

   error 必须为 0；warning 逐条确认（历史用户无组织、全局原子契约等）。
5. 用管理员登录，确认 `/api/organizations` 返回组织列表；切换组织后
   `/api/users`、`/api/roles`、`/api/audit-logs` 只返回当前组织数据。

## 2. 回滚

- 迁移的 `down()` 删除新增表/列；先回滚代码再回滚迁移。
- 角色回填不自动删除；如需回滚，删除 `source='legacy'` 的
  `organization_member_roles` 并保留 `users.roleId` 兼容回退。
- 订阅数据回滚前先停止 Stripe webhook，避免回滚后继续写入。

## 3. 多组织注意事项

- `users` 是全局账号，组织关系在 `organization_members`；
  业务角色在 `organization_member_roles`（按组织）。
- 新组织创建者只获得 Owner 成员关系；如需业务权限，必须在新组织内
  创建/复制角色并授予，平台不会跨组织复用角色权限。
- 所有请求由 `api-client` 自动带 `X-Organization-Id`；服务端仍校验
  JWT 组织与成员关系，并以 RLS 兜底。

## 4. 验收

```bash
node tests/saas-organization.e2e.js
npm test --workspace @sap/api -- --runInBand
```

真实 Stripe 订阅需要 `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`；
未配置时 checkout/portal 返回 400，组织与团队功能不受影响。
