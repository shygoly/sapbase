# speckit/ —— 前端运行时（Next.js App Router）

本目录是 ERP 前端运行时：Schema 驱动 + Runtime-First 组件 + Patch DSL。

## 开工前必读

- 仓库级元语与硬规则：[`../docs/META_LANGUAGE.md`](../docs/META_LANGUAGE.md)、[`../openspec/project.md`](../openspec/project.md)
- 本目录的**结构化文档（真源）**：

| 主题 | 文档 |
| --- | --- |
| Schema 驱动系统（页面/表单/视图生成） | [`docs/schema-system.md`](./docs/schema-system.md) |
| 增量修改机制 Patch DSL | [`docs/patch-dsl.md`](./docs/patch-dsl.md) |
| Runtime-First 组件模式 | [`docs/component-patterns.md`](./docs/component-patterns.md) |
| 插件体系（UI / Integration / Theme） | [`docs/plugins.md`](./docs/plugins.md) |
| 导航与 RBAC | [`docs/nav-rbac.md`](./docs/nav-rbac.md) |
| 主题体系 | [`docs/themes.md`](./docs/themes.md) |
| 集成指南 | [`docs/frontend-integration-guide.md`](./docs/frontend-integration-guide.md) |
| CRM 模块（第一个业务样板） | [`docs/crm-module.md`](./docs/crm-module.md)、[`docs/crm-integration.md`](./docs/crm-integration.md) |

## 本目录约定

1. **只允许 npm**，且不要在 `speckit/` 内单独安装依赖 —— 在仓库根执行 `npm install`（见 [`../docs/PACKAGE_MANAGER.md`](../docs/PACKAGE_MANAGER.md)）。
2. `README.md` 是上游 starter 模板原文（含 Next 16 / React 19 / Clerk 等过时描述），
   **技术栈以 [`../docs/TECH_STACK_v2.md`](../docs/TECH_STACK_v2.md) 为准**，认证鉴权走自研 JWT（`@clerk` 依赖是待清理的残留）。
3. 前端目前**没有测试框架**（`speckit-legacy/` 曾有 jest + Playwright 但未迁移）；
   改动核心逻辑（`src/core/schema`、`src/core/patch`、`src/core/plugins`）时请手动验证并在说明里写清验证方式。
4. 新增描述性内容请写入上表既有文档，**不要另建新文件**。
