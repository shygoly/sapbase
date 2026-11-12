# 组织管理员指南

## 组织与成员

- 入口：Portal → Workspaces / Team（`/dashboard/workspaces/team`）。
- Owner 可以邀请成员、取消邀请、调整 Owner/Member、移除成员。
- 邀请链接：`/invitations/:token`；接受后自动加入组织。
- 成员列表只显示当前组织；跨组织读取返回 404。
- 活动日志：`GET /api/organizations/:id/activities`，记录创建组织、邀请、
  接受、移除、角色变更、品牌配置更新。

## 角色与权限

- `Owner/Member` 是组织成员角色，不是业务权限。
- 业务权限来自组织内角色（`organization_member_roles`）∪ 用户直授权限。
- 新组织默认只给创建者 Owner 成员关系；请在新组织内配置角色并授予，
  平台不会跨组织复用角色权限。
- 角色/权限变更后旧 JWT 的 `pv` 失效，需要重新登录。

## 租户隔离

- 前端 `api-client` 自动带 `X-Organization-Id`。
- 服务端校验 JWT 组织与成员关系；数据库 RLS 兜底。
- 切换组织：侧边栏组织选择器或 `POST /api/auth/switch-organization`。

## 订阅

- 入口：Portal → Billing（`/dashboard/billing`）与 `/pricing`。
- 未配置 Stripe 时页面可预览，Checkout/Portal 按钮禁用。
- 配置见 [stripe-billing.md](./stripe-billing.md)。

## 数据检查

```bash
npm run saas:verify-integrity
```

error 必须为 0；warning 逐条确认。迁移步骤见
[saas-migration.md](./saas-migration.md)。
