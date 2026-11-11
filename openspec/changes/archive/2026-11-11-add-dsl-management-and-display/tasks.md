## 1. Remove Code Generation
- [x] 1.1 Delete generated frontend CRM pages
- [x] 1.2 Delete generated backend entity files
- [x] 1.3 Delete generated schema files (objects, views, pages, state-machines)
- [x] 1.4 Delete code generation E2E tests
- [x] 1.5 Delete CodeGeneratorService
- [x] 1.6 Remove generateSystem method from AI Modules Service
- [x] 1.7 Remove generate-system endpoint from AI Modules Controller
- [x] 1.8 Remove CodeGeneratorService from System Module
- [x] 1.9 Remove code generation UI from frontend
- [x] 1.10 Clean up generated menu items from database（seed 已移除 CRM 菜单并清理旧行）

## 2. Add DSL Viewing and Management
- [x] 2.1 Add API endpoint to get Module DSL (from ai_modules.patchContent)
- [x] 2.2 Add API endpoint to get 6-step definition (from ai_module_definitions)
- [x] 2.3 Add API endpoint to export DSL as JSON
- [x] 2.4 Add frontend component to display Module DSL
- [x] 2.5 Add frontend component to display 6-step definition
- [x] 2.6 Add DSL export button/functionality
- [x] 2.7 Add DSL browsing/search interface
- [x] 2.8 Add DSL version comparison (N/A：无历史表，`version` 仅为标签，见 `docs/module-dsl.md`)

## 3. Documentation
- [x] 3.1 Update API documentation for DSL endpoints (`docs/module-dsl.md`)
- [x] 3.2 Document DSL storage structure (`docs/module-dsl.md`)
- [x] 3.3 Document difference between Module DSL and Patch DSL (`docs/module-dsl.md` + `docs/patch-dsl.md`)
