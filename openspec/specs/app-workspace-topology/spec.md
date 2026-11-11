# app-workspace-topology Specification

## Purpose
TBD - created by archiving change refactor-app-workspace-split-and-platform-base. Update Purpose after archive.
## Requirements
### Requirement: Platform Base Boundary

仓库 SHALL 有一个不包含业务语义的平台基座层（`layer:platform`），承载认证、权限、租户上下文、审计、数据库访问与横切基础设施。基座 MUST NOT 依赖任何业务域或前端渲染层。

#### Scenario: 基座反向依赖业务域被拒绝
- **WHEN** `libs/platform-core` 或 `libs/platform-release` 直接 import `libs/domain-*` 或 `libs/ui-*`
- **THEN** 边界检查 MUST 失败
- **AND** 错误信息 MUST 指出源项目、目标项目与违规的 tag 关系

#### Scenario: 基座可以独立装配
- **WHEN** 在测试中只装配 `platform-core` 与 `domain-shipping`
- **THEN** 装配 MUST 成功，且 MUST NOT 需要引入其他业务域
- **AND** `platform-core` MUST 提供显式的 entity 注册汇总点，注册缺失时启动 MUST 失败

### Requirement: Business Domain as Nx Project

每个业务域 SHALL 是一个独立的 Nx 项目，代码为普通 TypeScript / NestJS，在本体构建期打包。业务域代码 MUST NOT 进入 Wasm 热更通道；域内热更 MUST 仅通过 Blueprint 数据与少量 Wasm 原子完成。

#### Scenario: 域代码不参与热更
- **WHEN** 发布一个域内变更 Release
- **THEN** 该 Release MUST 只包含 Blueprint 数据制品与已固定的原子模块哈希
- **AND** MUST NOT 包含该业务域的 TypeScript 源码或可执行代码

#### Scenario: 域之间不得直接依赖
- **WHEN** `libs/domain-shipping` 直接 import 另一个 `scope` 不同的 `layer:domain` 项目
- **THEN** 边界检查 MUST 失败
- **AND** 正确路径 MUST 是公开入口或事件

#### Scenario: 新增一个域只需五步
- **WHEN** 开发者按 `docs/architecture/add-a-domain.md` 新增一个业务域
- **THEN** 新增 SHALL 只涉及：建后端 project、建前端 project、配 tags、注册 module、加路由
- **AND** MUST NOT 需要修改其他业务域的代码

### Requirement: Frontend Application Split

前端 SHALL 拆为两个独立的 Next.js 应用：`web-portal`（业务人员入口）与 `web-console`（治理与发布台）。两者 MUST 可独立构建与部署，共享代码 MUST 只经由 `libs/*`。

#### Scenario: 治理台路由归属
- **WHEN** 检查 `apps/web-console` 的路由
- **THEN** 它 MUST 包含全部 `/admin/*` 页面
- **AND** `apps/web-portal` MUST NOT 包含 `/admin/*` 路由

#### Scenario: 跨应用代码共享
- **WHEN** `apps/web-console` 使用一个 UI 组件
- **THEN** 该组件 MUST 来自 `libs/ui-*`
- **AND** MUST NOT 通过相对路径 import `apps/web-portal` 内部文件

#### Scenario: 别名不越界
- **WHEN** 某个 app 的 `@/*` 别名被解析
- **THEN** 它 MUST 只指向该 app 自己的 `src`
- **AND** 跨 app 复用 MUST 通过 `@sap/*` 别名

### Requirement: Shared Frontend Library Layering

前端共享代码 SHALL 按"无业务 / 布局 / 数据驱动渲染"分层，且依赖方向单向：`ui-layout` → `ui-kit`，`ui-runtime` → `shared-schemas`，任何 `ui-*` MUST NOT 依赖业务域。

#### Scenario: ui-kit 不含业务概念
- **WHEN** 检查 `libs/ui-kit` 的导入
- **THEN** 它 MUST NOT import 任何 `domain-*`、`ui-*`（除 `ui-theme`）或 API 客户端
- **AND** MUST NOT 直接发起网络请求

#### Scenario: 业务组件不得下沉到 ui-kit
- **WHEN** 一个组件引用具体实体名（如 `PurchaseOrder`、`Voyage`）
- **THEN** 它 MUST 位于对应的 `ui-<domain>` 或 `apps/*`，MUST NOT 位于 `ui-kit`

### Requirement: Effective Boundary Enforcement

边界规则 SHALL 在 CI 中实际生效并阻塞合并。规则 MUST NOT 因缺少 Nx ProjectGraph 而被静默跳过，且 MUST NOT 停留在警告级别。

#### Scenario: 无图时不静默通过
- **WHEN** 边界检查在没有 Nx ProjectGraph 的上下文运行
- **THEN** 检查 MUST 显式报错或以脚本方式补充判定
- **AND** MUST NOT 输出"规则已跳过"后视为通过

#### Scenario: 违规阻塞合并
- **WHEN** 引入一条被禁止的跨层 import
- **THEN** `npm run lint` MUST 以非零码退出
- **AND** CI MUST 阻塞该合并

#### Scenario: 检查口径一致
- **WHEN** ESLint 规则与 `scripts/meta/check-boundaries.mjs` 同时运行
- **THEN** 两者 MUST 对同一违规给出一致结论
- **AND** 脚本 MUST 只断言 ESLint tag 规则无法表达的依赖方向

### Requirement: Phased Migration

工作区拆分 SHALL 分阶段进行，每个阶段 MUST 独立可构建、可回退，且 MUST NOT 同时升级框架主版本。

#### Scenario: 每阶段保持绿灯
- **WHEN** 任一阶段的变更合并
- **THEN** `npm run build`、`npm run typecheck`、`npm run lint`、`node scripts/meta/check-all.mjs` MUST 全部通过
- **AND** `npx nx graph` MUST 能列出该阶段新增的项目

#### Scenario: 阶段可独立回退
- **WHEN** 某一阶段出现不可接受的回归
- **THEN** 该阶段 MUST 能被单独 revert 而不影响前后阶段
- **AND** 跨阶段的文件移动 MUST NOT 混在同一个提交里

#### Scenario: 不与框架升级捆绑
- **WHEN** 提交任一分阶段变更
- **THEN** 该变更 MUST NOT 同时升级 Nest、Next、React 或 TypeORM 主版本

