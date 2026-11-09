# DECISIONS.md — 架构决策记录

> **机器可校验的决策登记**。代码里的 `D-x` 标记（词边界，非 `TD-x`）必须在此注册，
> 校验由 `node scripts/meta/check-meta-docs.mjs` 强制。新增决策按 D-x 递增编号，
> 格式用 `yaml decision` 围栏块。
> **命名空间约定**：`D-x` = 架构决策（本册）；`TD-x` = 技术债（`docs/tech-debt.md`，
> 不入本册）；`INV-x` = 不变量（`DOMAIN.md`）。三者正交，禁止混用前缀。

---

## 已收编决策

### D-1：发布不可变

```yaml decision
id: D-1
title: 发布不可变，修复必须发新版本
status: accepted
date: 2026-10
context: |
  早期“发布”只是上传 Blueprint 包，覆盖同名版本；出问题无法复现，
  也无法判断某个租户到底跑的是哪份定义。
decision: |
  app_releases 的 published 行只读；内容字段由数据库触发器拒绝 UPDATE。
  任何修复产生新的 semver + 新 digest；回退 = 重新激活旧 release。
references:
  - INV-REL-01
  - INV-REL-07
  - docs/reference/04-versioning-release.md
code_markers:
  - apps/api/src/business-apps/business-apps.service.ts
```

### D-2：保留 TypeORM，不在 Nx 迁移中换 ORM

```yaml decision
id: D-2
title: 保留 TypeORM，不在 Nx 迁移中更换 ORM
status: accepted
date: 2026-10
context: |
  Nx 迁移与 ORM 更换同时进行会把结构问题与数据访问问题混在一起；
  现有 Blueprint/RLS/审计代码与 TypeORM 实体耦合较深。
decision: |
  Nx 迁移不更换 ORM；新增代码继续用 TypeORM。
  若未来引入 Prisma，按限界上下文逐个迁移，不允许同一上下文混用。
references:
  - docs/reference/02-architecture.md
code_markers:
  - apps/api/src/migrations/data-source.ts
```

### D-3：PiAgent 只能经工具面操作

```yaml decision
id: D-3
title: PiAgent 只能经工具面操作，不得直连数据库
status: accepted
date: 2026-10
context: |
  直连数据库会绕过权限、确认令牌与审计；模型生成 SQL 还会引入注入与性能风险。
decision: |
  PiAgent 的所有业务读写必须经 contracts/tools.json 声明的工具；
  写操作必须一次性确认令牌；权限 all-of 由平台判定。
references:
  - INV-AGENT-01
  - INV-AGENT-02
  - docs/protocols/chat-erp.md
code_markers:
  - apps/api/src/agent-tools/agent-tool.registry.ts
  - contracts/tools.json
```

### D-4：作者 ≠ 批准人

```yaml decision
id: D-4
title: 提议作者不得批准/发布自己的提议
status: accepted
date: 2026-10
context: |
  Builder Agent 可以起草提议；若它也能批准，治理闭环失效，审计无法区分“建议”与“决定”。
decision: |
  审批与发布必须由有权限的人完成；服务端校验 approver ≠ author。
  高风险变更（权限/工具/知识/迁移）需要第二审批人。
references:
  - INV-AGENT-04
  - INV-EVO-02
code_markers:
  - apps/api/src/business-apps/business-apps.service.ts
```

### D-5：数据范围是平台原语，不是部门树扩展

```yaml decision
id: D-5
title: 数据范围用通用 scope 原语，不把 departments 改造成树
status: accepted
date: 2026-11
context: |
  大区/省/市与校区/年级/班级是不同维度的树；把 departments 加 parentId 只能表达一种树，
  后续垂直行业仍要改平台代码。
decision: |
  新增 scope_dimensions/scope_nodes/scope_memberships/scope_bindings/data_policies/scope_versions；
  departments 保留为 HR/展示，需要时用适配器接入。行业词只作为配置值。
references:
  - INV-DS-01
  - docs/OPENSPEC_CHANGE_DEPENDENCIES.md
code_markers:
  - libs/platform-core/src/data-scope/data-scope.service.ts
  - apps/api/src/migrations/1793100000000-CreateDataScope.ts
```

### D-6：数据范围只收窄，声明即执行

```yaml decision
id: D-6
title: 数据范围只收窄，未声明保持旧行为，解析失败 fail-closed
status: accepted
date: 2026-11
context: |
  数据范围若能从请求参数或租户策略扩大，会变成绕过功能权限的新通道。
decision: |
  最终可见集合 = 租户 ∩ 功能权限 ∩ 数据范围；蓝图模板 cap 与租户策略取交集；
  声明 dataScope 的资源解析失败按 none；未声明资源保持租户隔离旧行为。
references:
  - INV-DS-02
  - INV-DS-03
  - INV-DS-05
code_markers:
  - libs/platform-core/src/data-scope/scope-evaluator.ts
  - libs/platform-core/src/data-scope/data-scope.service.ts
```

---

## 附录：命名空间约定

| 前缀 | 含义 | 归属 | 校验 |
|---|---|---|---|
| `D-x` | 架构决策（不可逆的设计选择） | 本册 | `check:meta`（代码 D-x 标记必须在册） |
| `TD-x` | 技术债（待偿还的妥协） | `docs/tech-debt.md` | 无校验（债务，非契约） |
| `INV-x` | 不变量（运行时必须成立的约束） | `DOMAIN.md` / `01-meta-model.md` | `check:domain`（spec/enforcement 对拍） |

三者正交：同一个设计点可能同时有 D-x（决策）+ INV-x（不变量），但编号独立。
