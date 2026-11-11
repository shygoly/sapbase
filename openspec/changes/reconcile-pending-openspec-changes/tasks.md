# Tasks

> 本 change 只做治理与收敛，不实现业务能力。批准后按 1→7 顺序执行。

## 1. 冲突登记

- [x] 1.1 在 `design.md` 固化冲突表 C-01—C-10：涉及 change、证据、裁决、后续动作
- [x] 1.2 为每条裁决补充可验证证据（任务行号、spec 文件、代码路径）
- [x] 1.3 建立 `Status: SUPERSEDED` 标记模板与归档说明
- [x] 1.4 明确权限合成（组织角色 / 应用角色 / 直授 / `users.roleId`）的 ADR 入口；ADR 未落地前相关 change 不得 apply

## 2. 关闭已失效 change

- [x] 2.1 `add-workflow-engine` 标记 `SUPERSEDED by blueprint record transition`，停止勾选
- [x] 2.2 `refactor-workflow-to-ddd` 标记 `SUPERSEDED by blueprint record transition`，停止勾选
- [x] 2.3 `add-full-system-generation-and-deploy` 标记 `SUPERSEDED by add-dsl-management-and-display`
- [x] 2.4 删除 `apps/api/test/ai-module-lifecycle.e2e-spec.ts` 的 `generate-system` 段，或改写为 410/不存在断言
- [x] 2.5 `add-a2-release-automation` 旧白名单标记 legacy，注明由 `add-evidence-governed-builder-and-limited-a2` 收口

## 3. Spec delta 修正

- [x] 3.1 `enforce-deterministic-business-command-invariants`：`document-runtime` 的 `State Transition Execution`、`Referential Integrity on Delete` 改为 `MODIFIED` 或删除重复 delta
- [x] 3.2 `enforce-deterministic-business-command-invariants`：`notification-outbox` 的 `Transactional Event Publication`、`At-Least-Once Delivery with Idempotency` 改为 `MODIFIED`
- [x] 3.3 `harden-approved-release-artifact-integrity`：`blueprint-delivery` 的 `Licensed and Signed Delivery` 改为 `MODIFIED`
- [x] 3.4 `add-patch-dsl-system`：对齐已有 `patch-dsl-system` spec 的 4 条 Requirement，重复项改为 `MODIFIED`
- [x] 3.5 校验：`openspec validate <change> --strict` 全部通过

## 4. 单一 owner 与 apply 顺序

- [x] 4.1 固化 `release-lifecycle` owner/contributor 与顺序
- [x] 4.2 固化 `session-governance` owner/contributor 与顺序
- [x] 4.3 固化 `patch-dsl-system` owner/contributor 与顺序
- [x] 4.4 固化 `business-app-platform` owner/contributor 与顺序
- [x] 4.5 指定 `SchemaList` 单一 owner；删除 `unify-ai-module-ui-style` 中已不存在的 CRM Customers 任务
- [x] 4.6 指定 `CheckProvider` 单一 owner；`add-ai-content-governance` 只实现 provider，不建第二 registry
- [x] 4.7 由 `refactor-ai-native-control-plane-boundaries` 输出应从 `refactor-ai-native-business-app-platform` 删除的任务清单并勾销

## 5. 教育 traceability 矩阵化

- [x] 5.1 将 `add-education-delivery-traceability` 2.x–5.x 改为矩阵行：需求 / 目标 change / 任务号 / 状态 / 证据
- [x] 5.2 保留 0.x 追踪机制与阶段 gate，不保留重复实现 checkbox
- [x] 5.3 抽查 A-001、A-020、B-003、B-014 与 blueprint 任务一一对应

## 6. 陈旧路径清理

- [x] 6.1 `refactor-workflow-to-ddd`：`backend/src/workflows/**` → 当前 `apps/api` 路径或标记 superseded
- [x] 6.2 `add-patch-dsl-system`：`speckit/src/core/patch/**`、`speckit/public/patches/**` → `libs/app-shared/src/core/patch/**`、`apps/web-portal/public/patches/**`
- [x] 6.3 `ai-module-management`、`manage-ai-created-modules`：`speckit/src/app/admin/**`、`backend/src/**` → 当前 apps/libs 路径
- [x] 6.4 `refactor-ai-native-business-app-platform`、`add-agent-host-and-instance-evolution`：`backend/src/**` → 当前 apps/libs 路径
- [x] 6.5 `unify-ai-module-ui-style`、`migrate-schema-system-from-legacy`：`speckit/**` → 当前 apps/libs 路径
- [x] 6.6 `restore-green-backend-tests`：`backend/src/**` → `apps/api/src/**` 或明确历史范围

## 7. 机器检查与验收

- [x] 7.1 新增 `scripts/meta/check-openspec-hygiene.mjs`
- [x] 7.2 检查项：stale path、`ADDED` 与正式 spec 重名、同 capability 多 `ADDED`、superseded 仍有未完成任务
- [x] 7.3 `package.json` 增加 `check:openspec-hygiene` 并接入 `check:all`
- [x] 7.4 单测：构造 stale path / duplicate ADDED / superseded open task 三个负例，必须失败
- [x] 7.5 `npm run check:openspec-hygiene` 对当前仓库通过
- [x] 7.6 `npm run check:openspec-ledger` 通过
- [x] 7.7 `npm run check:all` 通过
- [x] 7.8 `openspec validate reconcile-pending-openspec-changes --strict` 通过
