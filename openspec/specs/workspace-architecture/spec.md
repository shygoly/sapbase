# workspace-architecture Specification

## Purpose
TBD - created by archiving change adopt-nx-workspace-and-boundaries. Update Purpose after archive.
## Requirements
### Requirement: Nx Project Graph

仓库 SHALL 以 Nx 包装现有 npm workspaces，使每个可构建单元成为 project graph 中的节点。

#### Scenario: Existing projects are visible
- **WHEN** 运行 `nx graph`
- **THEN** `speckit`、`backend`、`shared-schemas`、`wasm-modules` MUST 出现在项目图中
- **AND** 各自 MUST 有可执行的 `build` target（或明确的“无 build”说明）

#### Scenario: Existing workflow is preserved
- **WHEN** 开发者运行 `npm run dev`
- **THEN** 前端与后端 MUST 仍按原有方式启动
- **AND** 现有 npm workspace 脚本 MUST 不被删除或改名

### Requirement: Project Tags and Dependency Constraints

每个 Nx 项目 SHALL 声明 `type` / `scope` / `layer` / `runtime` 四类 tag，并由 ESLint 检查依赖方向。

#### Scenario: Layer direction is enforced
- **WHEN** `libs/domain-*` 导入 Nest、TypeORM、Redis 或 `fetch`
- **THEN** `@nx/enforce-module-boundaries` MUST 报告违规
- **AND** 该违规先以 `warn` 级别出现，不阻塞合并

#### Scenario: Agent kernel cannot reach business services
- **WHEN** `agent-kernel` 直接导入 `app-*` 或 `infra-*`
- **THEN** 边界规则 MUST 报告违规
- **AND** 正确路径 MUST 是端口 + `agent-tools` 适配器

### Requirement: Incremental Workspace Migration

Nx 迁移 SHALL 分步进行，每一步保持可构建、可回退。

#### Scenario: Migration does not bundle framework upgrades
- **WHEN** 提交 Nx 迁移变更
- **THEN** 该变更 MUST NOT 同时升级 Nest、Next 或 TypeORM 主版本
- **AND** 框架升级 MUST 另立变更并单独回归

#### Scenario: Physical split is deferred
- **WHEN** 首次接入 Nx
- **THEN** 现有目录 MUST 保留原名
- **AND** `web-portal` / `web-console` / `api` / `agent-gateway` / `worker` 的物理拆分 MUST 留给后续变更

### Requirement: First Pure-Function Library

仓库 SHALL 至少抽出一个零 IO 的共享 lib，证明“先抽纯函数”的迁移路径可行。

#### Scenario: Shared core is extracted without breaking callers
- **WHEN** `money` 与 `canonicalizeJson` 被移动到 `libs/shared-core`
- **THEN** 旧导入路径 MUST 继续可用（通过 re-export）
- **AND** 后端全量单测 MUST 通过

#### Scenario: Shared core has no IO dependencies
- **WHEN** 检查 `libs/shared-core` 的依赖
- **THEN** 它 MUST NOT 导入 Nest、TypeORM、Redis、`fs` 或 `fetch`
- **AND** 它 MUST 能被浏览器与 Node 同时使用

