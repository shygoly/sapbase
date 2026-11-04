## 1. P0 — 让边界检查真的会失败（前置，不改业务代码）

- [x] 1.1 修 `npm run lint:boundaries`：改为先 `nx graph --file=.nx/boundary-graph.json` 预热再跑 ESLint，消除 `No cached ProjectGraph is available` 导致规则被整条跳过
- [x] 1.2 新增 `scripts/meta/check-boundaries.mjs` + `scripts/meta/lib/boundaries.mjs`：读 graph JSON，断言 B0–B5（B0 tag 完备性 / B1-B2 基座不依赖域与 UI / B3 域间不互依赖 / B4 浏览器不依赖 Node / B5 agent 内核不直达业务）
- [x] 1.3 该脚本接入 `scripts/meta/check-all.mjs`，并在违规时 `exit 1`
- [x] 1.4 脚本带单测：`scripts/meta/lib/boundaries.test.mjs`，15 个用例覆盖每条规则的正例与反例（`npm run test:meta`，`node --test`）
- [x] 1.5 首次运行基线记录到 `BOUNDARY-BASELINE.md`：**0 violation**（并记录 3 个发现与 4 个已知盲区）
- [x] 1.6 验收：`--graph` 喂构造图（platform → domain）脚本 exit 1；临时探针 import 让 `lint:boundaries` 报出 `enforce-module-boundaries`（已实测并清理）
- [x] 1.7 修复激活规则后暴露的 tag 矛盾：`layer` 只描述库，组合根（`type:app`）不声明 `layer`；已从 `backend`、`speckit` 移除，并同步 `B0` 规则与单测

## 2. P1 — 抽前端共享 lib（不动路由，保留 re-export）

- [x] 2.1 建 `libs/ui-kit`：搬 `speckit/src/components/ui/**`、`icons.tsx`、`modal/**`；导出 `@sap/ui-kit`
- [x] 2.2 建 `libs/ui-theme`：搬 `speckit/src/components/themes/**` 与主题 token
- [x] 2.3 建 `libs/api-client`：搬 `speckit/src/lib/api/**`、`lib/websocket/**`、`lib/utils*`；不引入 React 组件
- [x] 2.4 建 `libs/ui-runtime`：搬 `schema-form.tsx`、`schema-list.tsx`、`components/runtime/**`、`core/schema/**`
- [x] 2.5 建 `libs/ui-layout`：搬 `components/layout/**`、`nav-*.tsx`、`breadcrumbs.tsx`、`org-switcher.tsx`、`app-switcher.tsx`（冲突热点，放最后）
- [x] 2.6 每个 lib 配 `project.json` + tags（`type:lib` / `scope:shared` / `layer:ui` / `runtime:browser`），并加进根 `tsconfig.base.json` 的 `paths`（`@sap/*`）
- [x] 2.7 旧路径保留 re-export 壳（如 `speckit/src/components/ui/index.ts` 转发），保证 `speckit` 不改调用点也能编译
- [x] 2.8 验收：`npm run build --workspace speckit` 通过；`nx graph` 出现 5 个新节点；`check-boundaries` 无新增违规

## 3. P2 — 拆 `web-portal` 与 `web-console`

- [x] 3.1 建 `apps/web-portal`、`apps/web-console` 骨架：`next.config.ts`、`tsconfig.json`（`@/*` 指向各自 `src`）、`src/app/layout.tsx`、`src/middleware.ts`
- [x] 3.2 `git mv` 迁移治理台路由：`speckit/src/app/[locale]/admin/**`（26 页）→ `apps/web-console/src/app/[locale]/admin/**`
- [x] 3.3 `git mv` 迁移业务端路由：`speckit/src/app/[locale]/{page.tsx,docs,dashboard}/**`（26 页）→ `apps/web-portal/src/app/[locale]/**`
- [x] 3.4 把共用部分（`root-providers.tsx`、i18n、主题注入、鉴权壳）迁到 `libs/ui-layout` 或 `libs/ui-runtime`，两个 app 各自保留薄 `layout.tsx`
- [x] 3.5 根 `package.json`：`dev` / `dev:frontend` / `dev:backend` 指向新 app；保留 `dev:speckit` 之类旧别名一个版本周期
- [x] 3.6 `project.json` tags：`web-portal` = `type:app,scope:portal,layer:ui,runtime:browser`；`web-console` = `type:app,scope:console,layer:ui,runtime:browser`
- [x] 3.7 删除空壳 `speckit/`（最后一个 commit 单独做，便于 revert）
- [x] 3.8 验收：两个 app `build` 各自通过（portal 25 页 / console 27 页），`check-all` 0 error
- [x] 3.9 追加：`libs/app-shared`（310 文件）承接两 app 共享的应用层；`app/500` 因与 Next 15 静态错误页导出冲突而移除
- [x] 3.10 追加：删除 `speckit/` 后其 `devDependencies` 需复制到两个 app，否则 `@tailwindcss/postcss` 不再被 hoist（已修）

## 4. P3 — 抽后端基座与 `apps/api`

- [x] 4.1 建 `libs/platform-core`：212 文件（common / auth / auth-context / organizations / permissions / roles / audit-logs / settings / users / departments / cache），闭包自闭合；16 个 `*.spec.ts` 留在 backend
- [x] 4.1b 消费方式：`@sap/platform-core` 编译到 `dist`，用 `exports` + `typesVersions` 支撑子路径；backend 旧路径全部留兼容壳
- [ ] 4.2 ⏳ 未做：`platform-core` 提供显式 entity 汇总点（`platform-core.entities.ts`）与启动自检：注册表为空或 entity 未被 `forFeature` 覆盖时启动失败（防止重演 `BrandConfig` 漏注册）
- [ ] 4.3 ⏳ 未做（P3b）：建 `libs/platform-release`：迁 `blueprint`、`releases`、`release-automation`、`atomic-registry`、`atomic-runtime`
- [ ] 4.4 ⏳ 未做（P3b）：建 `libs/agent-tools`：迁 `agent-tools`；确认 `agent-kernel` 未新增对 platform/domain 的 import
- [ ] 4.5 ⏳ 未做（P3b）：`backend/src/app.module.ts` 收敛为组合根，只做 import + TypeORM/Config/Throttler 装配，不含任何业务 service
- [ ] 4.6 ⏳ 未做（P3b）：`git mv backend` → `apps/api`；`package.json` name 改 `@sap/api`，根 scripts 同步
- [ ] 4.7 `tsconfig.base.json` 增加 `@sap/platform-core` / `@sap/platform-release` / `@sap/agent-tools`；`shared-schemas` 移入 `libs/` 并改名为 `@sap/shared-schemas`（旧名保留 re-export 一周期）
- [ ] 4.8 验收：`npx jest`（backend 全量）绿；`npm run typecheck --workspace api` 绿；`cargo test -p wasm-host` 不受影响；`ATOMIC_ENGINE` 两条路径（wasmtime / v8）各跑一个 atomic 用例

## 5. P4 — 业务域样板（航运）

- [ ] 5.1 ⏳ 未做（P4）：建 `libs/domain-shipping`：迁后端 shipping 实体/用例/控制器与 `migrations/*Shipping*`、`scripts/rebuild-voyage-emissions.ts`；tags `type:lib,scope:shipping,layer:domain,runtime:node`
- [ ] 5.2 ⏳ 未做（P4）：建 `libs/ui-shipping`：迁 `speckit/src/components/shipping/**`（20 文件）与 `app/[locale]/dashboard/shipping/**`（10 页）；tags `type:lib,scope:shipping,layer:ui,runtime:browser`
- [ ] 5.3 `domain-shipping` 只依赖 `platform-core` + `shared-*`；不得 import 任何 `ui-*`
- [ ] 5.4 新增 `docs/architecture/add-a-domain.md`：以航运为范例，写清「建两个 project → 配 tags → 注册 module → 加路由 → 跑边界检查」五步
- [ ] 5.5 验收：`nx graph` 中 `domain-shipping` 与 `ui-shipping` 的入边/出边符合 D2–D4 的允许边表；航运 10 个页面全部可访问

## 6. P5 — 收紧边界并同步真源文档

- [x] 6.1 `eslint.config.js`：`@nx/enforce-module-boundaries` 由 `warn` 改 `error`；新增 `layer:platform` 规则
- [x] 6.2 清空 `BOUNDARY-BASELINE.md` 里的遗留违规（或逐条转为显式 `bannedExternalImports` 例外并写明理由）
- [x] 6.3 更新 `docs/ARCHITECTURE.md`：目录树、运行拓扑、tags 表与实际一致；把「目标态」改成「现状」
- [ ] 6.4 ⏳ 待 P4 完成后补：`docs/META_LANGUAGE.md` §5.2 新增 `docs/architecture/add-a-domain.md`
- [x] 6.5 更新根 `AGENTS.md` 与 `speckit/AGENTS.md` / `backend/AGENTS.md` 的入口路径（目录改名后失效）
- [x] 6.6 `npm run check:all` 全绿；`npx nx graph` 无孤立节点
- [x] 6.7 验收：故意新增一条 `platform → domain` import，`npm run lint` **必须**失败（不是警告）
