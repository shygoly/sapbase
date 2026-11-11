# Implementation Tasks

## 1. Database Schema Design

- [x] 1.1 Create `ModuleRegistry` entity with metadata fields
- [x] 1.2 Create `ModuleRelationship` entity for module dependencies/integrations
- [x] 1.3 Create `ModuleCapability` entity for tracking module capabilities
- [x] 1.4 Create `ModuleStatistics` entity for health and data metrics
- [x] 1.5 Create `ModuleConfiguration` entity for configuration documentation
- [x] 1.6 Add foreign key relationships between entities

## 2. Backend Module Registry Service

- [x] 2.1 Create `ModuleRegistryService` with CRUD operations
- [x] 2.2 Implement module registration on AI module creation
- [x] 2.3 Implement module relationship management (add, remove, query)
- [x] 2.4 Implement module capability tracking
- [x] 2.5 Implement module statistics collection
- [x] 2.6 Create AI context awareness API endpoints

## 3. Module Registration Integration

- [x] 3.1 Modify `AIModulesService` to register modules on creation
- [x] 3.2 Auto-detect module capabilities from patch content
- [x] 3.3 Extract module metadata from patch DSL
- [x] 3.4 Register CRM module with existing data

## 4. CRM Module Registration

- [x] 4.1 Create CRM module registry entry
- [x] 4.2 Define CRM module capabilities (Customer, Order, OrderTracking, FinancialTransaction CRUD)
- [x] 4.3 Document CRM module configuration
- [x] 4.4 Set up CRM module relationships (if any)
- [x] 4.5 Initialize CRM module statistics

## 5. Module Relationship Management

- [x] 5.1 `ModuleRelationship` 支持 dependency/integration/data-flow/hierarchical；类型校验
- [x] 5.2 add/update/remove/query + 同组织/自引用/重复校验
- [x] 5.3 `assertNoDependencyCycle` 返回具体路径（A → B → A）
- [x] 5.4 `GET /module-registry/graph` + 详情页 SVG 图

## 6. Frontend Module Registry UI

- [x] 6.1 Create module registry list page (`/admin/module-registry`)
- [x] 6.2 详情页 `/admin/module-registry/[id]`
- [x] 6.3 SVG `RelationshipGraph`（当前模块居中，类型区分线型）
- [x] 6.4 能力卡片：实体/类型/操作/端点
- [x] 6.5 统计表 + “收集统计”按钮
- [x] 6.6 配置新增/编辑/删除 + Schema JSON

## 7. AI Context Awareness API

- [x] 7.1 Create `/api/ai/modules` endpoint for listing modules
- [x] 7.2 Create `/api/ai/modules/:id` endpoint for module details
- [x] 7.3 Create `/api/ai/modules/:id/capabilities` endpoint
- [x] 7.4 Create `/api/ai/modules/:id/relationships` endpoint
- [x] 7.5 Create `/api/ai/modules/:id/statistics` endpoint
- [x] 7.6 `getAiGenerationContext` 注入六步生成 system prompt

## 8. Module Status & Health Tracking

- [x] 8.1 `PUT /:id/status`（active/inactive/deprecated/error）
- [x] 8.2 `POST /:id/statistics/collect`：information_schema + COUNT(*)
- [x] 8.3 `averageResponseTime` 记录每次收集耗时
- [x] 8.4 `module.error-rate` 健康检查（errorCount/recordCount）
- [x] 8.5 `GET /:id/health` + `GET /module-registry/health`

## 9. Module Configuration Documentation

- [x] 9.1 `schemas/module-registry.schema.json`
- [x] 9.2 详情页配置编辑器（configType/schema/documentation）
- [x] 9.3 `usage` 配置类型 + 编辑器
- [x] 9.4 `GET /:id/documentation` 生成 Markdown（可下载）
- [x] 9.5 生成文档包含关系（入/出 + 描述）

## 10. Validation & Testing

- [x] 10.1 jest：registration/status/AI context（39 tests）
- [x] 10.2 jest + e2e：CRUD/重复/环检测
- [x] 10.3 `getAiGenerationContext` 单测 + 生成 prompt 注入测试
- [x] 10.4 运行时 smoke：CRM 模块 graph/health/docs/collect 200
- [x] 10.5 单测（真实表 COUNT）+ 运行时 collect 201
- [x] 10.6 `tests/module-registry.e2e.js` 通过
