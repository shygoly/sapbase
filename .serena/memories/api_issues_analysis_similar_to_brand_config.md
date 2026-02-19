# API 问题分析：类似 brand-config 的路径与 organizationId 问题

## 问题类型概览

### 1. 后端：`req.organizationId` 在 organization 路径下为 undefined

**根因**：`TenantContextMiddleware` 把以 `/api/organizations` 开头的请求视为“公开路径”，直接 `next()`，**从不设置** `req.organizationId`。

- 位置：`backend/src/organizations/middleware/tenant-context.middleware.ts`
- 逻辑：`isPublicPath = req.originalUrl.startsWith('/api/organizations')` 为 true 时跳过，不执行 `(req as any).organizationId = organizationId`。
- 因此：所有 `organizations/:organizationId/...` 下的 controller 若依赖 `(req as any).organizationId`，都会得到 `undefined`。

**正确做法**：在路由路径已包含 `:organizationId` 的 controller 中，用 **`@Param('organizationId')`** 从 URL 取 organizationId，不要依赖 `req.organizationId`。

**已检查的 controller**：

| Controller | 路径 | organizationId 来源 | 状态 |
|------------|------|----------------------|------|
| BrandConfigController | organizations/:organizationId/brand-config | 已改为 @Param | 已修复 |
| InvitationsController | organizations/:organizationId/invitations | @Param('organizationId') | 正常 |
| SubscriptionsController | organizations/:organizationId/subscriptions | @Param('organizationId') | 正常 |
| OrganizationsController | organizations (及 :id/...) | @Param('id') | 正常 |
| PluginsController | plugins (无 organizations 前缀) | (req as any).organizationId | 依赖中间件从 header/token 设置，路径非 public，当前行为正确 |

结论：仅 brand-config 曾错误依赖 `req.organizationId`，已通过改为 `@Param` 修复；其余 organization 相关 controller 已使用 `@Param`。

---

### 2. 前端：请求 URL 缺少 `/api` 导致 404

**根因**：若 `NEXT_PUBLIC_API_URL` 配置为带 `/api`（如 `http://localhost:3051/api`），与 axios 中写死的 `/api/...` 路径拼接后，可能得到错误 URL（如 `http://localhost:3051/organizations/...`），后端实际路由为 `PUT /api/organizations/...`，故 404。

**已做修复**：`speckit/src/lib/api/client.ts` 中统一 baseURL，去掉末尾 `/api`：

- `const API_BASE_URL = rawApiUrl.replace(/\/api\/?$/, '') || rawApiUrl`
- 保证 baseURL 仅为 origin（如 `http://localhost:3051`），所有请求路径继续使用 `/api/...`，最终 URL 始终为 `origin + /api/...`，与后端 `setGlobalPrefix('api')` 一致。

---

## 排查类似问题时建议

1. **后端**：凡路由为 `organizations/:organizationId/...` 的 controller，一律用 `@Param('organizationId')` 取 organizationId，不要用 `(req as any).organizationId`。
2. **后端**：新增依赖“当前组织”的接口时，若路径在 `/api/organizations` 下，优先从 URL 参数取 organizationId。
3. **前端**：保持 `client.ts` 中 baseURL 规范化（仅 origin，不含 `/api`）；所有 API 路径继续以 `/api/` 开头。
4. **环境变量**：`NEXT_PUBLIC_API_URL` 可设为 `http://localhost:3051` 或 `http://localhost:3051/api`，client 会统一成 origin，无需改各 API 文件的路径。
