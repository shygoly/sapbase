# Change: 拆分 Nx 子项目并强化平台基座

## Why

`adopt-nx-workspace-and-boundaries` 已完成 27/27，把 Nx 作为**增量包装**接进来了
（7 个 project、四类 tag、`affected:*` 脚本），但它明确把三件事列为 Out of Scope，
到现在仍是空白：

1. **物理拆分未做**：`speckit` 仍是单 Next app（52 个页面里 26 个是治理台 `/admin/*`），
   `backend` 仍是单 Nest app（所有业务域共用一个 `AppModule`，44 个模块平铺）。
   `docs/ARCHITECTURE.md` §1 画的 `apps/web-portal` / `apps/web-console` / `apps/api`
   从未落地，`apps/` 目录不存在。
2. **边界检查实际失效**：`@nx/enforce-module-boundaries` 声明为 `warn`
   （`eslint.config.js:50`，文档写的是 `error`）；而 `npm run lint:boundaries`
   直接调 `eslint`，拿不到 Nx ProjectGraph，规则被**整条跳过**
   （实测输出：`No cached ProjectGraph is available. The rule will be skipped.`）。
   也就是说"边界可机器检查"目前不成立。
3. **基座与业务域混在同一层**：`backend/src` 下 `auth` / `permissions` / `audit-logs` /
   `common`（RLS、事务、过滤器）与 `semantic-runtime` / `releases` / 航运业务平铺，
   没有任何机制阻止基座反向依赖业务域。前端同理：`components/ui`（shadcn 原子）
   与 `components/shipping`（业务）只隔一个目录名。

第四条来自上一轮架构讨论的结论，需要在代码结构上固化：

> **业务域 = Nx 子项目（普通 TS/Nest，编译期打包）；域内热更 = Blueprint 数据 + 少量 Wasm 原子。**
> 业务域代码**不进**热更通道，也不进 Wasm。

## What Changes

- **ADDED** `apps/web-portal`、`apps/web-console`：把 `speckit/src/app/[locale]` 按
  `/admin/*`（治理台）与 `/` `/docs` `/dashboard/*`（业务端）物理拆为两个 Next app
- **ADDED** `apps/api`：`backend` 收敛为薄组合根（`main.ts` + `AppModule` 装配）
- **ADDED** `libs/platform-core`：`auth` / `auth-context` / `permissions` / `roles` /
  `audit-logs` / `organizations` / `settings` / `common`
  （filters / interceptors / guards / rls / transaction / protocol / dto）
- **ADDED** `libs/platform-release`：`blueprint` / `releases` / `release-automation` /
  `atomic-registry` / `atomic-runtime`
- **ADDED** `libs/agent-tools`：工具契约适配器（`agent-kernel` 保持只依赖端口，不 import 业务）
- **ADDED** `libs/ui-kit` / `ui-layout` / `ui-runtime` / `ui-theme` / `api-client`：
  从 `speckit/src/components` 与 `speckit/src/lib` 抽出的前端共享层
- **ADDED** `libs/domain-shipping` + `libs/ui-shipping`：第一个业务域样板
  （现有航运 10 个页面 + 20 个组件 + 后端迁移），作为"新增一个域"的可复制模板
- **ADDED** tag `layer:platform`，并新增规则「`layer:platform` MUST NOT 依赖
  `layer:domain` / `layer:ui`」
- **MODIFIED** tag 模型：`layer` 只描述库，组合根（`type:app`）不声明 `layer`。
  修正前 `backend` 同时带 `type:app` + `layer:app`，被更严的 `layer:app` 白名单锁死，
  无法装配 `agent-kernel` / `release-kernel`（P0 实测暴露 6 条）
- **MODIFIED** `@nx/enforce-module-boundaries` 由 `warn` 升为 `error`
- **ADDED** `scripts/meta/check-boundaries.mjs`：读 Nx project graph 断言依赖方向，
  CI 里 fail-closed，弥补 ESLint 规则在拿不到 graph 时静默跳过的问题
- **BREAKING**：`speckit/` 与 `backend/` 目录消失；`@/*` 别名按 app 重新配置；
  根 `package.json` 的 `dev` / `build` 工作区名变化

## Impact

- Affected specs: `app-workspace-topology`（新增能力）
- Affected code:
  - `apps/web-portal/**`、`apps/web-console/**`、`apps/api/**`
  - `libs/platform-core/**`、`libs/platform-release/**`、`libs/agent-tools/**`
  - `libs/ui-kit/**`、`libs/ui-layout/**`、`libs/ui-runtime/**`、`libs/ui-theme/**`、`libs/api-client/**`
  - `libs/domain-shipping/**`、`libs/ui-shipping/**`
  - `eslint.config.js`、`nx.json`、`tsconfig.base.json`、`package.json`、`package-lock.json`
  - `docs/ARCHITECTURE.md`、`docs/META_LANGUAGE.md` §5.2 文档真源表、根 `AGENTS.md`
- 与在飞变更的关系：`refactor-ai-native-business-app-platform`（14/61）会改动前端 shell
  与后端 tenant 边界。本变更按阶段推进，**每阶段合并前必须 rebase 该分支并保持其用例绿**，
  不与其抢占同一批文件。
- 不做的事：不改 ORM、不升级 Nest/Next/React、不拆进程（v1 仍是单 Nest 进程）、
  不把 Wasm 从"原子"扩展到"整域"。
