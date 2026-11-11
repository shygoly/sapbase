# Change: 收敛待执行 OpenSpec changes 的重复与冲突

## Why

对 44 个 in-progress changes、1895 条未完成任务做了文本去重、任务相似度、spec 能力重叠和代码路径核对，发现：

- 字面重复只有 8 组，基本是 `DOMAIN.md`、`TENANT_RLS_DDL`、API 文档、check 脚本等模板任务；
- 真正的风险是 **语义重复、已被取代的 change、共享能力多 owner、以及陈旧路径**；
- 9 个 change 仍引用拆分前的 `backend/src/**` 或 `speckit/**`，按原文无法 apply；
- 至少 3 个 change 的目标能力已经被当前架构取代或删除，但任务仍在排队。

如果不先裁决，继续按任务数从高到低 apply，会出现：

- `workflow-engine` 被重复归档两次；
- 已删除的 `generate-system` 被重新加回；
- 旧 A2 白名单与新 A2 收口并行实现；
- 教育域出现 blueprint 与 traceability 两套任务清单；
- 组织角色 / 应用角色 / 直授权限没有优先级，JWT 有效权限不可解释。

本 change 不实现业务能力，只建立**冲突登记、取代规则、单一 owner 和 apply 顺序**，让后续 change 可被安全执行。

## What Changes

- **ADDED** `openspec-governance`：
  - 跨 change 冲突登记表（依赖 / 重复 / 冲突 / 已取代）与证据要求。
  - 已取代 change 的关闭/归档标记规则，禁止继续勾选旧任务。
  - Spec delta 操作正确性：已存在 Requirement 只能 `MODIFIED`，不能 `ADDED`。
  - 陈旧路径门禁：tasks/proposal 引用的仓库路径必须存在。
  - 共享能力的单一 owner 与 apply 顺序。
  - 追踪矩阵类 change 不得复制目标 change 的实现任务。
- **MODIFIED** 待执行 change 的治理方式：
  - `add-workflow-engine`、`refactor-workflow-to-ddd` 标记为 superseded（Blueprint transition 已取代）。
  - `add-full-system-generation-and-deploy` 标记为 superseded（代码生成已移除）。
  - `add-a2-release-automation` 的旧白名单标记 legacy，由 `add-evidence-governed-builder-and-limited-a2` 收口。
  - `add-education-delivery-traceability` 的 2.x–5.x 改为引用 `add-education-reference-blueprint` 任务。
  - 9 个旧路径 change 重写目标路径后才能继续。
- **NOT CHANGED**：不删除任何已实现代码；不重写已归档 spec；不改变当前 `blueprint transition`、`release`、`identity` 的运行时行为。
- **NON-GOALS**：不做业务功能实现；不引入新框架；不替各 change 做产品取舍（只登记冲突与裁决入口）。
- **BREAKING**：无运行时破坏；但会关闭/改写多个 proposal 的任务清单。

## Impact

- 受影响规格：`openspec-governance`（新增）
- 受影响 changes（治理层）：
  - `add-workflow-engine`、`refactor-workflow-to-ddd`（superseded）
  - `add-full-system-generation-and-deploy`（superseded）
  - `add-a2-release-automation`、`add-evidence-governed-builder-and-limited-a2`（supersede 关系）
  - `add-education-reference-blueprint`、`add-education-delivery-traceability`（矩阵化）
  - `enforce-deterministic-business-command-invariants`、`harden-approved-release-artifact-integrity`、`add-patch-dsl-system`（delta 操作修正）
  - `add-identity-federation-and-session-governance`、`refactor-ai-native-business-app-platform`、`refactor-ai-native-control-plane-boundaries`（权限/边界任务收敛）
  - `add-dsl-management-and-display`、`unify-ai-module-ui-style`、`migrate-schema-system-from-legacy`（SchemaList/CRM 归属）
  - 9 个引用旧 monorepo 目录的陈旧路径 change
- 受影响工具：
  - 新增 `scripts/meta/check-openspec-hygiene.mjs`
  - `package.json` 增加 `check:openspec-hygiene`
  - CI 接入 `check:all`
- 依赖：无运行时依赖；仅依赖 `openspec` CLI 与仓库文件。
- 迁移：先落冲突登记与关闭标记，再逐 change 改写；不改已归档 change。
- 风险：关闭 change 可能丢失历史意图；因此只标记 superseded，不删除 proposal/design/spec，保留可追溯性。
