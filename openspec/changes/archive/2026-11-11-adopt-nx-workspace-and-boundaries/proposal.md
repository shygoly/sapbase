# Change: 采用 Nx 工作区与模块边界（P1）

> 执行顺序：**2 / 8**
> 依赖：变更 1（契约与 checker 已就位）
> 参考：`docs/reference/02-architecture.md`、`07-adoption-and-checks.md` §P1

## Why

当前仓库是 npm workspaces（`speckit` / `backend` / `shared-schemas` / `wasm-modules`），
依赖方向靠自觉：`backend` 可以随手 import 任何目录，前端也可能直接引后端类型，
Agent 内核未来若直接 import 业务服务，就能绕过工具白名单与确认令牌。

参考包要求把“逻辑边界”变成 **Nx project graph + ESLint `enforce-module-boundaries`**，
让越界依赖在 CI 可见。本变更只做**增量包装**：保留 npm workspaces 与现有脚本，
不重写业务、不升级 Nest/Next/ORM。

## What Changes

- **ADDED** `nx.json`、`tsconfig.base.json`、Nx devDependencies（npm，唯一锁文件不变）
- **ADDED** 四个现有 workspace 的 `project.json` 与 tags：`speckit`、`backend`、`shared-schemas`、`wasm-modules`
- **ADDED** 根 ESLint flat config 接入 `@nx/enforce-module-boundaries`，初始 `warn`
- **ADDED** `libs/shared-core`：抽出纯函数 `money` 与 `canonicalizeJson`，旧路径保留 re-export 兼容
- **ADDED** npm scripts：`nx:graph`、`affected:build`、`affected:lint`、`affected:test`
- **MODIFIED** 根 `package.json`：增加 Nx 相关 devDependencies 与脚本，不改现有 `dev` / `build` / `lint`

**BREAKING**：无。Nx 是增量包装；旧 npm scripts 与工作区结构保留。

## Impact

- Affected specs: `workspace-architecture`（新增）
- Affected code:
  - `nx.json`、`tsconfig.base.json`、`eslint.config.js`
  - `speckit/project.json`、`backend/project.json`、`shared-schemas/project.json`、`wasm-modules/project.json`
  - `libs/shared-core/**`
  - `backend/src/blueprint/money.ts`、`backend/src/blueprint/canonical-json.ts`（改为 re-export）
  - `package.json`、`package-lock.json`

## Out of Scope

- 不把 `speckit` 拆成 `web-portal` / `web-console`（后续独立变更）
- 不把 `backend` 拆成 `api` / `agent-gateway` / `worker` 进程
- 不更换 TypeORM、不升级 Nest/Next
- 不把边界规则从 `warn` 调成 `error`（本变更先收集违规清单）
