# Project Context

> 本文件是 AI 助手进入本项目时的**权威上下文**。术语、不变量与文档真源以
> [`docs/META_LANGUAGE.md`](../docs/META_LANGUAGE.md)（项目元语）为准，本文件是它的入口摘要。
> 最后更新：2026-09-24

## Purpose

构建一个 **AI 驱动的模块化 ERP 平台**（Speckit ERP），并逐步演进为
**ERP Space Platform**：把 ERP 拆成"可交易的业务蓝图 + 不可拆出的执行内核 + 本地运行时"，
让客户获得可迁移的业务定义，但拿不到核心实现。

产品定义（一句话）：

> 不是让客户购买一个 ERP，而是让客户购买、设计和组合一个 ERP Blueprint，
> 再由统一的 ERP Runtime 把 Blueprint 编译成可运行的企业系统。

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
- **模块化注册**：业务能力以模块登记（`backend/src/module-registry/`），
  AI 生成的模块定义见 `backend/src/ai-modules/`
- **多租户隔离**：`TenantAwareEntity` + `DataIsolationInterceptor`（应用层；
  数据库 RLS 尚未引入）
- **原子与模块分离**：原子是最小执行单元，模块是原子的组合；
  可交付的原子实现以 Wasm 模块形态存在（`wasm-modules/`）
- **准入与执行共享同一份判定**：闸 1 静态校验与吊销判定只有一份实现
  （`@speckit/wasm-modules`），不在两端各写一份

### Testing Strategy

| 范围 | 现状 |
| --- | --- |
| 后端 | Jest + supertest（`backend/package.json`） |
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

## External Dependencies

| 依赖 | 用途 | 备注 |
| --- | --- | --- |
| PostgreSQL | 主数据库 | 通过 TypeORM |
| Redis | 缓存、会话、限流 | `cache-manager-redis-store` |
| LLM 供应商 | AI 模块生成、工作流建议 | `backend/src/ai-models/` 注册表（kimi / openai / anthropic，含 baseUrl 与 isDefault） |
| Stripe | 组织订阅计费 | `organizations.stripeCustomerId` |
| Sentry | 前端错误监控 | `@sentry/nextjs` |
| Docker | Wasm 隔离构建器 | `wasm-modules/Dockerfile.builder`；CI 中用 host 模式自证 |
| Clerk | — | ⚠️ 依赖存在于 `speckit/package.json` 但源码未使用，属模板残留，待清理 |
