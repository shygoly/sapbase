# AI-Created Module Management System Design

## Problem Statement

AI-created modules (like CRM) currently exist in isolation without centralized management, making it difficult to:
- Track all AI-generated modules
- Understand module relationships and dependencies
- Provide AI with context about existing modules
- Monitor module health and capabilities
- Manage module configuration and documentation

## Architecture Overview

### Module Registry System

```
┌─────────────────────────────────────────────────────────┐
│              Module Registry System                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │   Module     │    │ Relationship │                  │
│  │  Registry    │◄───┤  Management   │                  │
│  └──────────────┘    └──────────────┘                  │
│         │                    │                           │
│         │                    │                           │
│         ▼                    ▼                           │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │ Capabilities │    │  Statistics  │                  │
│  │   Tracking   │    │   & Health   │                  │
│  └──────────────┘    └──────────────┘                  │
│                                                          │
│         │                    │                           │
│         └────────┬───────────┘                           │
│                  ▼                                        │
│         ┌─────────────────┐                              │
│         │ AI Context API  │                              │
│         └─────────────────┘                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Data Model

**ModuleRegistry Entity:**
```typescript
{
  id: string
  name: string                    // e.g., "CRM Module"
  description: string
  moduleType: string              // "crud", "workflow", "integration"
  aiModelId: string               // Which AI model created it
  createdById: string
  createdAt: Date
  version: string
  status: "active" | "inactive" | "deprecated" | "error"
  patchId: string                 // Reference to AIModule
  metadata: {
    schemaPath: string
    apiBasePath: string
    entities: string[]            // ["Customer", "Order", ...]
  }
}
```

**ModuleRelationship Entity:**
```typescript
{
  id: string
  sourceModuleId: string
  targetModuleId: string
  relationshipType: "dependency" | "integration" | "data-flow" | "hierarchical"
  description: string
  configuration: Record<string, any>
  createdAt: Date
}
```

**ModuleCapability Entity:**
```typescript
{
  id: string
  moduleId: string
  capabilityType: "crud" | "query" | "action" | "workflow"
  entity: string                 // e.g., "Customer"
  operations: string[]            // ["create", "read", "update", "delete"]
  apiEndpoints: string[]         // ["/api/crm/customers", ...]
  description: string
}
```

**ModuleStatistics Entity:**
```typescript
{
  id: string
  moduleId: string
  entity: string
  recordCount: number
  lastUpdate: Date
  errorCount: number
  averageResponseTime: number
  healthStatus: "healthy" | "warning" | "error"
  collectedAt: Date
}
```

## Module Registration Flow

```
AI Module Creation
       │
       ▼
Generate Patch DSL
       │
       ▼
Apply Patch
       │
       ▼
Auto-detect Capabilities
       │
       ▼
Register Module
       │
       ├──► Extract Metadata
       ├──► Define Capabilities
       ├──► Set Relationships
       └──► Initialize Statistics
```

## AI Context Awareness

AI system can query module registry to:
1. **List Available Modules**: Get all registered modules with basic info
2. **Module Details**: Get full module information including capabilities
3. **Module Relationships**: Understand dependencies and integrations
4. **Module Statistics**: Check module health and data status
5. **Module Configuration**: Understand module requirements

This enables AI to:
- Avoid creating duplicate modules
- Understand existing capabilities before generating new ones
- Make informed decisions about module integration
- Provide context-aware suggestions

## CRM Module Example

**Registration:**
```json
{
  "name": "CRM Module",
  "description": "Customer Relationship Management module with Customer, Order, OrderTracking, and FinancialTransaction entities",
  "moduleType": "crud",
  "version": "1.0.0",
  "status": "active",
  "metadata": {
    "schemaPath": "/public/specs/modules/crm",
    "apiBasePath": "/crm",
    "entities": ["Customer", "Order", "OrderTracking", "FinancialTransaction"]
  },
  "capabilities": [
    {
      "entity": "Customer",
      "operations": ["create", "read", "update", "delete", "list"],
      "apiEndpoints": ["/crm/customers"]
    },
    {
      "entity": "Order",
      "operations": ["create", "read", "update", "delete", "list"],
      "apiEndpoints": ["/crm/orders"]
    }
  ],
  "relationships": [],
  "statistics": {
    "Customer": { "recordCount": 2, "lastUpdate": "2026-02-16T..." },
    "Order": { "recordCount": 0, "lastUpdate": null }
  }
}
```

## UI Components

1. **Module Registry List**:
   - Table view of all modules
   - Filter by status, type, AI model
   - Search by name/description
   - Quick actions (view, edit, disable)

2. **Module Detail Page**:
   - Module metadata
   - Capabilities list
   - Relationships visualization (graph)
   - Statistics dashboard
   - Configuration editor

3. **Relationship Graph**:
   - Visual representation of module relationships
   - Interactive node-link diagram
   - Filter by relationship type

## API Endpoints

**Module Registry:**
- `GET /api/module-registry` - List all modules
- `GET /api/module-registry/:id` - Get module details
- `POST /api/module-registry` - Register new module
- `PUT /api/module-registry/:id` - Update module
- `DELETE /api/module-registry/:id` - Unregister module

**Relationships:**
- `GET /api/module-registry/:id/relationships` - Get module relationships
- `POST /api/module-registry/:id/relationships` - Add relationship
- `DELETE /api/module-registry/:id/relationships/:relId` - Remove relationship

**AI Context:**
- `GET /api/ai/modules` - List modules for AI context
- `GET /api/ai/modules/:id` - Get module context for AI
- `GET /api/ai/modules/:id/capabilities` - Get module capabilities
- `GET /api/ai/modules/:id/relationships` - Get module relationships
- `GET /api/ai/modules/:id/statistics` - Get module statistics

## Benefits

1. **Visibility**: Centralized view of all AI-created modules
2. **Context Awareness**: AI can understand existing modules before creating new ones
3. **Relationship Management**: Understand dependencies and integrations
4. **Health Monitoring**: Track module status and performance
5. **Documentation**: Centralized configuration and documentation
6. **Avoid Duplication**: AI can check existing modules before creating duplicates
