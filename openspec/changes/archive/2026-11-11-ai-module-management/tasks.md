# Implementation Tasks

## 1. AI Model Configuration

- [x] 1.1 Create database schema for AI models (model_config table)
- [x] 1.2 Create AI Model API endpoints (CRUD operations)
- [x] 1.3 Create AI Model configuration UI page (`/admin/ai-models`)
- [x] 1.4 Add Kimi API configuration form
- [x] 1.5 Add model testing functionality (test API connection)
- [x] 1.6 Add model validation and error handling

## 2. AI Module Development

- [x] 2.1 Create database schema for AI modules (ai_modules table)
- [x] 2.2 Create AI Module Development workspace page (`/admin/ai-modules/develop`)
- [x] 2.3 Integrate Patch Gateway with AI model for patch generation
- [x] 2.4 Add natural language input interface
- [x] 2.5 Add patch preview and editing capabilities
- [x] 2.6 `ai_module_versions` 快照（生成/修改/评审/发布/回滚）

## 3. AI Module Testing

- [x] 3.1 Create database schema for test cases (ai_module_tests table)
- [x] 3.2 Create AI Module Testing page (`/admin/ai-modules/test`)
- [x] 3.3 Create CRM module test suite (Customer, Order, OrderTracking, FinancialTransaction)
- [x] 3.4 Add automated test execution
- [x] 3.5 Add test result reporting and visualization
- [x] 3.6 `testResults.coverage`（场景/实体/百分比）

## 4. AI Module Review and Approval

- [x] 4.1 Create database schema for reviews (ai_module_reviews table)
- [x] 4.2 Create AI Module Review page (`/admin/ai-modules/review`)
- [x] 4.3 Add review workflow (pending → reviewing → approved/rejected)
- [x] 4.4 Add reviewer assignment and comments
- [x] 4.5 Add approval/rejection actions with reasons
- [x] 4.6 评审结果通知创建人（approval 分类，sourceEventId=review.id）

## 5. AI Module Publishing

- [x] 5.1 Create database schema for published modules (published_modules table)
- [x] 5.2 Create AI Module Publishing page (`/admin/ai-modules/publish`)
- [x] 5.3 Add publish (上架) functionality for approved modules
- [x] 5.4 Add unpublish (下架) functionality
- [x] 5.5 Add version management for published modules
- [x] 5.6 `POST :id/versions/:versionId/rollback` + Console 版本页

## 6. System Management Integration

- [x] 6.1 Add AI Model Configuration menu item
- [x] 6.2 Add AI Module Development menu item
- [x] 6.3 Add AI Module Testing menu item
- [x] 6.4 Add AI Module Review menu item
- [x] 6.5 Add AI Module Publishing menu item
- [x] 6.6 Update menu permissions

## 7. CRM Module Testing Integration

- [x] 7.1 Customer 场景（id/name/email + relations）
- [x] 7.2 Order 场景（orderNo/total/status）
- [x] 7.3 OrderTracking 场景（order/status/timestamp）
- [x] 7.4 FinancialTransaction 场景（transactionNumber/amount/type/status）
- [x] 7.5 `runTests` 直接调用 `runAllCrmScenarios`
- [x] 7.6 缺实体/字段返回 failed + 具体错误，不再假通过

## 8. Audit and Versioning

- [x] 8.1 `audit_logs` action `ai_module.*`（含回滚/删除）
- [x] 8.2 版本快照 + 审计双写
- [x] 8.3 `GET :id/versions` / `diff` + Console `/admin/ai-modules/versions`
- [x] 8.4 回滚恢复内容并打回 draft，重新评审

## 9. Documentation

- [x] 9.1 `docs/ai-module-management.md` §1
- [x] 9.2 `docs/ai-module-management.md` §2
- [x] 9.3 `docs/ai-module-management.md` §3
- [x] 9.4 `docs/ai-module-management.md` §4
- [x] 9.5 `docs/ai-module-management.md` §5
