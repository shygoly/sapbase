# API Documentation Guide

## Overview

Speckit ERP Backend provides comprehensive API documentation through multiple formats:

- **Swagger UI** - Interactive documentation at `/api/docs`
- **OpenAPI Specification** - Standard API spec (JSON/YAML)
- **Postman Collection** - Ready-to-import collection

## Accessing Documentation

### Swagger UI

Visit: `http://localhost:3051/api/docs`

Features:
- Interactive API explorer
- Try-it-out functionality
- Authentication support
- Request/response examples
- Schema definitions

### OpenAPI Specification

Generate with:
```bash
npm run generate:openapi
```

Files generated:
- `openapi.json` - JSON format
- `openapi.yaml` - YAML format (requires `yaml` package)

### Postman Collection

Generate with:
```bash
npm run generate:postman
```

File generated:
- `postman-collection.json` - Import into Postman

## API Features

### Authentication

Most endpoints require JWT authentication:

```http
Authorization: Bearer <your-jwt-token>
```

Get token via `/api/auth/login` endpoint.

会话权限点是访问控制行为（不是展示字段）：组织内同名 active 角色 ∪ 用户直授。

### API Versioning

API versioning is supported via header:

```http
X-API-Version: v1
```

Default version is `v1` if not specified.

### Error Responses

All errors follow consistent format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoint"
}
```

### Pagination

List endpoints support pagination:

```http
GET /api/users?page=1&limit=10
```

Response format:
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10,
  "hasNext": true,
  "hasPrev": false
}
```

## Using Swagger Decorators

### Basic Usage

```typescript
import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'

@ApiTags('Users')
@Controller('users')
export class UsersController {
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  @Get()
  async findAll() {
    // ...
  }
}
```

### Enhanced Documentation

```typescript
import { ApiEndpoint } from '@/common/swagger'

@ApiEndpoint({
  summary: 'Create user',
  description: 'Creates a new user account',
  body: {
    description: 'User creation data',
    example: {
      email: 'user@example.com',
      password: 'securePassword123',
      name: 'John Doe'
    }
  },
  responses: [
    {
      status: 201,
      description: 'User created successfully',
      example: {
        id: '123',
        email: 'user@example.com',
        name: 'John Doe'
      }
    },
    {
      status: 400,
      description: 'Validation error'
    }
  ]
})
@Post()
async create(@Body() createUserDto: CreateUserDto) {
  // ...
}
```

### Paginated Responses

```typescript
import { ApiPaginatedResponse } from '@/common/swagger'
import { User } from './user.entity'

@ApiPaginatedResponse({
  type: User,
  example: [
    { id: '1', email: 'user1@example.com' },
    { id: '2', email: 'user2@example.com' }
  ]
})
@Get()
async findAll() {
  // ...
}
```

## Best Practices

1. **Always add descriptions** - Help developers understand endpoints
2. **Include examples** - Show expected request/response formats
3. **Document errors** - List all possible error responses
4. **Use tags** - Group related endpoints
5. **Keep updated** - Update docs when API changes

## Generating Documentation

### Development

```bash
# Generate all documentation
npm run generate:docs

# Generate OpenAPI only
npm run generate:openapi

# Generate Postman only
npm run generate:postman
```

### CI/CD

Add to your CI pipeline:

```yaml
- name: Generate API Docs
  run: npm run generate:docs
  
- name: Upload artifacts
  uses: actions/upload-artifact@v2
  with:
    name: api-docs
    path: |
      openapi.json
      openapi.yaml
      postman-collection.json
```

## Integration Examples

### Redoc

Generate beautiful HTML documentation:

```bash
npm install -g redoc-cli
redoc-cli bundle openapi.json -o api-docs.html
```

### OpenAPI Generator

Generate client SDKs:

```bash
npx @openapitools/openapi-generator-cli generate \
  -i openapi.json \
  -g typescript-axios \
  -o ./generated-client
```

### Postman

1. Import `postman-collection.json`
2. Set environment variables:
   - `base_url`: `http://localhost:3051/api`
   - `access_token`: Your JWT token
3. Run collection tests

## Troubleshooting

### Documentation not updating

1. Clear browser cache
2. Regenerate documentation: `npm run generate:docs`
3. Restart server

### Missing endpoints

Ensure controllers use Swagger decorators:
- `@ApiTags()` - Required for grouping
- `@ApiOperation()` - Recommended for descriptions

### Postman import fails

Check that:
1. Collection file is valid JSON
2. All required fields are present
3. Postman version supports collection format

## Support

For API documentation issues:
- Check Swagger UI at `/api/docs`
- Review generated OpenAPI spec
- Contact: api-support@speckit.com

## Bulk Import / Export

资源与模板：

- `GET /api/imports/resources` — 已注册资源与字段定义
- `GET /api/imports/resource?resourceKey=...&direction=import|export` — 单资源描述
- `GET /api/imports/template?resourceKey=...&format=csv|xlsx` — 模板下载

导入：

- `POST /api/imports` — multipart `file` 或 JSON `{ assetId }`；可选
  `resourceKey`、`mode=atomic|partial`、`dryRun`、`mapping`、`mappingName`、
  `unknownColumns=reject|ignore`、`Idempotency-Key`
- `GET /api/imports` / `GET /api/imports/:id`
- `GET /api/imports/:id/errors` — 错误报告 CSV
- `POST /api/imports/:id/cancel` / `POST /api/imports/:id/retry`

导出：

- `POST /api/exports` — `{ resourceKey, format, fields, filter, sort, order, search,
  restrictedFieldPolicy, piiPolicy }`
- `GET /api/exports` / `GET /api/exports/:id`
- `GET /api/exports/:id/download` — 鉴权下载
- `GET /api/exports/:id/url?ttl=300` — 短时签名 URL
- `POST /api/exports/:id/cancel`

映射：

- `GET /api/import-mappings?resourceKey=...`
- `POST /api/import-mappings`
- `DELETE /api/import-mappings/:id`

权限：`imports:read|manage`、`exports:read|manage`；异步任务需要
`job:bulk.import:create` / `job:bulk.export:create`（或 `jobs:manage`）。

## External Integration

权限：`integrations:read` / `integrations:manage`；凭证只存 `secretRef`（如 `env:MY_SECRET`），
响应脱敏。

连接器：

- `GET/POST /api/integrations/connectors`
- `PATCH/DELETE /api/integrations/connectors/:id`
- `POST /api/integrations/connectors/:id/test`
- `POST /api/integrations/connectors/:id/messages` — `{ eventType, payload, idempotencyKey }`

出站/Webhook：

- `GET /api/integrations/outbound` / `GET /api/integrations/outbound/:id`
- `POST /api/integrations/outbound/:id/replay`
- `GET/POST /api/integrations/webhooks`
- `POST /api/integrations/webhooks/:organizationId/:key` — 公共入站，HMAC 头
  `x-signature`/`x-timestamp`/`x-event-id`
- `GET /api/integrations/webhook-events` / `POST /api/integrations/webhook-events/:id/replay`

数据库同步：

- `GET/POST /api/integrations/data-sources` / `POST /api/integrations/data-sources/:id/test`
- `GET/POST /api/integrations/sync-jobs` / `POST /api/integrations/sync-jobs/:id/run`
- `GET /api/integrations/sync-runs?jobId=...`
- 查询模板白名单：`students_incremental` / `students_count` / `departments_incremental`

外部身份：

- `GET /api/integrations/external/whoami` — 服务令牌头
  `X-Organization-Id` / `X-Service-Key` / `X-Service-Secret`，scope `integrations.read`
- `GET /api/integrations/external/records/:packageId/:entity` — 额外 `X-On-Behalf-Of`，
  服务端重新解析用户权限/数据范围
- `GET /api/integrations/metrics` — 出站成功率/DLQ/同步行数/差异

## Identity & Session Governance

权限：`identity:read` / `identity:manage`。JWT 携带 `sid` 与 `pv`（权限版本）；`sid` 对应
`auth_sessions`，`pv` 不匹配或账号停用返回 401。

身份提供方：

- `GET/POST /api/identity/providers`
- `PATCH/DELETE /api/identity/providers/:id`
- 支持 `cas` / `oauth2` / `oidc` / `saml`；`secretRef` 只存引用，响应不回显 secret。
- 公开入口：`GET /api/identity/sso/providers?organizationId=...`、
  `GET /api/identity/sso/:key/authorize`、`POST /api/auth/sso/:key/callback`。

会话/登录事件：

- `GET /api/identity/sessions?userId=...`
- `POST /api/identity/sessions/revoke` — `{ sid }` 或 `{ userId, reason }`
- `GET /api/identity/login-events?userId=&limit=`
- 新设备/新 IP 成功登录会通知本人与组织管理员。

服务客户端/委托：

- `GET/POST /api/identity/service-clients`
- `PATCH /api/identity/service-clients/:id`
- `POST /api/identity/service-clients/:id/rotate` — secret 只返回一次
- `POST /api/identity/delegation/resolve` — `{ userId }` 重解析角色/功能权限
- `POST /api/identity/delegation/scope` — `{ userId, resourceKey, action }` 重解析数据范围
- 服务令牌头：`X-Organization-Id` / `X-Service-Key` / `X-Service-Secret`；
  默认每分钟 120 次限流，超限 429，拒绝/使用写审计。

身份同步：

- `POST /api/identity/sync/:providerKey/run`
- `GET /api/identity/sync/runs?providerId=`
- `POST /api/identity/sync/runs/:id/confirm` — 确认高风险离职差异
- `provider.config.users` 支持静态身份源；`provider.config.confirmDeactivations=true`
  时离职差异先进入 `pending`，人工确认后执行。

## Organizations & SaaS

所有受保护接口需要 `Authorization` 与 `X-Organization-Id`；服务端校验 JWT 组织
与成员关系，数据库 RLS 兜底。

- `GET/POST /api/organizations`
- `GET/PATCH /api/organizations/:id`
- `GET /api/organizations/:id/members`
- `POST /api/organizations/:id/members` — `{ userId, role }`
- `DELETE /api/organizations/:id/members/:userId`
- `PATCH /api/organizations/:id/members/:userId/role` — `{ role }`
- `GET /api/organizations/:id/activities?limit=`
- `GET/POST /api/organizations/:id/invitations`
- `POST /api/organizations/:id/invitations/accept/:token`
- `DELETE /api/organizations/:id/invitations/:id`
- `GET /api/invitations/token/:token` — 公开邀请详情
- `GET /api/organizations/:id/subscriptions/status`
- `POST /api/organizations/:id/subscriptions/checkout` — `{ priceId }`
- `POST /api/organizations/:id/subscriptions/portal` — `{ returnUrl }`
- `POST /api/organizations/:id/subscriptions/webhook` — Stripe 签名 webhook

用户列表/详情已按组织过滤；跨组织用户返回 404。订阅未配置时 status 返回
`configured=false`，checkout/portal 返回 400。
