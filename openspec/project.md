# Project Context

> 本文件是 AI 助手进入本项目时的**权威上下文**。术语、不变量与文档真源以
> [`docs/META_LANGUAGE.md`](../docs/META_LANGUAGE.md)（项目元语）为准，本文件是它的入口摘要。
> 最后更新：2026-10-18

## Purpose

构建一个 **AI 驱动的多应用业务平台**（sapbase），把业务系统拆成
"可交易的业务蓝图 + 租户内应用安装 + 不可拆出的执行内核 + 可部署运行时"。
ERP、CRM、HRO、MES 与后续垂直系统共用一套协议和 Runtime，而不是各自复制一套平台。
客户获得可迁移的业务定义，但拿不到核心实现。

产品定义（一句话）：

> 不是让客户购买一个固定 ERP，而是让客户安装、设计和组合业务应用；
> 每个应用由 signed Blueprint release 定义，并由统一的 Business App Runtime 执行。

当前阶段：真实产品是"AI 模块定义 → 模块注册 → 前端运行时渲染"的闭环，
平台化目标（蓝图编译器、许可市场）处于设计与协议冻结阶段。

## Tech Stack

| 层 | 技术 |
| --- | --- |
| 前端（`speckit/`） | Next.js 15.3（App Router）+ React 18.3 + TypeScript 5.7 + Tailwind CSS 4 + Radix/shadcn 风格 + Zustand 5 + React Hook Form + Zod 4 |
| 后端（`backend/`） | NestJS 10 + TypeORM 0.3 + PostgreSQL + Redis + Swagger + Jest |
| 共享（`shared-schemas/`） | TypeScript + Zod |
| 原子模块（`wasm-modules/`） | Rust 1.95（`wasm32-unknown-unknown`，`no_std`、零依赖）+ Node 内置 WebAssembly |
| 包管理 | npm workspaces（`shared-schemas` / `speckit` / `backend` / `wasm-modules`） |

前端依赖的**实际版本**以 [`docs/TECH_STACK_v2.md`](../docs/TECH_STACK_v2.md) 为准
（`speckit/README.md` 保留了上游 starter 模板原文，不可作为依据）。

## Project Conventions

### Code Style

- 通用规范见 [`.serena/memories/code_style_conventions.md`](../.serena/memories/code_style_conventions.md)
  （文件 kebab-case、组件 PascalCase、类型 PascalCase、常量 UPPER_SNAKE_CASE）
- **领域命名以 [`docs/META_LANGUAGE.md`](../docs/META_LANGUAGE.md) 第 6 节术语表的"代码标识符"列为准**，不要另造同义词
- 提交信息：约定式提交（`feat:` / `fix:` / `docs:` / `refactor:` / `chore:` …），见 `commitlint.config.js`；标题不超过 100 字符

### Architecture Patterns

- **Schema 驱动**：页面/表单/列表由 Schema 描述，运行时渲染
  （`speckit/src/core/schema/`、`speckit/src/components/runtime/`）
- **增量修改优先**：一切结构变更走 Patch DSL（`speckit/src/core/patch/`），
  它是未来 `space-delta` 协议的前身
- **模块化注册**：业务能力以模块登记（`apps/api/src/module-registry/`），
  AI 生成的模块定义见 `apps/api/src/ai-modules/`
- **多租户隔离**：`TenantAwareEntity` + 事务内 `app.organization_id/app.app_installation_id`
  上下文 + PostgreSQL RLS；应用层 Predicate 继续保留用于可解释错误。生产应用角色必须是
  非 owner、非 superuser、无 `BYPASSRLS`
- **身份与会话**：身份提供方按组织配置（CAS/OAuth2/OIDC/SAML），JIT 只给默认角色；
  组织内多角色走 `organization_member_roles`，有效权限为 active 角色并集 ∪ 直授；
  JWT 携带 `sid`/`pv`，守卫校验持久会话与权限版本；登出/强制下线/密码/角色/停用/离职
  立即吊销。服务令牌只证明客户端/组织/scope，代用户调用必须服务端重解析功能权限与数据范围
- **应用安装边界**：`Organization` 与 `Blueprint` 之间由 `BusinessAppInstallation` 绑定；
  应用上下文由 `X-App-Id` 发起、平台重新校验，不能从请求体信任
- **原子与模块分离**：原子是最小执行单元，模块是原子的组合；
  可交付的原子实现以 Wasm 模块形态存在（`wasm-modules/`）
- **准入与执行共享同一份判定**：闸 1 静态校验与吊销判定只有一份实现
  （`@speckit/wasm-modules`），不在两端各写一份

### Testing Strategy

| 范围 | 现状 |
| --- | --- |
| 后端 | Jest + supertest（`apps/api/package.json`） |
| Wasm 原子模块 | `node --test`（闸 0/1 拒绝集、闸 2 复现构建、ABI 往返），53 项 |
| 前端 | ⚠️ **无测试框架**（`speckit-legacy` 曾有 jest + Playwright，迁移中丢失） |

新增协议/契约类逻辑必须带负例（拒绝集），只测正路径不作为完成标准。

### Git Workflow

- 主干 `main`；特性分支建议 `codex/` 前缀
- 约定式提交；一个变更一个主题
- **新能力 / 破坏性变更 / 架构调整先立 OpenSpec change proposal**，
  批准后实现，完成后归档到 `openspec/changes/archive/`

## Domain Context

### 元模型 Ω

`Ω = ⟨E,O,R,Φ,Σ,Λ,Γ,Τ,V,C⟩`：Entity / Object / Relation / Constraint 为必需维度，
State / Event / Capability / Time / Version / Context 为渐进维度。

### 设计时真源与增量

设计时产物（LLM 生成或人工编辑）一律表达为**增量（Delta）**，不得旁路改写语义对象集合，
也不得让 LLM 直接产出最终结构；送给模型的是裁剪后的最小上下文包，而非全量定义。
详见 [`docs/META_LANGUAGE.md`](../docs/META_LANGUAGE.md) 第 1 节与不变量 13。

结构化系统描述文档的清单（Schema / 组件模式 / 插件 / 后端架构等）见该文件第 5.2 节；
**新增描述内容请放入这些既有文件，不要另建新文件。**

### 五个核心协议

1. ERP Meta Model（业务对象、字段、关系、状态、事件、能力、上下文、版本）
2. Atomic Contract（原子的输入输出、前后置条件、幂等、权限、错误、实现封装）
3. Blueprint Package（完整 ERP 的语义/流程/规则/表单/BOM/审批/记账/分层/签名）
4. Runtime SDK Contract（Blueprint 如何被加载、验证、编译、执行）
5. License / Encryption Protocol（模块如何加密、授权、绑定、防二次销售）

**协议未冻结则不做大规模实现**（元语不变量 10）。

### 概念边界

- 原子：`calculation` / `query`（v1 允许）；`command` / `effect` 涉及事务与补偿，另立变更
- 准入层级：Tier A（平台自研）/ Tier B（第三方交源码、平台复现构建 + 审查）；**不设 Tier C**
- 生产 Runtime **不含** Jev（设计时 LLM）；运行时 AI 只以 Agent Host 形态存在
- 客户可见 Blueprint，不可见 Kernel；`模板文件 ≠ 可运行模板`

## Important Constraints

1. **包管理器只允许 npm**，唯一锁文件是根 `package-lock.json`
   （见 [`docs/PACKAGE_MANAGER.md`](../docs/PACKAGE_MANAGER.md)）
2. **Wasm 原子源码必须零依赖、`no_std`**：带 `build.rs` / proc-macro / `.cargo` 配置的源码
   会在闸 0 被拒（依赖会把审查面扩散到未审代码）
3. **fail-closed 且不回退**：任一准入闸不过即拒，不得静默回退到内置实现
4. **判定权在平台**：模块哈希一律重算，不采信提交方自述值
5. **不假设客户无法逆向**：目标是"拿不到可移植的核心实现"，不是"绝对不可逆"
6. 生产运行时必须确定性、可审计；LLM 只出现在设计时/编译时
7. 文档真源见 [`docs/META_LANGUAGE.md`](../docs/META_LANGUAGE.md) 第 5.2 节，避免多处重复维护
8. **RLS fail-closed**：生产环境设置 `RLS_ENFORCEMENT=required`；若应用数据库角色可绕过
   RLS，启动必须失败，而不是仅记录警告

## External Dependencies

| 依赖 | 用途 | 备注 |
| --- | --- | --- |
| PostgreSQL | 主数据库 | 通过 TypeORM |
| Redis | 缓存、会话、限流 | `cache-manager-redis-store` |
| LLM 供应商 | AI 模块生成、工作流建议 | `apps/api/src/ai-models/` 注册表（kimi / openai / anthropic，含 baseUrl 与 isDefault） |
| Stripe | 组织订阅计费 | `organizations.stripeCustomerId` |
| Sentry | 前端错误监控 | `@sentry/nextjs` |
| Docker | Wasm 隔离构建器 | `wasm-modules/Dockerfile.builder`；CI 中用 host 模式自证 |
| Clerk | — | ⚠️ 依赖存在于 `speckit/package.json` 但源码未使用，属模板残留，待清理 |

## 参考包归并后的入口

- 工程结构：`docs/ARCHITECTURE.md`（Nx + Next/Nest + PG/Redis）
- 发布模型：`docs/protocols/release.md`
- PiAgent：`docs/protocols/piagent.md`
- Agent 进化闭环：`docs/protocols/agent-evolution.md`
- 机器可校验契约：`DOMAIN.md` / `FLOWS.md` / `DECISIONS.md` / `AGENT-TOOLS.md`
- `docs/reference/` 只保留历史 README 与 `reference.zip`，不是入口，不参与校验。
