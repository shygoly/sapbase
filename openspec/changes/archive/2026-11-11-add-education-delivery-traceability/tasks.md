# Tasks

> 本文件只保留追踪机制、目标 change 索引与阶段 gate；逐项需求状态与证据见 `traceability.md`。
> 实现任务 MUST 在目标 change 的 `tasks.md` 中维护，本文件不复制实现 checkbox。
> 每阶段结束运行 `npm run meta:openspec-ledger`。

## 0. 追踪机制

- [x] 0.1 建立 `traceability.md`，覆盖 A-001—A-050、B-001—B-035
- [x] 0.2 本轮已同步 A-021/A-024/B-022 与部分项证据（见 `traceability.md` 证据索引）
- [x] 0.3 Phase 0–4 gate 已登记：已完成项 + 明确延期/阻塞原因
- [x] 0.4 2026-11-10 第一批：CAS/OIDC 登录入口与回调（A-038 子项）
- [x] 0.5 2026-11-10 第一批：登录失败记录/锁定（A-044 子项）
- [x] 0.6 2026-11-10 第一批：`review.check` 注册与结果回写（A-014/B-015 子项）
- [x] 0.7 2026-11-10 第一批：Portal 消息中心 + 公告管理 UI（A-021/A-024/B-022 子项）

## 1. Phase 0：平台能力收尾（索引）

| 需求 | 目标 change | 目标任务 | 当前状态 |
|---|---|---|---|
| A-013、A-045、A-046 | `add-audit-compliance-and-tamper-evidence` + `add-ai-content-governance` | audit 5.4/8.1–8.5；ai-content 8.1 | 部分 |
| A-014、B-015、B-034 | `add-review-and-approval-platform` + `add-ai-content-governance` | review 4.x–6.x；ai-content 5.x–6.x | 部分 |
| A-018 | `add-review-and-approval-platform` + `add-education-reference-blueprint` | review 6.x；blueprint 7.1 | 部分 |
| A-021、A-024、B-022 | `add-notification-center-and-announcements` | 3.x–8.x | 部分 |
| A-037—A-040、A-044、A-047 | `add-identity-federation-and-session-governance` | 5.x–9.x | 部分 |
| A-042 | `add-identity-federation-and-session-governance` + data-scope | identity 3.2；data-scope 既有原语 | 部分 |
| B-006 | `add-async-job-and-callback-facade` | job / callback 任务 | 部分 |
| B-013 | `add-asset-and-media-pipeline` | 5.x、9.x | 部分 |

## 2. Phase 1：通用数据/内容基础（索引）

| 需求 | 目标 change | 目标任务 | 当前状态 |
|---|---|---|---|
| A-002、A-009、A-010、B-007 | `add-asset-and-media-pipeline` | 3.x–5.x | 部分/未启动 |
| A-003、A-006、A-007、A-022 | `add-record-lifecycle-and-tree-operations` | 3.x–7.x | 未启动 |
| A-008、A-017、A-035 | `add-bulk-import-export-framework` | 4.x–7.x | 未启动 |
| A-020 | `add-education-reference-blueprint` + `add-bulk-import-export-framework` | blueprint 3.x；bulk 4.x–6.x | 未启动 |

## 3. Phase 2：数据与 AI 治理（索引）

| 需求 | 目标 change | 目标任务 | 当前状态 |
|---|---|---|---|
| A-016、A-026、A-028、A-029、A-031—A-034、A-036、B-014 | `add-metrics-and-dashboard-platform` | 3.x–8.x | 未启动 |
| A-033、A-036 | 同上 + `add-education-reference-blueprint` | metrics 5.x；blueprint 9.x | 未启动 |
| B-002、B-008、B-009 | `add-document-intelligence` | 3.x–6.x | 未启动 |
| B-033、B-035 | `add-ai-content-governance` | 4.x、7.x | 未启动 |

## 4. Phase 3：外部集成 + 教育核心域（索引）

| 需求 | 目标 change | 目标任务 | 当前状态 |
|---|---|---|---|
| A-001、A-004、A-005、A-011、A-012、A-015、A-019、B-001、B-003、B-004、B-005、B-010、B-019、B-032 | `add-education-reference-blueprint` | 2.x–8.x | 未启动 |
| A-019、B-001 | 同上 + `refactor-ai-native-business-app-platform` | blueprint 8.x；refactor 3.3/4.4 | 部分 |
| A-025、A-027、A-048—A-050、B-016 | `add-external-integration-connector` | 4.x–9.x | 未启动 |

## 5. Phase 4：学生端、测评、媒体与离线（索引）

| 需求 | 目标 change | 目标任务 | 当前状态 |
|---|---|---|---|
| B-021、B-023—B-029、B-031 | `add-education-reference-blueprint` | 5.x–7.x | 未启动 |
| B-017、B-018、B-020 | 同上 + `add-asset-and-media-pipeline` | blueprint 7.x；asset 5.x | 未启动 |
| B-030 | `add-offline-content-package` | 3.x–7.x | 未启动 |

## 6. 阶段 gate

- [x] 6.1 Phase 0 gate：A-021/A-024/B-022 已完成；A-014/B-015/B-034 有 review.check 证据但 UI 延期；A-038/A-044 待真实 provider；B-006/B-013 待下游 change
- [x] 6.2 Phase 1 gate：全部延期（依赖 bulk/record-lifecycle/asset/document change，当前未启动）
- [x] 6.3 Phase 2 gate：全部延期（metrics/document/ai-content 未启动）
- [x] 6.4 Phase 3 gate：全部延期（education blueprint/external connector 未启动；A-019 部分依赖 AI-native runtime）
- [x] 6.5 Phase 4 gate：全部延期（education blueprint/offline/content package 未启动）
- [x] 6.6 已更新 `traceability.md` 状态列与证据索引
- [x] 6.7 已运行 `meta:openspec-ledger`（台账同步）

## 7. 矩阵抽查

- [x] 7.1 A-001 → blueprint 2.1（未启动，已登记）
- [x] 7.2 A-020 → blueprint 3.1/3.2（未启动，已登记）
- [x] 7.3 B-003 → blueprint 8.3（未启动，已登记）
- [x] 7.4 B-014 → metrics 3.x（未启动，已登记）
- [x] 7.5 B-033 → ai-content 4.x（未启动，已登记）
