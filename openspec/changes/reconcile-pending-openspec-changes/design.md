## Context

44 个 in-progress changes、1895 条未完成任务。自动检查结果：

- 完全相同任务 8 组，均为模板任务；
- 多 change 修改同一 capability 的情况 9 组；
- 9 个 change 仍引用拆分前路径（`backend/src/**`、`speckit/**`）；
- 2 个 change 共享 `workflow-engine` 的 8 条同名 Requirement，而该模块已被 `legacy-workflow-gone` 410 墓碑取代；
- 1 个 change 删除代码生成，另 1 个 change 仍在新增 `generate-system`，已完成 e2e 仍在调用它。

本 change 的核心不是“再写一个功能”，而是**建立可执行的裁决规则**，避免后续 apply 时重复、覆盖或复活已废弃能力。

## Goals / Non-Goals

### Goals

- 为每一组跨 change 重叠给出唯一裁决：`dependency` / `duplicate` / `conflict` / `superseded`。
- 关闭或标记 3 个已失效 change，停止继续勾选旧任务。
- 修正 spec delta 操作（ADDED vs MODIFIED）。
- 修复 9 个陈旧路径，使任务可执行。
- 为共享能力指定单一 owner 与 apply 顺序。
- 加机器检查，防止同类问题再次进入主线。

### Non-Goals

- 不实现 workflow、codegen、A2、教育域等业务功能。
- 不删除历史 proposal/design/spec；只做标记。
- 不重写已归档 change。
- 不替产品做“保留 A2 还是关闭 A2”之外的业务取舍。

## Conflict Register

| ID | 冲突 | 证据 | 裁决 |
|---|---|---|---|
| C-01 | `add-workflow-engine` 与 `refactor-workflow-to-ddd` 重复定义 `workflow-engine` | 两者 spec 含同名 8 条 Requirement；`apps/api/src/legacy-workflow-gone` 对 `/workflows` 返回 410；`apps/api/src/workflows（已删除）` 不存在 | **superseded**：两者均停止 apply，标注由 Blueprint record transition 取代 |
| C-02 | `add-dsl-management-and-display` 删除代码生成，`add-full-system-generation-and-deploy` 新增 | 前者 1.4/1.7/1.9 已勾选；后者仍含 `generate-system`；`ai-module-lifecycle.e2e-spec.ts` 仍调用该端点，代码中无实现 | **superseded**：关闭 full-system；删除/改写 stale e2e |
| C-03 | 旧 A2 白名单 vs 新 A2 收口 | 旧 change 2.1 允许表单布局/校验消息；新 change 2.5 限定展示帮助/字段提示，并要求旧 A2 disabled 待审 | **supersede**：新 change 为准；旧白名单标 legacy |
| C-04 | 教育 blueprint 与 traceability 任务重复 | traceability 4.1 A-001 ↔ blueprint 2.1；2.9 A-020 ↔ blueprint 3.x；3.1–3.9 ↔ blueprint 9.x | **duplicate**：traceability 改为矩阵，引用 blueprint 任务 |
| C-05 | 组织角色 / 应用角色 / 直授 / `users.roleId` 优先级未定义 | identity 3.2、business-app 3.3、review 3.1、已完成 role-permission 各有一套 | **conflict**：先冻结有效权限合成规则，再允许三 change apply |
| C-06 | control-plane 要求删除旧重做任务，business-app 仍保留 | control-plane 1.1「删除旧重做任务」；business-app 3.5/3.6/4.9/7.5 仍在 | **duplicate**：由 control-plane 输出删除清单，business-app 勾销 |
| C-07 | `CheckProvider` 与 `ContentSafetyProvider` 两套 registry | review 4.1；AI content 5.1 | **duplicate**：内容安全作为 `CheckProvider` 实现，不建第二 registry |
| C-08 | `SchemaList` 三个 change 同时修改 | migrate 3.6、unify-ui 2.x/3.1、integrate-versioned 2.3；CRM Customers 页面已被删除 | **conflict**：指定单一 owner，删除失效任务 |
| C-09 | 9 个 change 引用旧路径 | `backend/src/**`、`speckit/**` 已不存在 | **stale**：改写路径后才能 apply |
| C-10 | spec delta 把已存在 Requirement 写成 ADDED | `document-runtime` 2 条、`notification-outbox` 2 条、`blueprint-delivery` 1 条、`patch-dsl-system` 多条 | **conflict**：改为 MODIFIED 或删除重复 delta |

## Decisions

### D1. 当前代码与已归档 spec 优先

当 proposal 与当前代码/已归档 spec 冲突时，以当前代码与已归档 spec 为准；proposal 必须改写或标记 superseded，不得用新任务“覆盖”既成事实。

### D2. Superseded 不等于删除

被取代的 change 保留 `proposal.md` / `design.md` / `specs/`，在 proposal 顶部加：

```md
> Status: SUPERSEDED by <change-id> on <date>. Do not apply.
```

任务不再勾选，归档时走 `openspec archive --skip-specs` 或保留为历史。

### D3. 一个 capability 只有一个 owner change

同一 capability 的多份 delta 必须指定：

- **owner**：最终负责归档该 capability spec 的 change；
- **contributors**：只提供 `MODIFIED` 增量，不重复 `ADDED`；
- **apply 顺序**：owner 先归档，contributors 后归档。

首批指定：

| capability | owner | contributors |
|---|---|---|
| `workflow-engine` | 无（superseded） | — |
| `release-lifecycle` | `unify-effective-release-activation-and-recovery` | `harden-approved-release-artifact-integrity` |
| `session-governance` | `add-identity-federation-and-session-governance` | `harden-browser-plugin-and-data-boundaries` |
| `patch-dsl-system` | `add-patch-dsl-system` | `integrate-versioned-schema-human-ai-workbench` |
| `business-app-platform` | `refactor-ai-native-business-app-platform` | `unify-effective-release-activation-and-recovery` |
| `schema-list`（组件） | `migrate-schema-system-from-legacy` | `unify-ai-module-ui-style` 仅样式，`integrate-versioned` 只读 |
| `check-provider` | `add-review-and-approval-platform` | `add-ai-content-governance` 只实现 provider |
| `education` | `add-education-reference-blueprint` | `add-education-delivery-traceability` 只做矩阵 |

### D4. 追踪矩阵不产生实现任务

`add-education-delivery-traceability` 的 2.x–5.x 改为表格：

```md
| 需求 | 目标 change | 目标任务 | 状态 | 证据 |
```

不再保留独立实现 checkbox；阶段 gate 可以保留。

### D5. Spec delta 操作规则

- Requirement 名已存在于 `openspec/specs/<capability>/spec.md` → 必须 `MODIFIED`。
- 只有真正新增的 Requirement 才能 `ADDED`。
- 同一 change 内不得对同一 capability 同时 `ADDED` 和 `REMOVED` 同名 Requirement。

### D6. 陈旧路径门禁

新增 `scripts/meta/check-openspec-hygiene.mjs`，至少检查：

1. 每个 in-progress change 的 tasks/proposal 中反引号路径是否存在（允许通配/待新增标记）；
2. `ADDED` Requirement 名是否已存在于正式 spec；
3. 同一 capability 是否被多个 change `ADDED`；
4. proposal 是否带 `Status: SUPERSEDED` 却仍有未完成任务。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 关闭 workflow/full-system 丢失历史意图 | 只标 superseded，不删除文件；保留原任务与日期 |
| 路径检查误报（待新增文件） | 允许 `（待新增）` / `TODO` 标记，只对已声明存在的路径做强校验 |
| 权限合成规则需要产品/安全拍板 | 本 change 只建立裁决入口与 ADR 模板，不替产品决定 |
| 多 change 同时改 tasks 产生冲突 | 按 change 分批提交，先登记后改写 |

## Migration Plan

1. 落冲突登记表与 `Status: SUPERSEDED` 标记。
2. 关闭 workflow ×2、full-system ×1。
3. 修正 spec delta 操作与重复 Requirement。
4. 指定 owner/顺序，改写 education traceability 为矩阵。
5. 修复 9 个陈旧路径。
6. 实现 `check-openspec-hygiene.mjs` 并接入 CI。
7. 重新生成台账，按裁决后的顺序继续 apply。

## Open Questions

无。冲突裁决按“当前代码/已归档 spec 优先”执行；权限合成规则的具体算法由后续 ADR 决定，但本 change 要求先有 ADR 才允许相关 change apply。
