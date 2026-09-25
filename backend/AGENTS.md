# backend/ —— NestJS 服务端

本目录是 Speckit ERP 的 API 服务：NestJS + TypeORM + PostgreSQL + Redis。

## 开工前必读

- 仓库级元语与硬规则：[`../docs/META_LANGUAGE.md`](../docs/META_LANGUAGE.md)、[`../openspec/project.md`](../openspec/project.md)
- 本目录的**结构化文档（真源）**：

| 主题 | 文档 |
| --- | --- |
| 开发者指南 | [`docs/developer-guide.md`](./docs/developer-guide.md) |
| 实体基类约定（Base Object） | [`docs/architecture/base-object-pattern.md`](./docs/architecture/base-object-pattern.md) |
| AI 模块的数据与安全 | [`docs/ai-modules-database-and-security.md`](./docs/ai-modules-database-and-security.md) |
| 工作流引擎 | [`src/workflows/README.md`](./src/workflows/README.md) |
| API 文档 / 测试覆盖 / WebSocket / 文件上传 / Redis | [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md)、[`TEST_COVERAGE.md`](./TEST_COVERAGE.md)、[`WEBSOCKET.md`](./WEBSOCKET.md)、[`FILE_UPLOAD_SETUP.md`](./FILE_UPLOAD_SETUP.md)、[`REDIS_INTEGRATION.md`](./REDIS_INTEGRATION.md) |

## 本目录约定

1. **只允许 npm**，且不要在 `backend/` 内单独安装依赖 —— 在仓库根执行 `npm install`。
2. **多租户**：业务实体继承 `TenantAwareEntity`，隔离在应用层实现
   （`common/interceptors/data-isolation.interceptor.ts`）；数据库 RLS 尚未引入。
3. **迁移**：TypeORM 命令式迁移（`src/migrations/`）；声明式 diff 尚未引入，
   因此**迁移一旦提交不要改写**，新增变更用新迁移文件。
4. **测试**：Jest + supertest。新增协议/契约类逻辑必须带**负例**（拒绝集），只测正路径不算完成。
5. 新增描述性内容请写入上表既有文档，**不要另建新文件**。
