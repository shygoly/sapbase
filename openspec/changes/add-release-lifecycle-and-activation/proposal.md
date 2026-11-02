# Change: 业务系统不可变 Release、激活与回退（P2）

> 执行顺序：**3 / 8**
> 依赖：变更 1（契约/checker）、变更 2（Nx 工作区）
> 参考：`docs/reference/04-versioning-release.md`、`07-adoption-and-checks.md` §P2

## Why

当前“发布”仍接近“上传/安装一个 Blueprint 包”：
`app_installations` 记录当前版本，`app_installation_revisions` 记录历史，
但没有不可变 Release、没有租户/cohort 激活、没有发布闸门、没有面向业务人员的 changelog。

结果是：管理员用 AI 改了系统以后，无法回答“某个租户到底跑的是哪一版、改了什么、出事退到哪”。
本变更把 `deploy` / `publish` / `activate` 三个动作拆开，并让发布成为**有状态、可审批、可灰度、可回退**的动作。

## What Changes

- **ADDED** 8 张发布生命周期表：
  `app_drafts`、`app_change_proposals`、`app_releases`、`app_release_items`、
  `app_release_activations`、`app_release_approvals`、`app_release_events`、`app_user_release_views`
- **ADDED** `libs/release-kernel`：semver/digest/状态机/diff/impact 纯逻辑
- **ADDED** `backend/src/releases`：发布、激活、回退、预览、changelog、whats-new API
- **ADDED** 数据库不可变触发器：`published` Release 内容拒绝 `UPDATE`，Release 行拒绝 `DELETE`
- **ADDED** 发布闸门 G0–G8 的可执行骨架与证据记录（G4/G5/G6 由后续能力接入）
- **ADDED** 预览 token（签名 JWT，绑定 user/org/release/roles，TTL ≤ 24h）
- **ADDED** 业务端 `whats-new` 与未读游标、管理端发布台最小页面
- **MODIFIED** `BusinessAppExecutionContext`：增加 `releaseId`，业务请求/审计可追溯
- **MODIFIED** `app_installations`：可选记录 `currentReleaseId`，旧字段继续保留
- **ADDED** `release.enabled` 开关：关闭时回退到现有安装/升级路径

**BREAKING**：数据库新增表与可选列；旧安装路径保留，默认不破坏现有调用。

## Impact

- Affected specs: `release-lifecycle`（新增）
- Affected code:
  - `backend/src/migrations/*CreateReleaseLifecycle*`
  - `backend/src/releases/**`、`libs/release-kernel/**`
  - `backend/src/business-apps/**`（上下文加 `releaseId`，保留旧路径）
  - `shared-schemas`（Release 状态词、上下文类型）
  - `speckit` 管理端发布台与业务端 whats-new
  - `contracts/schema-manifest.json`、`DOMAIN.md`、`FLOWS.md`、`DECISIONS.md`

## Out of Scope

- 不做 Agent 评测 G5（变更 6）
- 不做 Builder Agent 起草提议（变更 7）
- 不做 A2 自动发布（变更 8）
- 不更换 Blueprint 包格式；`app_releases.manifest` 只是目录级快照
- 不实现跨租户运营后台
