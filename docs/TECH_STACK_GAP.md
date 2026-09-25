# 技术栈差距分析：sapbase 现状 vs ERP Space Platform 目标栈

> 日期：2026-09-24
> 对照对象：《ERP Space Platform 技术栈设计》（目标栈，按层给出选型）
> 现状来源：本仓库实际依赖与源码用法（`speckit/package.json`、`backend/package.json`、`shared-schemas/package.json` 及源码检索）
> 相关文档：[ERP_Space_Platform_设计方案_v3.md](./ERP_Space_Platform_设计方案_v3.md)（第 14 节为架构与能力差距）、[TECH_STACK_v2.md](./TECH_STACK_v2.md)（前端技术栈核对版）
> **更新（2026-09-24，同日）**：已从 `medtrust/packages/wasm-algorithms` 移植 Wasm 原子模块体系，
> 新增 workspace 包 [`wasm-modules`](../wasm-modules/README.md)。本次更新改变了第 5.3 节
> "Rust / WASM" 与第 7 节的结论，相关行已就地标注。仍缺的是宿主侧 Wasm 运行时
> （Wasmtime / WasmEdge）与控制面集成。
>
> **更新（2026-09-25）**：宿主侧 Wasm 运行时（Wasmtime）与 Blueprint 包/编译器均已落地，
> 第 3、5.1、5.3 节的相关行就地更新（变更提案见
> [`openspec/changes/add-blueprint-package-and-compiler/`](../openspec/changes/add-blueprint-package-and-compiler/proposal.md)）。
> 结论摘要里的"缺协议与制品"已不再成立；剩下的空白集中在**图/向量检索、事件溯源、可观测性、部署形态**。

---

## 0. 结论摘要

现状与目标栈的差异**不在同一维度上"走得快慢"，而是在语言层就分叉了**：目标栈的核心假设是 "Runtime / Compiler / 执行内核用 Rust + WASM，TypeScript 只做前端与工具链"；就产品代码而言现状是**纯 TypeScript 双端**（Next.js + NestJS）。本次移植后，`wasm-modules/` 已带来 Rust 源码、Cargo 工程与 `.wasm` 产物，但它们是**模块侧**（构建 + 准入）的能力，不是运行时内核。

但目标栈中**与语言无关的那部分**，重合度比预期高：自研 Schema 驱动前端运行时、Patch DSL、多模型注册表、应用层租户隔离、PostgreSQL + Redis 均已存在。这些恰好是目标栈里最难补齐的"协议层"资产。

三条判断：

1. 目标栈的**技术方向正确**，但它的落地顺序（先 Rust 内核）对本仓库不成立——协议与包格式应当先于内核语言。
2. 现状**不缺框架，缺协议与制品**：缺少 Atomic Contract、Blueprint 包格式、图/向量检索、事件溯源。
3. **不应该"换栈"，应该"补协议"**。Rust/WASM 的引入有明确的触发条件，未触发前引入只增加成本。

---

## 1. 判定图例

| 标记 | 含义 |
| --- | --- |
| ✅ 已对齐 | 目标选型已实现，或实现了等价方案 |
| 🟡 部分 | 方向一致，但覆盖不完整或深度不足 |
| ❌ 空白 | 完全没有，属新增工作量 |
| ⚠️ 冲突 | 与目标选型不一致，需决策或修复 |

---

## 2. 核对方法（可复现）

以下命令用于得出本文结论，均可重复执行：

```bash
# Rust / WASM 资产是否存在
rg --files -g '*.rs' -g 'Cargo.toml' -g '*.wasm' -g '*.wit' . --hidden -g '!node_modules' -g '!.git'

# 图数据库 / 向量数据库
rg -l -i "qdrant|pgvector|neo4j|apache age|memgraph" --glob '!node_modules' --glob '!*.lock' .

# 可观测性
rg -l -i "opentelemetry|prom-client|prometheus" --glob '!node_modules' --glob '!*.lock' .

# 容器与基础设施
rg --files -g 'Dockerfile*' -g 'docker-compose*' -g '*.tf' -g 'k8s/**' -g 'helm/**' . --hidden -g '!node_modules'

# 内部通信 / 事件一致性
rg -l -i "grpc|protobuf" backend/src speckit/src
rg -l -i "outbox" backend/src
rg -l -i "hash.?chain|merkle|prevHash" backend/src

# 数据库行级安全
rg -l -i "row.level security|\bRLS\b" backend/src

# 前端依赖真实性
rg -n '"axios"' speckit/package.json backend/package.json
rg -n "swr" speckit/src
rg -l "@clerk" speckit/src
find . -maxdepth 5 -type d -name "axios" -not -path "*/axios/*"
```

---

## 3. 核心链路对比（协议 / 编译 / 运行时 / 数据）

| 层 | 目标选型 | 现状实现 | 判定 |
| --- | --- | --- | --- |
| 元模型定义 | JSON Schema 为权威 + TS(Zod/TypeBox) 与 Rust 双实现 | Zod 4 + 手写 TS 类型；根目录 `schemas/*.schema.json` 仅覆盖 plugin / package-manager / hooks | 🟡 只有 TS 侧一半，且权威源是 TS 类型而非 Schema |
| 语义图存储 | PostgreSQL + Apache AGE / Memgraph | PostgreSQL（TypeORM）；租户隔离在应用层 | 🟡 有主库，无图扩展 |
| 版本与生命周期 | semver + 声明式 diff 迁移 + 事件溯源 | `semver` 已装但未做解析器；TypeORM **命令式**迁移；无事件溯源 | ⚠️ 迁移范式与目标相反 |
| Blueprint 编译器 / IR | Rust，SSA-like IR（文本 + 二进制） | **已实现，但用 TS 而非 Rust**：`backend/src/blueprint/`（校验 → 依赖闭包 → 冲突检测 → IR）+ `schemas/blueprint-ir.schema.json`；IR 双形态（文本 + 结构化）等价且可 **逐字节往返**，摘要为文本形态 sha256，见 `docs/protocols/blueprint-ir.md`。二进制形态仍在目标侧 | 🟡 能力已具备，**实现语言与目标不同**（见 §7 触发条件） |
| LLM 接入 | 统一 Gateway + 多模型路由 + 成本 / 限流 / 审计 | `backend/src/ai-models/ai-model.entity.ts` 已是模型注册表（kimi / openai / anthropic + `isDefault` + `baseUrl` + `apiKey` + `lastTestedAt`）；另有 `speckit/src/lib/ai/kimi-client.ts` 与 workflow AI guard/suggestion | 🟡 有注册表与调用点，无网关、路由、成本追踪 |
| 受约束生成 | Structured Outputs / Outlines / XGrammar | 无约束解码；靠 prompt + 回环校验（patch validator、`step3-normalizer`） | 🟡 有回环思想，无语法级约束 |
| Context Compiler | 图查询 + 向量检索 + 预算优化 | 无（`backend/src/ai-module-context` 手工组织上下文） | ❌ 图库与向量库均不存在 |
| Space Delta | JSON Patch (RFC 6902) 扩展 + Ajv | `speckit/src/core/patch/types.ts`：5 类 scope（page / object / permission / state / menu）、5 种 op、L1–L3 安全级，配套 validator / executor / patch-manager / audit-logger / version-control / hot-reload / gateway | ✅ 最接近目标的既有资产，只需扩展命名空间 |
| Runtime 内核 | Rust + WASM 组件模型 | 全 TypeScript（NestJS 模块 + 前端运行时） | ❌ 技术路线不同 |
| WASM 沙箱 | Wasmtime（通用）/ WasmEdge / Extism | **两端齐了且已采用 Wasmtime**：模块侧零能力 ABI + 静态准入闸（`wasm-modules/`）；宿主侧 `backend/src/atomic-runtime/` 执行内核 + **Rust sidecar（`crates/wasm-host`，Wasmtime 48）** 提供 fuel 指令预算与 epoch 中断、进程外隔离；V8 保留为对拍引擎与显式回退路径（`ATOMIC_ENGINE`） | ✅ |
| 事务与一致性 | ACID + Saga + Outbox + 事件溯源 + 哈希链 | PostgreSQL 事务；`backend/src/common/events/event-bus.service.ts` 进程内事件总线；`audit-logs` 实体表 | 🟡 有事件雏形，无 Outbox / Saga / 哈希链 |
| 离线优先与同步 | 本地 SQLite + 操作日志同步 + CRDT | 无（前端直连远程 API） | ❌ |
| 对象存储 | MinIO / S3-compatible | 本地磁盘 `./uploads`（multer） | ⚠️ 与之相反：无版本、无加密、无制品库 |
| 缓存 | Redis / Dragonfly | Redis 5 + cache-manager-redis-store | ✅ |
| 许可管理 | 自研 License Server + 离线租约 | 无；但已依赖 `stripe`，`organizations` 表含 `stripeCustomerId` / `stripeSubscriptionId` | 🟡 订阅计费有萌芽，许可体系为零 |
| 加密 / 水印 | age 或 libsodium + Vault + Ed25519 + 多态水印 | 仅 bcrypt（口令哈希） | ❌ |

---

## 4. 工程与交付对比

| 层 | 目标选型 | 现状实现 | 判定 |
| --- | --- | --- | --- |
| 表单引擎 | Formily / RJSF / 自研 JSON Schema 渲染器 | **自研**：`core/schema` + `components/runtime/{Page,Form,Collection,Detail}Runtime` + `core/page-model/schema-validator.ts` | ✅ 命中目标给出的第三个选项 |
| 前端框架 | React + TypeScript + Vite | Next.js 15.3 App Router + React 18.3 + TS 5.7 + Tailwind 4 + Radix | ⚠️ React/TS 对齐，但运行模型是 SSR + 文件路由，而非 Vite SPA |
| 移动端 | React Native / Flutter（可选） | 无（响应式 Web） | ❌（目标本身标注为可选） |
| 报表 / 表格 | ECharts + AG Grid | recharts + TanStack Table + React Flow | 🟡 可替换，非阻塞 |
| 认证授权 | OIDC / OAuth 2.1 + RBAC/ABAC + RLS | 自研 JWT（passport-jwt + bcrypt）+ RBAC（roles / permissions）+ 应用层隔离（`TenantAwareEntity` + `DataIsolationInterceptor`） | 🟡 无 OIDC、无 RLS；`@clerk/nextjs` 是模板残留且源码未使用 |
| API 网关 / 内部通信 | Higress / APISIX + gRPC + NATS / Kafka | 无网关；NestJS 单体 REST + Swagger；无 gRPC / Protobuf | ❌（单体阶段可接受） |
| 连接器引擎 | WASM 沙箱连接器 | 无（页面/服务内直接 REST 调用） | ❌ |
| 基础设施 | Kubernetes + Helm + ArgoCD；本地 Docker Compose / K3s | 无 Dockerfile、无 docker-compose、无 Terraform、无 K8s | ❌ |
| 可观测性 | OTel + Prometheus + Grafana + Loki | 无（前端仅有 Sentry，后端只有 `logs/` 目录） | ❌ |
| CI/CD | GitHub Actions / GitLab CI + Nx / Turborepo | GitHub Actions 已存在，但内容为模板校验（agents / commands / skills / hooks / rules）+ Node 18/20/22 × 4 包管理器矩阵 | 🟡 管道在跑，与产品代码无关 |
| Monorepo | Nx / Turborepo | npm workspaces（speckit / backend / shared-schemas） | 🟡 现规模够用 |
| 测试 | cargo test / vitest / Playwright | 后端 Jest + supertest；**前端无测试框架配置**（存在 `__tests__` 目录，但 package.json 中无 vitest/jest） | ⚠️ 前端测试空白 |

---

## 5. 四组差异

### 5.1 A 组：已对齐，可作为资产复用（不要重做）

| 资产 | 位置 | 对应目标概念 |
| --- | --- | --- |
| Patch DSL（含 validator / executor / audit / version-control） | `speckit/src/core/patch/` | Space Delta + Validator |
| Schema 驱动前端运行时 | `speckit/src/core/schema/` + `speckit/src/components/runtime/` | 自研表单与页面引擎 |
| 模块注册表（能力 / 关系 / 统计） | `backend/src/module-registry/` | Registry |
| 多模型注册表 | `backend/src/ai-models/` | LLM Gateway（雏形） |
| 应用层租户隔离 | `backend/src/common/entities/tenant-aware.entity.ts` + `common/interceptors/data-isolation.interceptor.ts` | 多租户 |
| PostgreSQL + Redis | TypeORM + `cache-manager-redis-store` | 主库 + 缓存 |
| ~~已装但未用足的三个包~~ | `adm-zip` / `jsonschema` / `semver` **都已用上**：`.erpkg` 打包与解包、包与 IR 的 Schema 校验、原子依赖的语义化范围求解（`backend/src/blueprint/`、`backend/src/atomic-registry/`） | Blueprint Package 三件套（**已完成**） |
| GitHub Actions 管道骨架 | `.github/workflows/` | CI/CD（内容需替换） |

### 5.2 B 组：方向一致但只做到皮毛（补深即可，不换技术）

| 能力 | 现状 | 需要补什么 |
| --- | --- | --- |
| 多租户 | `organizationId` + 拦截器做应用层隔离 | 数据库 RLS（目标栈推荐的 Pool + RLS 默认策略） |
| 事件 | 进程内 EventBus，README 已注明可扩展 Redis/RabbitMQ | Outbox、Saga、事件溯源、哈希链 |
| LLM | 模型注册表 + 调用点 | 统一网关、模型路由、成本与限流、受约束解码 |
| 版本 | `semver` 已在注册表解析与依赖闭包里使用 | 兼容性检查（跨版本迁移规则）仍缺 |
| 制品 | `.erpkg` 包格式已落（manifest / 分层 / 逐文件校验和），见 `schemas/blueprint-package.schema.json` | **签名**与 Protected 层加密（属 License 那条线） |

### 5.3 C 组：真正空白（新增工作量，非改造）

```text
~~Rust / WASM~~（已部分具备：模块源码通道 + 准入门禁 + 复现构建，见 `wasm-modules/`）
~~Wasmtime / WasmEdge / Extism~~（**已完成**：openspec change `add-wasmtime-host` —— Rust sidecar + Wasmtime 48 + fuel/epoch/进程隔离；对拍数据与代价清单在其 `design.md`）
~~Blueprint Compiler 与 IR~~（**已完成（TS 实现）**：openspec change `add-blueprint-package-and-compiler` —— 包与 IR 协议冻结、编译器、加载与原子绑定；编译/加载链见 `docs/META_LANGUAGE.md` §3.8）
图数据库（Apache AGE / Memgraph）
向量检索（Qdrant / pgvector）
Context Compiler
License Server 与 Capsule、水印
声明式迁移（Atlas / Liquibase 式）
对象存储（MinIO / S3）
容器化与编排（Dockerfile / Compose / K8s / Helm / ArgoCD）
可观测性（OTel / Prometheus / Grafana / Loki）
OIDC / Keycloak
离线运行形态（SQLite + 同步引擎）
```

除"容器化部署"外，其余均**不是当前阶段的前置条件**。

### 5.4 D 组：需要决策的冲突（4 项）

| # | 冲突 | 现状 | 目标 | 影响面 |
| --- | --- | --- | --- | --- |
| 1 | 前端框架 | Next.js 15（SSR + 文件路由） | React + Vite（SPA） | 影响本地/边缘运行、嵌入能力与构建产物形态 |
| 2 | 前端测试 | 无测试框架 | vitest + Playwright | 影响质量门禁，与前端"运行时"定位强相关 |
| 3 | 认证 | 自研 JWT | OIDC / OAuth 2.1（Keycloak / Auth0） | 影响企业集成、SSO 与合规 |
| 4 | 迁移范式 | TypeORM 命令式迁移 | 声明式 diff | 影响语义对象的版本演进与 Blueprint 兼容性检查 |

建议在"协议冻结"阶段一并定掉，不要拖到实现阶段再返工。

---

## 6. 建议：先做的三件事（不涉及换栈）

```text
1. 五个协议写成 JSON Schema          ← 部分完成：原子契约、蓝图包、IR 已冻结（schemas/）
   现用 Zod 4 可直接导出 JSON Schema，几乎零成本；
   产物放进 schemas/，由 shared-schemas 引用。

2. 落一个最小 Blueprint 包格式（先不加密）   ← 已完成（2026-09-25）
   复用已装的 adm-zip + jsonschema + semver；
   打通「模块定义 → 包 → 加载」闭环。

3. 把 Patch DSL 扩展为 space-delta/v2     ← 未开始（下一个协议）
   增加 link / unlink 操作；
    scope 扩展到 semantic / policy / flow / form 等命名空间；
   让 AI 生成走「增量 Delta + 确定性校验」。
```

三件事的顺序是硬约束：**第 1 件不完成，第 2、3 件会返工**。
实测结论一致：第 2 件（包与编译器）之所以能一次做对，正是因为第 1 件的包与 IR 协议先冻住了
（`.erpkg` 的 manifest 是包内唯一权威，编译器与加载器都只认它）。

---

## 7. Rust 的引入触发条件

目标栈推荐 Rust 的三条理由都指向同一件事：把"接口可见、实现不可见"从**组织性保护**升级为**技术性保护**，并支持本地/离线执行。

> 更新：触发条件 1 已经落地 —— `wasm-modules/` 引入了 Rust 模块通道与准入门禁，
> 使"原子实现不以可读源码交付"在模块粒度上成立。**但它的范围是刻意收窄的**：
> 只做「构建 → 复现 → 静态准入 → 产物 + 清单」，不含宿主运行时、不含控制面集成、不含许可签名。
> 也就是说，现在有的是**技术性保护的管道**，还不是保护本身（签名与许可仍在控制面待建）。

引入更多 Rust 的触发条件：

```text
1. ~~需要把某个原子实现交付给客户，且不能交付源码~~ → **已触发**，模块通道已就位
2. 需要客户本地 / 离线运行 Runtime → 需要宿主侧 Wasm 运行时（Wasmtime）
3. 需要运行不可信第三方代码（插件沙箱）→ 需要宿主侧运行时 + 闸 3（输出管控）
```

在模块通道之外，TypeScript 仍能实现"接口可见、实现不可见"的组织性分层（契约与实现分离）。分清组织性与技术性两种保护，可以避免为了"安全"过早重写整个内核。

建议的后续切入顺序：宿主侧 Wasm 运行时（加载 + 校验 + 资源限制）→ 闸 3 输出管控 →
Blueprint Compiler（纯计算、无 IO、最易验证）→ Atomic 执行内核 → 插件沙箱。

---

## 8. 现实提醒：目标栈的工期

目标栈文档自身的阶段估时：

```text
Phase 0  协议与元模型        3–6 个月
Phase 1  Runtime MVP         6–9 个月
Phase 2  编译器与 Blueprint  6–9 个月
Phase 3  LLM 编排            6–9 个月
Phase 4  行业模板与市场      9–12 个月
合计                        30–45 个月
```

这还没有计入 Phase 5（智能与生态）与企业级验证周期。对照现状（协议未冻结、单语言栈），本仓库大约位于 Phase 0 的中途。因此这份技术栈更适合作为 **3 年目标架构**，而不是下一个迭代的施工图。

---

## 9. 附带发现（与目标栈无关，但优先级更高）

| # | 发现 | 证据 | 影响 |
| --- | --- | --- | --- |
| 1 | `axios` 是前端幽灵依赖 | 代码在 `speckit/src/lib/api/client.ts`、`core/error/error-handler.ts` 中引用；`axios` 只声明在 `backend/package.json`，前端 `package.json` 无声明 | 干净环境下前端安装/构建可能解析失败 |
| 2 | `@clerk/nextjs` 与 `@clerk/themes` 未被使用 | 依赖存在于 `speckit/package.json`；`rg -l "@clerk" speckit/src` 无结果 | 认证方案混淆、包体积与安全审计噪音 |
| 3 | ~~三套包管理器并存~~ **已收敛** | 统一为 npm：删除 `speckit/bun.lock`、修正 `bun format` 脚本与 `.npmrc` 的 pnpm 残留键、未跟踪的 pnpm 文件移出仓库 | 已解决，见 [PACKAGE_MANAGER.md](./PACKAGE_MANAGER.md)（`node_modules` 干净重建仍需执行一次） |
| 4 | CI 与产品无关 | `.github/workflows/ci.yml` 原为 agents/commands/skills/hooks/rules 校验 + 四包管理器矩阵；**已重写**为 npm-only，并新增 `wasm-modules`（强制）与 `apps`（首期允许失败）两个产品 job | 已改善；`apps` job 跑通后应改为强制门禁 |
| 5 | 前端测试能力在迁移中丢失 | 现行 `speckit/package.json` 无 vitest/jest；而 HEAD 中的 `speckit-legacy/` 带有 `jest.config.js`、`jest.setup.js`、`playwright.config.ts` 与 `e2e/auth-and-permissions.spec.ts`，当前工作区已将其删除 | 运行时内核（schema / patch / plugins）缺少回归保护；建议删除前先迁移配置与用例 |
| 6 | 前端技术栈文档已漂移 | 见 [TECH_STACK_v2.md](./TECH_STACK_v2.md) 的 v3.0 版本说明 | 文档误导后续选型 |
| 7 | 前端状态机与工作流引擎随 legacy 移除 | HEAD 中存在 `speckit-legacy/src/core/state-machine/engine.ts` 与 `speckit-legacy/src/core/workflow/engine.ts`；现行 `speckit/src/core/` 无对应目录 | 与设计方案中的 State / Workflow 前端支撑直接相关，需评估是否迁移而非丢弃 |

建议处理顺序：**3 → 4 → 1 → 5 → 2 → 7 → 6**（先消除不可复现性，再补质量门禁，最后清理依赖与文档）。

---

## 10. 决策清单

```text
1. 是否维持 Next.js，还是为本地/边缘形态引入 Vite 构建？
2. 前端测试框架：vitest 单测 + Playwright E2E，还是先只做内核单测？
3. 认证走向：保留自研 JWT，还是迁移 OIDC（Keycloak）？
4. 迁移范式：是否引入声明式 diff（Atlas 思路）？
5. 多租户：是否在 PostgreSQL 上加 RLS（Pool + RLS 默认策略）？
6. 图数据库：Apache AGE（同库同事务，组件少）vs Memgraph（性能）vs 暂不引入？
7. 向量检索：pgvector（同库）vs Qdrant（性能与本地部署）vs 暂不引入？
8. 包管理器收敛到哪一个？
9. Rust 触发条件是否认可？若认可，写进架构决策记录（ADR）。
```

---

## 附录：目标栈分层选型索引

| 层 | 目标选型 |
| --- | --- |
| 元模型 | JSON Schema 为权威 + Zod/TypeBox（TS）+ serde/jsonschema（Rust） |
| 编译器 | Rust（pest / chumsky）+ 自定义 SSA-like IR |
| LLM 编排 | 多模型 Gateway + JSON Schema 约束解码 + Context Compiler |
| Runtime 内核 | Rust + WASM 组件模型（Wasmtime / WasmEdge / Extism） |
| 数据 | PostgreSQL（主）+ SQLite（边缘）+ AGE/Memgraph + Qdrant/pgvector + Redis |
| 前端 | React + TS + Vite + Formily 或自研渲染器 + ECharts |
| API | Higress / APISIX（WASM 插件）+ gRPC + NATS / Kafka |
| 安全 | OIDC + RBAC/ABAC + RLS + age/libsodium + Ed25519 + 水印 + 自研 License Server |
| 基础设施 | K8s + Helm + ArgoCD；本地 Docker Compose / K3s；OTel + Prometheus + Grafana |
