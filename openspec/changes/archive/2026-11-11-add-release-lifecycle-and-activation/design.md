## Context

现有资产：

- `backend/src/business-apps/`：安装、升级、回滚、修订记录
- `backend/src/blueprint/`：Blueprint 包、编译、digest、Ed25519 验签
- `app_installations` / `app_installation_revisions`：租户当前安装与历史

缺口：

- 没有“Release 是不可变制品”的概念；同名版本可能被覆盖
- 没有 activation；无法区分“制品存在”与“对某租户生效”
- 没有发布闸门、审批、灰度、changelog
- 无法从业务请求回溯到某个 Release

## Goals / Non-Goals

- Goals
  - `published` Release 内容不可变（DB 触发器 + 服务层双保险）
  - 激活只追加；回退 = 新增一条 activation
  - 同一安装同一时刻只有一个非 cohort `active`
  - 每个 Release 有 digest、签名、迁移计划、回退计划、业务 changelog
  - 业务请求与审计记录 `releaseId`
- Non-Goals
  - 不把 Release 做成新的元模型维度
  - 不替代 Blueprint manifest；Release 只是目录/激活层
  - 不实现自动回退（变更 8）
  - 不做多租户跨库发布

## Decisions

- Decision: 新表列名沿用 sapbase 现有 TypeORM 默认 **camelCase**（带引号），而不是参考 DDL 的 snake_case。
  - 理由：与现有 `app_installations` / `audit_logs` 保持一致；`DOMAIN.md` 以 manifest 实际列名为准。
  - 风险：与参考文档示例不同；在 DOMAIN 附录中注明。
- Decision: 时间列使用 `timestamptz`（新增表），金额/版本不使用浮点。
- Decision: `app_release_items` 不单独带 `organizationId`，通过 `releaseId` 继承租户；其余表带 `organizationId`。
- Decision: `app_releases.organizationId` 允许 `NULL` 表示平台级发布；唯一索引拆成平台级与租户级两条 partial unique index。
- Decision: 不可变由触发器最后防线，服务层仍有断言与测试。
- Decision: 发布/激活/回退是长任务；HTTP 返回 `202 + jobId`，通过轮询或 SSE 查状态。
- Decision: 预览 token 用现有 JWT 基础设施，claims 至少包含 `userId`、`organizationId`、`releaseId`、`roles`、`exp`。
- Decision: 保留旧安装路径：`release.enabled=false` 时，新发布 API 返回 `UNAVAILABLE`，现有 install/upgrade/rollback 不变。

## Data Model（实际列名 camelCase）

- `app_drafts`：`organizationId`、`appKey`、`baseReleaseId`、`status`、`revision`、`content`、审计列
- `app_change_proposals`：`draftId`、`baseReleaseId`、`type`、`areas`、`status`、`title`、`summary`、`diff`、`evidence`、`risk`、`testPlan`、`rollbackPlan`、`createdByAgent`、`approvedBy`、`publishedReleaseId`
- `app_releases`：`appKey`、`version`、`channel`、`status`、`baseReleaseId`、`manifest`、`changelog`、`compatibility`、`digest`、`signature`、`publishedAt`、`publishedBy`
- `app_release_items`：`releaseId`、`itemType`、`itemKey`、`changeType`、`beforeDigest`、`afterDigest`、`payload`
- `app_release_activations`：`organizationId`、`appInstallationId`、`releaseId`、`action`、`status`、`cohort`、`effectiveAt`、`activatedAt`、`activatedBy`、`reason`、`fromReleaseId`
- `app_release_approvals`：`proposalId`、`releaseId`、`approverId`、`role`、`decision`、`comment`
- `app_release_events`：`releaseId`、`organizationId`、`event`、`actorId`、`actorAgent`、`payload`
- `app_user_release_views`：`organizationId`、`userId`、`appInstallationId`、`lastSeenReleaseId`、`firstSeenAt`、`lastSeenAt`

## State Machines

- `AppDraft`: `draft → frozen`（`archived` 为终态）
- `ChangeProposal`: `draft → submitted → validating → validated → approved → published`，另有 `rejected` / `withdrawn`
- `Release`: `building → published → superseded | revoked`，另有 `failed`
- `Activation`: `scheduled → active → superseded | rolled_back`，另有 `cancelled`

状态词只允许这一套；禁止 `done` / `finished` / `completed` 同义替代。

## Pipeline G0–G8

| 闸 | 本变更实现 | 证据 |
|---|---|---|
| G0 | 调用 `check:domain` / `check:meta` / `check:agent-tools` | checker 报告 |
| G1 | Blueprint 编译 + Schema/引用完整性 | 编译记录 + IR digest |
| G2 | 权限 diff | 权限 diff 表；高风险要求安全审批 |
| G3 | 迁移 dry-run + 回退计划 | 迁移日志 + `rollbackSafe` |
| G4 | 调用后端测试套件 | 测试报告 |
| G5 | 预留接口；涉及 Agent 时由变更 6 接入 | `agent_eval_runs` |
| G6 | 预览冒烟记录 | Playwright 截图/录像 |
| G7 | 审批记录，作者 ≠ 批准人 | `app_release_approvals` |
| G8 | digest 重算 + 签名 + changelog + 不可变写入 | `app_releases` + `app_release_events` |

不涉及的闸必须显式记录 `notApplicableReason`，不得静默跳过。

## Risks / Trade-offs

- 风险：触发器与 TypeORM 更新冲突 → 服务层先判断，触发器只做最后拒绝。
- 风险：业务用户误看预览 → token 短 TTL + 每次访问审计 + 业务端只读 active release。
- 风险：旧安装路径与新发布路径双轨 → `release.enabled` 开关 + 明确 fallback + 对账任务。
- 权衡：G5/G6 在本变更只是接口，不假装完成。

## Migration Plan

1. 先加表与索引（expand），不删旧列。
2. 加触发器与 `currentReleaseId` 可选列。
3. 上线 API 但 `release.enabled=false`，只做只读查询。
4. 小范围打开开关，做一次灰度 + 回退演练。
5. 回退：关闭开关，保留新表；旧 install/upgrade/rollback 继续工作。
