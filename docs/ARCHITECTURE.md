# 工程架构（真源）

> 本文由参考包 `docs/ARCHITECTURE.md` 并入，是 sapbase Nx + Next.js + NestJS + PostgreSQL + Redis 工程结构的真源。
> 冲突时以 `docs/META_LANGUAGE.md` 的不变量为准。

> 目标：把 sapbase 从“能跑的 npm workspaces 单体”整理成**边界可执行、可独立拆分、可被 Agent 安全调用**
> 的 Nx 工作区。本文只定结构与依赖方向，不重写业务。
> 迁移步骤与验收见 [`CONTRIBUTING.md`](../CONTRIBUTING.md)。

---

## 0. 目标与非目标

### 目标

1. **一个仓库、多个可部署单元**：业务端、管理端、API、Agent 网关、后台作业。
2. **依赖方向单向**：`app → domain → shared`；`infra` 只通过端口被依赖；Agent 只能经工具面进入业务。
3. **边界可机器检查**：Nx tags + ESLint `enforce-module-boundaries`，不是靠自觉。
4. **现有资产可渐进迁移**：不要求一次性重写 Next/Nest/TypeORM。
5. **发布与运行分离**：部署进程不等于对租户发布业务版本（见 `docs/protocols/release.md`）。

### 非目标

- 不在本次迁移中更换 ORM（TypeORM 保留；Prisma 是独立决策，见 §10）。
- 不引入 Kubernetes / Service Mesh；PM2 + Nginx + 单机 PG/Redis 仍是默认形态。
- 不把单体拆成微服务；先做**模块化单体**，按触发条件再拆进程。
- 不重写现有页面；先按路由分组，再抽 app。

---

## 1. 目标目录

**现状（2026-11，P3b/P4 落地后）**：下表即当前真实结构；架构迁移已完成，
新增业务域按 `docs/architecture/add-a-domain.md` 复制。

```text
sapbase/
├─ apps/
│  ├─ web-portal/            # Next.js 15：业务人员入口（/、/docs、/dashboard/**）
│  ├─ web-console/           # Next.js 15：治理台（/admin/**）
│  └─ api/                   # NestJS：REST/SSE、认证、租户、组合根 + 尚未迁出的应用模块
├─ libs/
│  ├─ platform-core/         # 基座：common / auth / auth-context / organizations /
│  │                         #       permissions / roles / audit-logs / settings / users
│  ├─ platform-release/      # 发布基座：blueprint / releases（领域实现）/ release-automation /
│  │                         #             atomic-registry / atomic-runtime
│  ├─ agent-tools/           # 工具面：契约加载 / 确认令牌 / 工具注册表 / MCP 桥
│  ├─ app-shared/            # 两个前端 app 共享的应用层（组件 / hooks / core / i18n）
│  ├─ ui-kit/                # shadcn 原子组件 + 数据表格子系统
│  ├─ ui-theme/              # 主题 token / Provider / 选择器
│  ├─ ui-layout/             # 侧栏 / 顶栏 / 导航 / 面包屑 / 组织与应用切换
│  ├─ ui-runtime/            # Schema 驱动渲染（Page/Form/Collection/Detail）
│  ├─ api-client/            # 前端 REST / WebSocket 客户端
│  ├─ shared-state/          # zustand 全局状态
│  ├─ shared-core/           # 零 IO 纯函数（money / canonicalizeJson）
│  ├─ shared-schemas/        # 前后端共享 Schema / 类型（@sap/shared-schemas）
│  ├─ agent-kernel/          # 会话 / Context Compiler（只依赖端口）
│  ├─ release-kernel/        # semver / digest / 发布状态机纯逻辑
│  ├─ domain-shipping/       # 航运域：迁移 / 导入 / 重算脚本（第一个 domain 样板）
│  └─ ui-shipping/           # 航运域前端：页面 / 组件 / 报表（第一个 ui 域样板）
├─ shared-schemas/           # 兼容包：@speckit/shared-schemas → @sap/shared-schemas（一周期）
├─ schemas/                  # JSON Schema 真源
├─ contracts/                # tools.json / 发布清单
├─ wasm-modules/             # Rust→Wasm 原子模块与准入闸
├─ crates/wasm-host/         # Wasmtime sidecar
├─ tools/postgres/init/      # 迁移/种子 SQL
├─ docs/
│  ├─ META_LANGUAGE.md
│  ├─ architecture/add-a-domain.md
│  └─ reference/             # 历史归档
├─ nx.json
├─ tsconfig.base.json
├─ eslint.config.js
└─ package.json              # 依赖 hoist 到根；唯一锁文件 = 根 package-lock.json（npm）
```

**包管理器**：只用 **npm**，唯一锁文件是根 `package-lock.json`（见 `docs/PACKAGE_MANAGER.md`）。
迁移到 Nx 也不引入 pnpm/yarn/bun。

**命名约定**：

- Nx 项目名与目录名一致：`web-portal`、`api`、`platform-core`。
- TS 路径别名：`@sap/shared-schemas`、`@sap/platform-core`、`@sap/ui-kit`。
  旧 `@speckit/*` 仅保留 `@speckit/shared-schemas` 一周期。
- 一个 `libs/domain-*` 只服务一个限界上下文；跨上下文协作走 `app-*` 或事件。

---

## 2. Nx tags 与依赖规则

每个 `project.json` 至少四个 tag：

```jsonc
{
  "tags": ["type:lib", "scope:order", "layer:domain", "runtime:node"]
}
```

| 维度 | 允许值 |
|---|---|
| `type` | `app` / `lib` |
| `scope` | `portal` / `console` / `api` / `agent` / `agent-kernel` / `shared` / `platform` / `shipping` … |
| `layer` | `domain` / `app` / `infra` / `shared` / `agent` / `release` / `ui` / `platform` |
| `runtime` | `node` / `browser` / `isomorphic` |

> **`layer` 只描述库**。组合根（`type:app`）只声明 `type` / `scope` / `runtime`。
> 原因：Nx 的 `depConstraints` 是 AND 语义，若 app 同时带 `layer:app`，
> 会被更严的 `layer:app` 白名单锁死，连 `agent-kernel` / `release-kernel` 都装配不了
> （P0 实测 6 条）。

ESLint 约束（与根 `eslint.config.js` 保持一致）：

```js
'@nx/enforce-module-boundaries': ['error', {
  depConstraints: [
    { sourceTag: 'layer:domain', onlyDependOnLibsWithTags: ['layer:domain', 'layer:platform', 'layer:shared'] },
    { sourceTag: 'layer:app', onlyDependOnLibsWithTags: ['layer:domain', 'layer:app', 'layer:infra', 'layer:shared', 'layer:platform'] },
    { sourceTag: 'layer:infra', onlyDependOnLibsWithTags: ['layer:infra', 'layer:shared', 'layer:platform'] },
    { sourceTag: 'layer:agent', onlyDependOnLibsWithTags: ['layer:agent', 'layer:app', 'layer:domain', 'layer:shared', 'layer:platform'] },
    { sourceTag: 'layer:ui', onlyDependOnLibsWithTags: ['layer:ui', 'layer:shared', 'layer:release'] },
    { sourceTag: 'layer:platform', notDependOnLibsWithTags: ['layer:domain', 'layer:ui', 'layer:agent'] },
    { sourceTag: 'scope:agent-kernel', notDependOnLibsWithTags: ['layer:app', 'layer:infra'] },
    { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['layer:domain', 'layer:app', 'layer:infra', 'layer:shared', 'layer:agent', 'layer:release', 'layer:ui', 'layer:platform'] },
    { sourceTag: 'runtime:browser', notDependOnLibsWithTags: ['runtime:node'] },
  ],
}]
```

**四条硬规则**：

1. `domain-*` 的**用例层**不 import Nest、TypeORM、Prisma、Redis、`fetch`、`fs`；
   它只放纯函数与类型。迁移与运维脚本允许放在 `src/migrations` / `src/scripts`
   （样板：`domain-shipping`），但不得被用例层反向 import。
2. `app-*` 不 import 另一个 `app-*` 的内部实现；跨上下文走公开入口或事件。
3. `agent-kernel` 不 import `platform-*` / `domain-*`；它只依赖工具契约与端口，
   适配器在 `agent-tools`。
4. `web-*` 不直接连 PG/Redis；所有数据经 `api`。

> 为什么第 3 条重要：如果 Agent 内核能直接 import 业务服务，它就能绕过工具白名单、
> 确认令牌与审计。工具面必须是**唯一入口**，这不是风格问题。

---

## 3. 运行拓扑

| 单元 | 端口 | 职责 | 可独立部署 |
|---|---|---|---|
| `web-portal` | 3050 | 业务端页面、PiAgent 侧栏、SSE 客户端 | ✅ |
| `web-console` | 3060 | 治理台、发布台、审计、配置 | ✅ |
| `api` | 3001 | REST、认证、租户、业务用例、内部工具端点 | ✅ |
| `agent-gateway` | 3002 | 会话、上下文编译、模型路由、工具循环 | ✅（v1 可并入 api） |
| `worker` | — | cron、outbox、发布构建、评测 | ✅（v1 可并入 api） |
| PostgreSQL | 5432 | 业务 + 发布 + 审计 + Outbox | 外部依赖 |
| Redis | 6379 | 会话、缓存、锁、幂等、SSE 缓冲、限流 | 外部依赖 |

### 3.1 什么时候才真的拆进程

v1 允许 `api` + `agent-gateway` + `worker` 跑在同一 Nest 进程，但**代码按 app 边界组织**。
满足任一条件再拆：

- SSE 长连接数 > 单进程承载上限，或模型调用延迟影响业务 API 的 P99。
- 发布构建/评测占用 CPU 超过 30%，影响在线请求。
- 需要独立扩缩容或独立发布节奏。
- 安全边界要求 Agent 进程无业务库直连权限。

拆分时只改 `main.ts`/部署配置，不改 libs 依赖方向。这是把“逻辑边界”与“物理进程”分开的好处。

---

## 4. 三条请求链

### 4.1 业务请求（同步）

```text
Browser
  → web-portal（RSC / Route Handler / next rewrite）
  → api /api/*
  → JwtAuthGuard → OrgContextGuard → AppContextGuard → PermissionGuard
  → app-* use case
  → domain-* 纯规则
  → infra-* repository
  → PostgreSQL / Redis
  → EnvelopeInterceptor { code, msg, data, rows, total }
```

约定：

- 前端仍走 `/backend-api/*`，由 Next rewrite 到 `api`，避免改现有 `lib/http.ts`。
- 所有写请求带 `Idempotency-Key`（前端生成 UUID），服务端 24h 去重。
- 租户上下文只从 JWT/会话解析，**不从请求体或提示词读取**。
- 应用上下文 `X-App-Id` 只用于选择目标应用；有效性由平台按身份/组织/应用状态重新解析。

### 4.2 业务端 PiAgent（流式）

```text
Browser
  → web-portal PiAgent 侧栏
  → agent-gateway POST /agent/chat（SSE）
  → 认证/租户/应用上下文
  → Context Compiler（用户、权限、当前页面、releaseId、检索知识、工具子集、预算）
  → 模型（L1 意图 / L2 规划）
  → Tool Loop
      → 工具网关：契约 → 参数 → 权限 all-of →（写）确认令牌 → 执行 → 审计
      → api 内部工具端点 / app-* 用例
  → Interaction Plan / 文本回答 / 表格 / 错误
```

约定：

- Agent 不直连 PG；只经工具。
- 每个 turn 记录 `releaseId`、`skillVersion`、`knowledgeVersion`、`traceId`。
- 写操作先返回 `interaction-plan` + 确认动作；用户确认后签发一次性令牌，再执行。
- SSE 事件类型固定：`turn.start`、`text.delta`、`plan`、`tool.start`、`tool.result`、`turn.end`、`error`。
  新增事件类型必须先改协议文档。

### 4.3 管理端 PiAgent Builder（长任务）

```text
web-console 治理台
  → agent-gateway /builder/chat
  → 读取反馈/指标/当前草稿
  → 生成 ChangeProposal（Delta + 证据 + 风险 + 测试计划）
  → release-kernel 校验/编译/预览
  → 人工审批
  → worker 构建 Release
  → 激活（org/cohort）
```

约定：

- Builder 只能写**草稿/提议**，不能写生产业务表，不能批准/发布。
- 所有生成物必须过 Schema/编译/权限/迁移/评测闸门。
- 长任务用 job 队列；会话可中断、可恢复、可审计。

---

## 5. PostgreSQL 约定

### 5.1 表的归属与前缀

存量表不强制改名；**新增表**按前缀归属：

| 前缀 | 归属 | 例子 |
|---|---|---|
| `sys_` | 平台系统（用户/角色/权限/组织） | `sys_users`、`sys_roles` |
| `biz_` | 租户业务数据 | `biz_purchase_orders` |
| `app_` | 应用生命周期（安装/草稿/发布/激活） | `app_releases`、`app_change_proposals` |
| `agent_` | 智能体会话/工具/反馈/知识/评测 | `agent_feedback`、`agent_eval_runs` |
| `aud_` | 审计（存量 `audit_logs` 保留） | `aud_events`（可选） |

每张表必须在 `DOMAIN.md` 覆盖矩阵里有归属；没有归属的表不允许上线。

### 5.2 公共列

```sql
id              uuid primary key default gen_random_uuid()
organization_id uuid not null
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
created_by      uuid null
updated_by      uuid null
version         integer not null default 0      -- 乐观锁
deleted_at      timestamptz null                -- 软删除
```

例外：全局字典/平台表可以没有 `organization_id`，但必须在 `DOMAIN.md` 注明“全局表”。

### 5.3 类型与命名

- TS/JSON 字段用 camelCase；SQL 列名以 schema manifest 为准（新表建议 snake_case，
  存量 TypeORM 默认是 camelCase）；映射在 `infra-*` 层完成，`domain-*` 不手写列名字符串。
- 金额：`numeric(18,4)` 或按业务精度；**禁止 `float`/`double`**。
- 时间：`timestamptz`；禁止 `timestamp without time zone`。
- 布尔：`boolean`；禁止 `char(1)` 的 `'0'/'1'` 新表。
- 枚举：`text` + `CHECK` 或字典表；同一状态机只允许一套词。
- JSONB：只存 Schema 定义过的 payload，并带 `schema_version`；不要把可查询的业务标量塞进 JSONB。
- 索引：每个 FK 建索引；高频列表按 `(organization_id, status, created_at desc)`；软删除用部分索引。

### 5.4 租户隔离与 RLS

```text
JWT → organizationId
  → 事务开始：SET LOCAL app.organization_id = '<uuid>'
  → 所有查询受 RLS 策略约束
  → 事务结束
```

- 生产应用角色**不得是表 owner**，不得有 `BYPASSRLS`。
- RLS 是最后拒绝边界；应用层仍要有 `organizationId` 过滤与测试。
- 跨租户读取只能经显式平台能力（如运营后台），并写审计。

### 5.5 迁移

- 工具：TypeORM migration（保留现状）；命名 `{timestamp}-{verb}-{noun}.ts`。
- 原则：expand → migrate → contract；一个 Release 不允许“删列 + 改代码”同步上线。
- 破坏性变更必须写回退计划；无法回退的，发布闸门直接拒绝（INV-REL-10）。
- 大表回填分批、可重入、带进度；禁止长事务锁表。
- 已应用的 migration 不修改；修复用新 migration。

---

## 6. Redis 约定

### 6.1 Key 规范

```text
sap:{env}:{organizationId}:{domain}:{key}
```

例子：

```text
sap:prod:org_123:session:refresh:<jti>
sap:prod:org_123:cache:release:active
sap:prod:org_123:lock:release:publish:<releaseId>
sap:prod:org_123:idem:tool:<idempotencyKey>
sap:prod:org_123:rate:agent:<userId>
sap:prod:org_123:sse:turn:<turnId>
```

规则：

- **Redis 不存业务真源**。缓存丢了必须能从 PG 重建。
- 所有 key 必须有 TTL；唯一例外是显式声明的持久会话/黑名单，并在文档登记。
- 锁用 `SET key value NX PX ttl`；释放用 Lua 比对 value，防误删。
- 幂等键 24h；确认令牌 5min（沿用现有 `CONFIRMATION_TOKEN_TTL_MS`）。
- 缓存失效用版本键：`cache:release:active` 变更时递增，读侧拼版本，避免全量删 key。
- 集群模式如启用，key 必须带 hash tag `{org_123}`，保证同租户同槽。

---

## 7. Next.js 约定

- App Router；默认 Server Component，只有交互/浏览器 API 用 `'use client'`。
- 业务数据经 `api`；Next 的 Route Handler 只做 BFF（cookie → Authorization、聚合、裁剪），不写业务规则。
- `next.config.js` 保留 rewrite：`/backend-api/:path*` → `${API_URL}/api/:path*`。
- Schema 驱动页面：`PageRuntime` / `FormRuntime` / `CollectionRuntime` 从发布版本读取 UI Schema；
  生成型业务系统不手写页面。
- 发布激活后：`revalidateTag('release:<appKey>')`，避免用户长时间看到旧菜单/旧表单。
- 错误边界：区分“网络错误”“权限错误”“版本已切换”“字段已变更”，后者提示刷新。
- 不在客户端存权限真相；按钮可见性只是体验，服务端仍判权限。
- i18n：locale 不进 URL。请求时按 `?lang` → `NEXT_LOCALE` cookie → `Accept-Language` →
  `defaultLocale` 解析，根 layout 写入 `<html lang>`；语言切换只写 cookie + `router.refresh()`，不导航。
  旧 `/{locale}/...` 由 middleware 307 到无前缀路径，保留一个发布周期。

---

## 8. NestJS 约定

- 一个 `app-*` lib 暴露 `*.service.ts`（用例）与 `*.module.ts`；Controller 只做 HTTP 适配。
- DTO 用 `class-validator` 或 Zod（与 `shared-schemas` 同源）；全局 `ValidationPipe`。
- 统一信封：`{ code, msg, data, rows, total, token? }`，保留 RuoYi 兼容。
- 错误码固定：`INVALID_INPUT` / `DENIED` / `NOT_FOUND` / `CONFLICT` / `TIMEOUT` / `UNAVAILABLE` / `INTERNAL`。
- Guard 顺序：`JwtAuthGuard → OrgContextGuard → AppContextGuard → PermissionGuard`。
- 审计：写操作统一走 `AuditLogsService`；成功/失败都记；敏感字段按 `sensitiveArgs` 脱敏。
- 数据范围：列表/详情/写/删/迁移/导入/追溯统一走 `DataScopeService` + `ScopeSqlCompiler`；
  RLS 只做租户隔离，行级范围在应用层；声明 `dataScope` 的资源解析失败按 none。
- OpenAPI：`/api/docs`；新增端点必须带 `@ApiOperation` 与权限说明。
- 不在 Controller 里开事务；事务边界在 `app-*` 用例。

---

## 9. Worker 与调度

- 简单定时任务：`@nestjs/schedule` + `@Cron(name: '<domain>.<action>')`。
- 长任务/重试：BullMQ（Redis）或 Outbox；禁止在 HTTP 请求里跑长任务。
- **一个 registry**：`apps/api/src/monitor/scheduled-job.registry.ts`（或 `apps/worker/...`），
  集中声明 `jobKey`、cron、超时、锁、幂等键、死信策略。
- `FLOWS.md` 调度总表、registry、代码装饰器三向对拍（`check-meta-docs.mjs`）。
- 每个 job 必须：可重入、幂等、有超时、失败可见、可手动重放。

---

## 10. ORM 决策：保留 TypeORM，不在此迁移 Prisma

**决策建议（采用时登记为 D-x）**：

> sapbase 现有 `apps/api/src/**/*.entity.ts` 与 TypeORM migration 是既有资产。
> Nx 迁移不更换 ORM；新增代码继续用 TypeORM。若未来引入 Prisma，必须单独立项，
> 按限界上下文逐个迁移，不允许两套 ORM 在同一上下文内混用。

理由：

1. Nx 迁移已经足够大；同时换 ORM 会把“结构问题”和“数据访问问题”混在一起排查。
2. 现有 Blueprint/RLS/审计代码与 TypeORM 实体耦合较深。
3. `followup-nx` 用 Prisma 是它的起点，不是 sapbase 的约束；参考的是**契约与校验**，不是 ORM。

如果坚持 Prisma：先在 `domain-*` 定义仓储端口，`infra-*` 用 Prisma 实现，一个上下文一个上下文迁移；
双写/对拍期必须有数据一致性测试，且 `DOMAIN.md` 的 schema 解析器要换成 manifest 适配器。

---

## 11. 从 npm workspaces 迁移到 Nx

原则：**每一步都可发布，不搞大爆炸**。

| 步 | 动作 | 验收 |
|---|---|---|
| 1 | `npx nx@latest init`，保留 npm workspaces 与现有脚本 | `npx nx graph` 能列出项目；现有 `npm run dev` 不变 |
| 2 | 给 `speckit` / `backend` / `shared-schemas` 加 `project.json` 与 tags | `nx run-many -t build` 通过 |
| 3 | 开启 `@nx/enforce-module-boundaries`，先 `warn` | 现有违规列清单，不挡 CI |
| 4 | 抽 `libs/shared-*`、`libs/domain-*`（从纯函数开始） | 新 lib 有单测；旧引用逐步替换 |
| 5 | `speckit` 按路由组分出 `web-portal` / `web-console` | 两条 `next build` 通过；登录/首页冒烟 |
| 6 | 抽 `agent-kernel` / `agent-tools`，PiAgent 先只读 | 工具契约 check 通过；写操作仍需确认令牌 |
| 7 | 抽 `worker`（或先逻辑模块） | cron registry 三向对拍通过 |
| 8 | 边界规则从 `warn` 调 `error` | CI 阻断违规依赖 |

**不要**：

- 不要先改目录名再修 import；先用 Nx 的 project 映射包住旧结构，再逐步移动。
- 不要在迁移 PR 里顺手升级 Nest 10 → 11、Next 15 → 16；升级单独 PR、单独回归。
- 不要把 `backend` 一次性拆成十个 app；先逻辑分层，再物理拆分。

---

## 12. 部署形态

默认（与 followup-nx 一致）：

```text
Nginx
  ├─ /            → web-portal :3050（standalone）
  ├─ /console     → web-console :3060（standalone）
  ├─ /backend-api → api :3001
  └─ /agent       → agent-gateway :3002（SSE，需关闭 proxy_buffering）
PM2 管理进程；PG/Redis 由宿主机或托管服务提供。
```

要求：

- 构建产物自带 `node_modules` 裁剪；服务器不再跑 `nx build`。
- `.env` 不进仓库；密钥只放部署机 `/etc/sapbase/*.env` 或密钥管理服务。
- 健康检查：`/api/health`（api）、`/agent/health`（agent）。
- SSE：Nginx `proxy_buffering off`、`proxy_read_timeout` ≥ 300s、心跳 15s。
- 发布 Release 与部署进程**解耦**：先部署兼容代码，再激活 Release；回退 Release 不需要回滚进程。

---

## 13. 反模式

| 反模式 | 后果 | 正确做法 |
|---|---|---|
| `web-*` 直接连 PG/Redis | 绕过权限/RLS/审计 | 只经 `api` |
| `agent-kernel` import `app-*` | 绕过工具白名单与确认令牌 | 端口 + `agent-tools` 适配器 |
| 一个 `libs/shared` 装所有东西 | 变成垃圾抽屉，依赖方向失效 | 按 `shared-*` 职责拆分 |
| 先拆微服务再补契约 | 分布式问题掩盖领域问题 | 模块化单体 + 契约先行 |
| 迁移 PR 顺手升级框架 | 回归无法定位 | 迁移与升级分开 |
| 用 Nx 的 `affected` 代替测试 | 受影响范围算错就漏测 | `affected` 加速 + 关键路径全量回归 |
| 把 Redis 当队列唯一真相 | 丢消息无法恢复 | Outbox / BullMQ 持久化 + 死信 |

## UI Runtime 能力清单

前端页面通过 `@sap/ui-runtime` 渲染，能力边界见 `docs/UI_CONTRIBUTION.md`：
页面/集合/表单/详情权限、字段/动作/行级可见性、草稿与离开守卫、统一格式管道、
工作台选中与窄屏降级、错误边界、图标白名单。Agent/人不得为修页面旁路改 `libs/*` 生产行为。


## 身份与会话治理边界

- 身份提供方按组织配置（CAS/OAuth2/OIDC/SAML），`identity_providers.secretRef` 只存引用；
  JIT 只给 provider 默认角色，高权限必须手工/同步授予。
- 组织内多角色走 `organization_member_roles`；有效权限 = 本组织 active 角色并集 ∪ 直授，
  `users.roleId` 仅兼容回退。
- `auth_sessions` 是持久会话真源，JWT 带 `sid` 与 `pv`；登出/强制下线/密码/角色/停用/离职
  立即吊销，缓存只加速。WebSocket 连接同样带 `sid`，吊销后主动断开。
- 服务令牌只证明客户端/组织/scope；代用户调用必须服务端重新解析功能权限与数据范围，
  并受限流/审计约束。
- 身份同步按 provider 隔离，源不可用不降级删除；高风险离职可配置人工确认。

## ERP 应用导航元数据

- `templates/auto-parts/ui.json` 声明 ERP 应用页面与菜单（含 shipping 稳定路由）。
- `GET /api/apps/:id/navigation` 从 active installation 当前 release 的
  `compiled.ui` 解析菜单/路由，并可按用户权限过滤。
- 平台 shell 只保留通用路由段（dashboard/reports/admin/system-settings）；
  `shipping` 等业务段由应用元数据声明，不在 `route-display`/tab 逻辑里硬编码。

## CRM 应用

- `templates/crm/` 是独立 CRM 应用包：Customer/Contact/Lead/Opportunity/Activity。
- 菜单/页面只在 `templates/crm/ui.json` 声明（客户/联系人/线索/商机/活动），
  平台 shell 不包含 CRM 路由或菜单硬编码。
- `GET /api/apps/:id/navigation` 对 CRM active installation 返回同样的
  Blueprint UI 导航，证明新应用不需要改 shell。

## 应用级目录

- `app_role_bindings` 保存应用级角色与权限点，唯一键为组织 + appKey + 角色名；
  执行上下文解析时与 JWT 权限合并。
- `app_brand_configs` 保存应用级品牌覆盖，与组织级 `brand_configs` 分离。
- `GET /api/apps/:id/catalog` 聚合应用角色/权限/菜单/品牌/审计/用量/权益；
  菜单来自 Blueprint UI 元数据，审计按 appInstallationId，用量按 appKey。

## 跨应用数据能力

- `app_capabilities` 声明发布方 appKey、能力名、实体、投影字段、消费权限、
  owner 字段与 read-all 权限。
- `POST /api/app-capabilities/:name/invoke` 由消费方 `X-App-Id` 发起；
  平台校验双方安装、权限与 owner 范围，只返回声明投影。
- `templates/erp` 发布 `customer.lookup`，`templates/crm` 通过该能力读取客户，
  不直接访问 ERP 私有 `blueprint_records`。

## 应用切换与私有记录隔离

- `X-App-Id` 消费方上下文与 package id 必须一致：CRM 安装不能访问 ERP package；
  无 `X-App-Id` 的旧租户调用保持兼容。
- ERP/CRM 各自 `blueprint_records.Customer` 按 `blueprintId` 隔离；
  CRM 只能通过 `app_capabilities` 的 `customer.lookup` 读取 ERP 声明投影。
- e2e：`tests/app-switch-isolation.e2e.js` 覆盖安装、导航、私有记录隔离、
  跨 package 403 与能力投影。


## 不可信工具结果与审计脱敏

- `untrustedResult=true` 的工具结果在返回前用 `SAP_UNTRUSTED_DATA` + source/nonce 包裹，
  不允许裸对象进入模型上下文。
- 工具审计参数递归脱敏：`sensitiveArgs` 声明键与 token/secret/password/authorization/
  apiKey/credential/cookie 等常见密钥键统一替换为 `***`，嵌套对象/数组同样处理。
