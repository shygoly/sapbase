## Context

当前工作区有 7 个 Nx 项目：4 个 workspace（`speckit`、`backend`、`shared-schemas`、
`wasm-modules`）+ 3 个 libs（`shared-core`、`agent-kernel`、`release-kernel`）。
依赖边只有两条：`backend → shared-schemas`、`backend → wasm-modules`。
也就是说 project graph 几乎是个空图——Nx 有价值的部分（affected、边界、缓存）
没有任何粒度可用。

实测数据（本变更立项时）：

| 项 | 数值 |
|---|---|
| `speckit/src/app/[locale]` 页面 | 52（`/admin/*` 26 个，`/dashboard/*` 23 个，`/`、`/docs` 2 个） |
| `speckit` 非 spec `.tsx` | 285 |
| `backend/src` 模块数 | 44（最大：`organization-context` 59 文件、`common` 42、`ai-module-context` 42） |
| 跨包 import | `backend → speckit` 0，`speckit → backend` 0（干净起点） |
| 边界规则状态 | `warn`，且 `npm run lint:boundaries` 走 `eslint` 直调 → 规则被跳过 |

## Goals / Non-Goals

**Goals**

1. 让 `nx graph` 反映真实业务结构：域、基座、UI 层各为节点。
2. 让「基座不能反向依赖业务域」成为**会失败**的检查，而不是文档约定。
3. 两个 Next app（业务端 / 治理台）可独立构建、独立部署、独立发布节奏。
4. 抽出可复制的「新增一个业务域」模板（`domain-*` + `ui-*`）。
5. 每一步单独可合并、可回退，CI 始终绿。

**Non-Goals**

- 不拆 Nest 进程（`api` / `agent-gateway` / `worker` 仍单进程，只做代码边界）。
- 不把业务域编译进 Wasm；不把 Blueprint 热更改成代码热更。
- 不升级 Nest / Next / React / TypeORM 主版本。
- 不改 Blueprint 协议与发布流水线语义。
- 不追求一次到位：允许阶段之间存在"临时 re-export 壳"。

## Decisions

### D1. 迁移顺序：先立检查，再抽 lib，最后拆 app

**决定**：`P0 边界可验证 → P1 抽前端 lib → P2 拆两个 Next app → P3 抽后端基座 →
P4 业务域样板 → P5 收紧为 error`。

**理由**：拆 app 是不可逆的物理移动（52 个页面、285 个 tsx）。如果先搬再抽，
同一批文件会被移动两次，且中间态无法验证。先抽 lib（旧路径留 re-export）是
strangler 模式，每步都能跑 `npm run build`。

**Alternatives considered**：
- *一次性大爆炸拆分*：分支存活期长、与 `refactor-ai-native-business-app-platform`
  冲突面大、review 不可读。否决。
- *先拆 app 再抽 lib*：Next 的 `app/` 目录必须整块属于一个 app，先拆会立刻产生
  两份重复的 `components/ui`。否决。

### D2. 前端共享层按「无业务 / 有布局 / 有 Schema」三分

**决定**：

| lib | 内容 | 禁止 |
|---|---|---|
| `ui-kit` | `components/ui/**`（shadcn 原子）、`icons`、`modal` | 任何业务概念、任何 `fetch` |
| `ui-theme` | `components/themes/**`、主题 token | 业务概念 |
| `ui-layout` | `components/layout/**`、`nav-*`、`breadcrumbs`、`org-switcher`、`app-switcher` | 直接调 API（走 props 或 `api-client`） |
| `ui-runtime` | `schema-form`、`schema-list`、`components/runtime/**`、`core/schema/**` | 硬编码实体名 |
| `api-client` | `lib/api/**`、`lib/websocket/**`、`lib/utils` | React 组件 |

**理由**：业务端与治理台都要用前四层；把 `ui-runtime` 单列是因为它依赖
`shared-schemas`，是"数据驱动渲染"的核心，未来 chat-first 会大量复用。

### D3. 基座用 `layer:platform`，而不是塞进 `layer:shared`

**决定**：新增 layer 取值 `platform`。`platform-core` / `platform-release` 用
`layer:platform`；`shared-core` / `shared-schemas` 保持 `layer:shared`。

**理由**：`layer:shared` 的语义是"零 IO、前后端同构"（见 `shared-core` 现有 spec）。
`platform-core` 依赖 Nest/TypeORM/Redis，把它标成 `shared` 会让规则失去意义。
新规则：`layer:platform` MUST NOT 依赖 `layer:domain` / `layer:ui`。

**同时修正（P0 实测发现）**：`layer` 只描述**库**；组合根（`type:app`）**不声明 `layer`**。

原因是 Nx 的 `depConstraints` 是 AND 语义——两条规则同时命中时取更严的那条。
`backend` 原本同时带 `type:app` 和 `layer:app`，于是被 `layer:app` 的窄白名单
（不含 `layer:agent` / `layer:release`）锁死，6 条组合根装配代码全部报违规。
这不是代码问题，是 tag 模型缺陷。修正后 `apps/*` 只带 `type/scope/runtime`。

### D4. 域间依赖用脚本检查，不用 ESLint tag 规则

**决定**：`scripts/meta/check-boundaries.mjs` 读 `nx graph --file` 的 JSON，
断言：
1. 不存在 `layer:platform → layer:domain` 的边；
2. 不存在 `layer:domain → layer:domain` 且 `scope` 不同的边；
3. 不存在 `runtime:browser → runtime:node` 的边。

**理由**：`@nx/enforce-module-boundaries` 的 `onlyDependOnLibsWithTags` 无法表达
"同层但不同 scope 禁止"。用 N 个域写 N×(N-1) 条规则不可维护。脚本读 graph 是
确定性的、可单测的，且不受 ESLint 缓存影响。

**代价**：脚本在 CI 跑，不在编辑器里实时提示。用 ESLint 规则覆盖能表达的部分
（平台→域、browser→node）作为第一道，脚本兜底第二道。

### D5. `apps/api` 是薄组合根，模块仍是 lib

**决定**：`apps/api/src/main.ts` + `app.module.ts` 只做装配（import 各 lib 的 Module），
不含业务实现。TypeORM entities 由各 lib 自己导出，组合根汇总注册。

**理由**：Nest 的 DI 需要单一 module graph，但代码归属可以分散在 lib。
这样 `domain-shipping` 可以被 `api` 装配，也可以在测试里单独装配，
不需要把整个 `AppModule` 拖进测试。

**风险**：TypeORM 的 entity 自动发现（`autoLoadEntities`）与 lib 的导出顺序
耦合；需要在 `platform-core` 提供 `TypeOrmFeatureRegistry` 之类的显式汇总点。

### D6. 航运作为第一个域样板，而不是新造一个域

**决定**：把现有 `/dashboard/shipping/*`（10 页）与 `components/shipping`（20 文件）
+ 后端 shipping 迁移脚本抽成 `domain-shipping` / `ui-shipping`。

**理由**：它是仓库里唯一"完整业务域"（有页面、组件、迁移、脚本、报表）。
新造一个域会得到没有真实复杂度的模板。

## Target Graph

```
apps/
  web-portal      type:app  scope:portal   runtime:browser          （组合根，无 layer）
  web-console     type:app  scope:console  runtime:browser          （组合根，无 layer）
  api             type:app  scope:api      runtime:node             （组合根，无 layer）
libs/
  shared-core     type:lib  scope:shared   layer:shared     runtime:isomorphic
  shared-schemas  type:lib  scope:shared   layer:shared     runtime:isomorphic
  api-client      type:lib  scope:shared   layer:ui         runtime:browser
  ui-kit          type:lib  scope:shared   layer:ui         runtime:browser
  ui-theme        type:lib  scope:shared   layer:ui         runtime:browser
  ui-layout       type:lib  scope:shared   layer:ui         runtime:browser
  ui-runtime      type:lib  scope:shared   layer:ui         runtime:browser
  platform-core   type:lib  scope:platform layer:platform   runtime:node
  platform-release type:lib scope:platform layer:release    runtime:node
  agent-kernel    type:lib  scope:agent-kernel layer:agent  runtime:node
  agent-tools     type:lib  scope:agent    layer:agent      runtime:node
  release-kernel  type:lib  scope:shared   layer:release    runtime:node
  domain-shipping type:lib  scope:shipping layer:domain     runtime:node
  ui-shipping     type:lib  scope:shipping layer:ui         runtime:browser
```

允许的边（单向）：

```
apps/*        → 任意 lib
ui-*          → ui-kit, ui-theme, api-client, shared-*
ui-runtime    → shared-schemas
domain-*      → platform-*, agent-tools, shared-*
platform-*    → shared-*, release-kernel
agent-tools   → platform-core, domain-*（仅公开入口）
agent-kernel  → shared-*（不得 import platform / domain）
```

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| 与在飞 `refactor-ai-native-business-app-platform`（14/61）冲突 | 合并冲突、用例红 | 每阶段独立 PR；动 `frontend shell`/`tenant` 文件前先 rebase；阶段顺序把 `ui-layout`（冲突热点）放在 P1 末尾 |
| Next 拆分后 `@/*` 别名二义 | 编译失败、隐性跨 app import | 每个 app 自己的 `tsconfig.json` 只映射本地 `src`；跨 app 共享必须走 `@sap/*` |
| TypeORM entity 分散后注册漏项 | 启动即 500（历史上 `BrandConfig` 漏注册过一次） | 每个 lib 导出 `*.entities.ts` 汇总；`platform-core` 提供显式注册点 + 启动自检 |
| 边界脚本与 ESLint 规则口径不一致 | 一处绿一处红 | 脚本只断言 ESLint 表达不了的 3 类；能表达的交给 ESLint |
| 一次性移动 285 个 tsx 导致 review 不可读 | 缺陷漏检 | 纯移动的 commit 与逻辑修改的 commit 分开；移动 commit 用 `git mv` 保历史 |
| `speckit` 名字消失破坏外部脚本 | CI/部署脚本失效 | 先在根 `package.json` 保留 `dev:frontend` 等别名指向新 app，下一变更再删 |

## Migration Plan

每个阶段结束都必须满足：

```
npm run build --workspaces   # 或 nx run-many -t build
npm run typecheck            # speckit + backend
npm run lint                 # 至少不新增告警
node scripts/meta/check-all.mjs
npx nx graph                 # 图里能看到新节点
```

回退：每阶段一个 commit（或一个 PR），revert 即回到上一阶段；不跨阶段共享文件移动。

## Open Questions

1. `web-portal` / `web-console` 是否要共用一份 `middleware.ts` 与 i18n？
   倾向：抽 `libs/ui-layout/i18n`，两个 app 各自保留 `middleware.ts` 薄壳。
2. `shared-schemas` 是否移入 `libs/`？倾向：移入，与 `@sap/*` 命名统一；
   但这会让 `backend` 的 `tsconfig` paths 全改，放在 P3 一起做。
3. `wasm-modules` 是否保持 workspace（而非 `libs/`）？
   倾向：保持，它是构建产物包不是源码 lib。
4. `domain-shipping` 的前端部分拆 `ui-shipping` 是否过度？
   备选：只做一个 `scope:shipping` 项目同时含前后端（放弃 runtime tag 区分）。
   倾向：仍拆两个，因为 `runtime:browser → runtime:node` 是必须守的边。
