# 部署与数据库变更纪律

> 生产环境只允许通过 migration 改结构；`synchronize` 仅限本地开发显式开启。

## 环境矩阵

| 环境 | `NODE_ENV` | `DB_SYNCHRONIZE` | `synchronize` |
|---|---|---|---|
| 本地开发 | `development` | `true` | 开启 |
| 本地默认 | 任意其他 | 未设置/false | 关闭 |
| 测试/预发 | `test` / `staging` | 未设置/false | 关闭 |
| 生产 | `production` | 任意 | 强制关闭 |

规则：只有 `NODE_ENV=development && DB_SYNCHRONIZE=true` 才允许自动同步。

## 数据库变更纪律

1. 生产改表只允许增量迁移：先加列/表，再迁数据，最后删旧列（expand → migrate → contract）。
2. 大结构调整必须离线预演：在临时空库或影子库跑 migration，记录耗时与回退方案。
3. 破坏性迁移必须有补偿迁移或 `rollbackSafe=false` 明确标注；否则发布闸门 G3 拒绝。
4. 迁移一旦提交不回改；修复用新迁移。
5. 禁止用 `db pull`、手改生产库或整库快照来同步 schema。

## 迁移演练

```bash
docker run -d --rm --name sapbase-migrate -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16-alpine
DB_HOST=localhost DB_PORT=55432 DB_USERNAME=postgres DB_PASSWORD=postgres DB_NAME=sapbase_rebuild \
  npx ts-node --transpile-only apps/api/scripts/rebuild-database.ts --db=sapbase_rebuild
```

## 生产启动检查

- 启动日志必须显示 `synchronize=false`
- 生产数据库角色不得是表 owner、superuser 或 `BYPASSRLS`
- 先部署兼容代码，再激活 Release；回退 Release 不需要回滚进程

## SaaS 多租户部署

- 数据库：组织/成员/邀请/活动表 + `organizationId` 索引；生产应用角色必须
  非 owner、非 superuser、无 `BYPASSRLS`，并设置 `app.organization_id` 事务上下文。
- 缓存：多实例部署使用 Redis（`CACHE_DRIVER=redis`）；会话缓存只加速，
  `auth_sessions` 是吊销真源。
- 订阅：配置 `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`，前端配置
  `NEXT_PUBLIC_STRIPE_PRICE_PRO` / `NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE`。
  未配置时组织/团队功能正常，checkout/portal 返回 400。
- 迁移：先跑 `npm run identity:backfill-roles -- --apply`，再跑
  `npm run saas:verify-integrity`；error 为 0 才切换流量。
- 回滚：先停 Stripe webhook，再回滚应用与迁移；保留 `users.roleId` 兼容回退。
