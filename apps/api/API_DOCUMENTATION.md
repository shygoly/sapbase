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
