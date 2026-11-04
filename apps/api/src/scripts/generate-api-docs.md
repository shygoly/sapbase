# API Documentation Generation Guide

## Overview

This project includes automated tools for generating comprehensive API documentation:

1. **OpenAPI Specification** - Standard API specification in JSON/YAML format
2. **Postman Collection** - Ready-to-import Postman collection for testing
3. **Swagger UI** - Interactive API documentation (available at `/api/docs`)

## Quick Start

### Generate All Documentation

```bash
npm run generate:docs
```

This will generate:
- `openapi.json` - OpenAPI 3.0 specification (JSON)
- `openapi.yaml` - OpenAPI 3.0 specification (YAML, if yaml package installed)
- `postman-collection.json` - Postman collection

### Generate Individual Files

```bash
# Generate OpenAPI specification only
npm run generate:openapi

# Generate Postman collection only
npm run generate:postman
```

## Using Generated Documentation

### OpenAPI Specification

The OpenAPI specification can be used with:

1. **Swagger UI** - Already integrated at `/api/docs`
2. **Redoc** - Generate beautiful documentation
3. **API Clients** - Generate client SDKs
4. **API Testing Tools** - Import into testing frameworks

#### Using with Redoc

```bash
# Install Redoc CLI
npm install -g redoc-cli

# Generate HTML documentation
redoc-cli bundle openapi.json -o api-docs.html
```

#### Generate Client SDKs

```bash
# Using OpenAPI Generator
npx @openapitools/openapi-generator-cli generate \
  -i openapi.json \
  -g typescript-axios \
  -o ./generated-client
```

### Postman Collection

1. **Import into Postman**:
   - Open Postman
   - Click "Import"
   - Select `postman-collection.json`
   - All endpoints will be available with examples

2. **Set Environment Variables**:
   - Create a new environment in Postman
   - Add variable `base_url` = `http://localhost:3051/api`
   - Add variable `access_token` = your JWT token

3. **Run Collection**:
   - Use Postman's collection runner
   - Set up tests and assertions
   - Automate API testing

## Customization

### Modify Swagger Configuration

Edit `src/common/swagger/swagger.config.ts` to customize:
- API title and description
- Contact information
- Server URLs
- Authentication methods
- Tags and grouping

### Add Examples to Endpoints

Use decorators in controllers:

```typescript
import { ApiExampleResponse } from '@/common/swagger'

@ApiExampleResponse({
  status: 200,
  example: { id: '123', name: 'Example' }
})
@Get(':id')
async getOne(@Param('id') id: string) {
  // ...
}
```

### Add Comprehensive Documentation

```typescript
import { ApiEndpoint } from '@/common/swagger'

@ApiEndpoint({
  summary: 'Get user by ID',
  description: 'Retrieves a user by their unique identifier',
  params: [
    {
      name: 'id',
      description: 'User unique identifier',
      required: true,
      example: '123e4567-e89b-12d3-a456-426614174000'
    }
  ],
  responses: [
    {
      status: 200,
      description: 'User found',
      example: { id: '123', email: 'user@example.com' }
    },
    {
      status: 404,
      description: 'User not found'
    }
  ]
})
@Get(':id')
async getOne(@Param('id') id: string) {
  // ...
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Generate API Docs

on:
  push:
    branches: [main]

jobs:
  generate-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run generate:docs
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
          publish_branch: gh-pages
          keep_files: true
```

## Best Practices

1. **Keep Examples Updated**: Update examples when API changes
2. **Add Descriptions**: Always add descriptions to endpoints and parameters
3. **Document Errors**: Include all possible error responses
4. **Version Control**: Commit generated files or generate in CI/CD
5. **Review Changes**: Review documentation changes in PRs

## Troubleshooting

### YAML Generation Fails

Install the yaml package:
```bash
npm install yaml --save-dev
```

### Postman Collection Missing Endpoints

Ensure all controllers use proper Swagger decorators:
- `@ApiTags()` for grouping
- `@ApiOperation()` for descriptions
- `@ApiResponse()` for responses

### Generated Files Not Updating

Clear cache and regenerate:
```bash
rm -f openapi.json openapi.yaml postman-collection.json
npm run generate:docs
```
