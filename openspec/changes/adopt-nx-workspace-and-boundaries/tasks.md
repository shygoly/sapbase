## 1. 安装与初始化 Nx

- [x] 1.1 根 `package.json` 增加 `nx`、`@nx/js`、`@nx/eslint`、`@nx/eslint-plugin`、`@nx/workspace` 等必要 devDependencies（版本统一，npm 安装）
- [x] 1.2 运行 `npm exec -- nx@latest init`（若 PowerShell 阻止 `npx.ps1`，不要用 `npx`；保留现有 npm workspaces 与脚本）
- [x] 1.3 新建 / 校对 `nx.json`：不启用 Nx Cloud；`targetDefaults` 覆盖 `build`、`lint`、`test`、`typecheck`
- [x] 1.4 新建 `tsconfig.base.json`：先只放 `@sap/shared-core` 等新 lib 的路径别名；现有 `@speckit/*` 保持不变
- [x] 1.5 跑 `npm exec -- nx graph`，确认能看到项目图

## 2. 给现有 Workspace 加 Project 元数据

- [x] 2.1 `speckit/project.json`：`name: "speckit"`，tags `["type:app","scope:portal","layer:ui","runtime:browser"]`，保留其 `build` / `dev` / `lint` target
- [x] 2.2 `backend/project.json`：`name: "backend"`，tags `["type:app","scope:api","layer:app","runtime:node"]`，保留其 `build` / `test` / `lint` target
- [x] 2.3 `shared-schemas/project.json`：`name: "shared-schemas"`，tags `["type:lib","scope:shared","layer:shared","runtime:isomorphic"]`
- [x] 2.4 `wasm-modules/project.json`：`name: "wasm-modules"`，tags `["type:lib","scope:shared","layer:shared","runtime:node"]`
- [ ] 2.5 ?? `npm run dev`?`npm run build`?`npm run build --workspace backend` ????`dev` ?????? build ????
- [x] 2.6 跑 `npm exec -- nx run-many -t build`，记录失败的 target 并修正 project 配置（不是改业务代码）

## 3. 开启模块边界检查（warn）

- [x] 3.1 根 ESLint flat config 引入 `@nx/eslint-plugin` 与 `@nx/enforce-module-boundaries`
- [x] 3.2 写入参考包 §2 的 `depConstraints`：`domain` 只依赖 domain/shared；`app` 可依赖 domain/app/infra/shared；`infra` 只依赖 infra/shared；`agent` 只依赖 agent/app/domain/shared；`agent-kernel` 不得依赖 app/infra；`browser` 不得依赖 node
- [x] 3.3 规则级别先设 `warn`，跑一次全量 lint，把违规清单记录到 `openspec/changes/adopt-nx-workspace-and-boundaries/VIOLATIONS.md`（不修）
- [x] 3.4 确认新增 `speckit → backend` 这类越界依赖会被 warn 报出
- [x] 3.5 在 `package.json` 加 `affected:build` / `affected:lint` / `affected:test`（基于 `nx affected`）

## 4. 抽出第一个纯函数 Lib

- [x] 4.1 新建 `libs/shared-core`：`package.json`（name `@sap/shared-core`）、`project.json`（tags `["type:lib","scope:shared","layer:shared","runtime:isomorphic"]`）、`tsconfig.json`、`src/index.ts`
- [x] 4.2 把 `backend/src/blueprint/money.ts` 内容移到 `libs/shared-core/src/lib/money.ts`，导出路径从 `src/index.ts` 统一出口
- [x] 4.3 把 `backend/src/blueprint/canonical-json.ts` 内容移到 `libs/shared-core/src/lib/canonical-json.ts`
- [x] 4.4 旧文件改为 `export * from '@sap/shared-core'`，避免一次性改所有 import
- [x] 4.5 为 `money` 与 `canonicalizeJson` 保留/迁移现有单测，确保语义不变
- [x] 4.6 跑 `npm run test --workspace backend`，确认后端测试通过

## 5. 验收

- [x] 5.1 `npm exec -- nx graph` 能列出 4 个现有项目 + `shared-core`
- [ ] 5.2 `npm run dev` ??????????????????
- [ ] 5.3 `npm run build --workspace backend` ???`speckit` build ??????? `./shipping/constants.api` ??????????
- [x] 5.4 边界规则输出违规清单，且没有把 `warn` 调成 `error`
- [x] 5.5 `package-lock.json` 是唯一锁文件，未新增 pnpm/yarn/bun 锁文件


## ??????

- ????Nx ????tags??? warn?`libs/shared-core` ????????
- ????`npm run dev` ?????`speckit` build ??????? `./shipping/constants.api` ???????????
