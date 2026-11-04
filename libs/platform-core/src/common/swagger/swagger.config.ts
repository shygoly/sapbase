import { DocumentBuilder, SwaggerDocumentOptions } from '@nestjs/swagger'

/**
 * Enhanced Swagger configuration with comprehensive API documentation.
 */
export function createSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Speckit ERP Backend API')
    .setDescription(
      `
# Speckit ERP Backend API

Complete REST API documentation for Speckit ERP system.

## Features

- **Authentication**: JWT-based authentication with organization support
- **Multi-tenancy**: Organization-scoped resources
- **Real-time**: WebSocket support for notifications and collaboration
- **Workflow Engine**: Advanced workflow management
- **AI Integration**: AI module development and management

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Base URL

- **Development**: http://localhost:3051/api
- **Production**: https://api.speckit.com/api

## Rate Limiting

API requests are rate-limited to prevent abuse. Current limits:
- **Authenticated**: 1000 requests/hour
- **Unauthenticated**: 100 requests/hour

## Error Responses

All errors follow a consistent format:

\`\`\`json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoint"
}
\`\`\`

## WebSocket

Real-time features are available via WebSocket:
- **URL**: ws://localhost:3051
- **Authentication**: JWT token in connection handshake
- **Events**: See WebSocket documentation for available events

## Support

For API support, please contact: api-support@speckit.com
      `.trim(),
    )
    .setVersion('1.0.0')
    .setContact('Speckit API Support', 'https://speckit.com', 'api-support@speckit.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3051/api', 'Development Server')
    .addServer('https://api.speckit.com/api', 'Production Server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      'access-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API Key for service-to-service authentication',
      },
      'api-key',
    )
    .addTag('Auth', 'Authentication and authorization endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Organizations', 'Organization management endpoints')
    .addTag('Roles', 'Role management endpoints')
    .addTag('Departments', 'Department management endpoints')
    .addTag('Permissions', 'Permission management endpoints')
    .addTag('Menu', 'Menu management endpoints')
    .addTag('Audit Logs', 'Audit log endpoints')
    .addTag('Settings', 'Settings endpoints')
    .addTag('Workflows', 'Workflow management endpoints')
    .addTag('AI Modules', 'AI module development and management')
    .addTag('AI Models', 'AI model configuration')
    .addTag('Module Registry', 'Module registry endpoints')
    .addTag('Health', 'Health check endpoints')
    .addTag('System', 'System administration endpoints')
    .build()
}

/**
 * Swagger document options for enhanced documentation.
 */
export const swaggerDocumentOptions: SwaggerDocumentOptions = {
  operationIdFactory: (controllerKey: string, methodKey: string) =>
    `${controllerKey}_${methodKey}`,
  deepScanRoutes: true,
}
