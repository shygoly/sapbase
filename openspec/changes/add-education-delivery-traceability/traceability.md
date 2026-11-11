# 教育需求交付追踪矩阵

> 基准：`docs/教育智能体定制开发详细需求说明（合作评估版）.md`、当前代码、`openspec/changes/**`。
> 状态口径：`已完成` = 可复用或本次已实现；`部分` = 内核存在但缺 UI/消费方/验收；`未启动` = 无对应实现。
> 本文件随需求项完成同步更新；不要在代码外另维护第二份状态表。
> `tasks.md` 只保留追踪机制、阶段 gate 与目标 change 索引；逐项任务号以本文件为准，不在 tasks.md 复制实现 checkbox。

## 阶段总览

| 阶段 | 目标 | 主要 change |
|---|---|---|
| Phase 0 | 收尾已开工平台能力，形成可演示闭环 | `add-identity-federation-and-session-governance`、`add-review-and-approval-platform`、`add-notification-center-and-announcements`、`add-audit-compliance-and-tamper-evidence`、`add-asset-and-media-pipeline`、`add-async-job-and-callback-facade` |
| Phase 1 | 通用数据/内容基础：导入导出、记录生命周期、资产加固 | `add-bulk-import-export-framework`、`add-record-lifecycle-and-tree-operations`、`add-asset-and-media-pipeline` |
| Phase 2 | 数据与 AI 治理：指标看板、文档智能、AI 内容治理 | `add-metrics-and-dashboard-platform`、`add-document-intelligence`、`add-ai-content-governance` |
| Phase 3 | 外部集成 + 教育核心域 | `add-external-integration-connector`、`add-education-reference-blueprint` |
| Phase 4 | 学生端、测评、媒体生成、离线与性能验收 | `add-education-reference-blueprint`、`add-offline-content-package`、`add-asset-and-media-pipeline` |

## A. 教育内容生产与运营管理平台

| ID | 功能 | 现状 | 目标 change | 阶段 | 难度 |
|---|---|---|---|---|---|
| A-001 | 课程基础信息 | 未启动（垂直） | `add-education-reference-blueprint` | Phase 3 | 中 |
| A-002 | 封面与开课配置 | 部分（资产内核；缺裁剪/绑定） | `add-asset-and-media-pipeline` + `add-education-reference-blueprint` | Phase 1/3 | 中 |
| A-003 | 课程层级维护 | 未启动 | `add-record-lifecycle-and-tree-operations` | Phase 1 | 中 |
| A-004 | 章节与知识点容量 | 未启动（垂直校验） | `add-education-reference-blueprint` | Phase 3 | 低 |
| A-005 | 课程状态管理 | 未启动（蓝图状态机） | `add-education-reference-blueprint` | Phase 3 | 低 |
| A-006 | 课程归档 | 未启动 | `add-record-lifecycle-and-tree-operations` | Phase 1 | 中 |
| A-007 | 版本记录 | 未启动（发布快照） | `add-record-lifecycle-and-tree-operations` | Phase 1 | 中 |
| A-008 | 知识点批量导入 | 未启动 | `add-bulk-import-export-framework` | Phase 1 | 中 |
| A-009 | 多模态素材上传 | 部分（上传会话/本地存储；缺格式限制/大文件/S3） | `add-asset-and-media-pipeline` | Phase 0/1 | 中 |
| A-010 | 素材标签推荐 | 未启动 | `add-asset-and-media-pipeline` + `add-education-reference-blueprint` | Phase 1/3 | 中 |
| A-011 | 教学内容生成 | 部分（Agent/任务内核；缺生成任务消费方） | `add-async-job-and-callback-facade` + `add-education-reference-blueprint` | Phase 0/3 | 高 |
| A-012 | 生成参数与草稿 | 未启动 | `add-education-reference-blueprint` | Phase 3 | 中 |
| A-013 | 生成任务审计 | 部分（哈希链；缺 AI 事件目录） | `add-audit-compliance-and-tamper-evidence` + `add-ai-content-governance` | Phase 0/2 | 中 |
| A-014 | 发布审核 | 部分（审批内核 + review.check 回写；缺 UI/终审） | `add-review-and-approval-platform` + `add-ai-content-governance` | Phase 0/2 | 中 |
| A-015 | 教学任务发布 | 未启动 | `add-education-reference-blueprint` | Phase 3 | 中 |
| A-016 | 教学数据总览 | 未启动 | `add-metrics-and-dashboard-platform` | Phase 2 | 中 |
| A-017 | 教学数据导出 | 未启动 | `add-bulk-import-export-framework` | Phase 1 | 中 |
| A-018 | 教师统一工作台 | 部分（work_items 内核；缺聚合 UI） | `add-review-and-approval-platform` + `add-education-reference-blueprint` | Phase 0/3 | 中 |
| A-019 | 智能体调用权限 | 部分（RBAC/数据范围；工具目录裁剪未完成） | `refactor-ai-native-business-app-platform` + `add-education-reference-blueprint` | Phase 3 | 高 |
| A-020 | 班级与学生管理 | 未启动 | `add-education-reference-blueprint` + `add-bulk-import-export-framework` | Phase 1/3 | 中 |
| A-021 | 公告通知 | 部分（内核 + Portal 管理 UI；定时/scope 受众待做） | `add-notification-center-and-announcements` | Phase 0 | 低 |
| A-022 | 课程克隆 | 未启动 | `add-record-lifecycle-and-tree-operations` | Phase 1 | 中 |
| A-023 | 教师操作审计 | 部分（审计内核；缺事件覆盖） | `add-audit-compliance-and-tamper-evidence` | Phase 0 | 低 |
| A-024 | 教师消息中心 | 部分（Portal 分类/批量/偏好 UI 已通；待办聚合待做） | `add-notification-center-and-announcements` | Phase 0 | 低 |
| A-025 | 正式内容开放调用 | 未启动 | `add-external-integration-connector` | Phase 3 | 高 |
| A-026 | 业务数据汇聚 | 未启动 | `add-metrics-and-dashboard-platform` | Phase 2 | 高 |
| A-027 | 数据接口与外部联调 | 未启动 | `add-external-integration-connector` | Phase 3 | 高 |
| A-028 | 指标体系 | 未启动 | `add-metrics-and-dashboard-platform` | Phase 2 | 中 |
| A-029 | 多层级数据看板 | 未启动 | `add-metrics-and-dashboard-platform` | Phase 2 | 高 |
| A-030 | 可视化组件 | 已完成（`ui-kit/chart` 可复用） | 复用 | — | 低 |
| A-031 | 看板性能 | 未启动 | `add-metrics-and-dashboard-platform` | Phase 2 | 高 |
| A-032 | 联动筛选与三级下钻 | 未启动 | `add-metrics-and-dashboard-platform` | Phase 2 | 高 |
| A-033 | 学情分析 | 未启动 | `add-education-reference-blueprint` + `add-metrics-and-dashboard-platform` | Phase 2/3 | 高 |
| A-034 | 学情预警 | 未启动 | `add-metrics-and-dashboard-platform` | Phase 2 | 中 |
| A-035 | 多格式数据导出 | 未启动 | `add-bulk-import-export-framework` | Phase 1 | 中 |
| A-036 | 专题数据页面 | 未启动 | `add-metrics-and-dashboard-platform` + `add-education-reference-blueprint` | Phase 2/3 | 中 |
| A-037 | 统一身份治理 | 部分（身份内核） | `add-identity-federation-and-session-governance` | Phase 0 | 中 |
| A-038 | 单点登录 | 部分（CAS/OIDC 入口/回调/JWT 已通；真实 provider 联调待做） | `add-identity-federation-and-session-governance` | Phase 0 | 中 |
| A-039 | 账号生命周期与越权防护 | 部分（同步/回收；缺权限版本/定时） | `add-identity-federation-and-session-governance` | Phase 0 | 中 |
| A-040 | 多角色账号管理 | 部分（组织多角色内核） | `add-identity-federation-and-session-governance` | Phase 0 | 中 |
| A-041 | RBAC 角色管理 | 已完成 | 复用 | — | 低 |
| A-042 | 四维权限控制 | 部分（菜单/功能/数据；资源权限待接资产字段） | 复用 RBAC + `add-generic-data-scope-authorization` | Phase 0 | 中 |
| A-043 | 组织数据隔离 | 已完成 | 复用 `add-generic-data-scope-authorization` | — | 低 |
| A-044 | 账号状态与异常登录 | 部分（会话/锁定；缺告警/批量/异常查询） | `add-identity-federation-and-session-governance` | Phase 0 | 中 |
| A-045 | 全场景操作审计 | 部分（链写入；缺事件目录） | `add-audit-compliance-and-tamper-evidence` | Phase 0 | 中 |
| A-046 | 审计查询与导出 | 部分（查询；缺多格式导出/UI） | `add-audit-compliance-and-tamper-evidence` | Phase 0 | 低 |
| A-047 | 现有系统身份复用 | 部分（服务令牌；缺数据范围重解析/限流） | `add-identity-federation-and-session-governance` | Phase 0 | 中 |
| A-048 | 业务数据同步适配 | 未启动 | `add-external-integration-connector` | Phase 3 | 高 |
| A-049 | 内网数据库连接 | 未启动 | `add-external-integration-connector` | Phase 3 | 高 |
| A-050 | 数据库接入安全 | 未启动 | `add-external-integration-connector` | Phase 3 | 高 |

## B. 智能体应用

| ID | 功能 | 现状 | 目标 change | 阶段 | 难度 |
|---|---|---|---|---|---|
| B-001 | 智能体矩阵 | 部分（会话/工具；持久 Agent Runtime 未完成） | `refactor-ai-native-business-app-platform` + `add-education-reference-blueprint` | Phase 3 | 高 |
| B-002 | 知识点提取与构建 | 未启动 | `add-document-intelligence` | Phase 2 | 高 |
| B-003 | 智能出题 | 未启动 | `add-education-reference-blueprint` | Phase 3 | 中 |
| B-004 | 脚本与分镜生成 | 未启动（资产任务内核可复用） | `add-asset-and-media-pipeline` + `add-education-reference-blueprint` | Phase 1/3 | 高 |
| B-005 | 教学改进建议 | 未启动 | `add-education-reference-blueprint` | Phase 3 | 中 |
| B-006 | 任务编排与回调 | 部分（job 内核；Agent 长任务/消费方未接） | `add-async-job-and-callback-facade` | Phase 0 | 中 |
| B-007 | 知识源上传 | 部分（上传会话；缺 5GB/1GB/并发校验） | `add-asset-and-media-pipeline` | Phase 1 | 中 |
| B-008 | 内容解析 | 未启动 | `add-document-intelligence` | Phase 2 | 高 |
| B-009 | 知识结构编辑确认 | 未启动 | `add-document-intelligence` | Phase 2 | 高 |
| B-010 | 分镜模板 | 未启动 | `add-education-reference-blueprint` | Phase 3 | 中 |
| B-011 | 视频合成 | 未启动 | `add-asset-and-media-pipeline` | Phase 3 | 高 |
| B-012 | 旁白生成 | 未启动 | `add-asset-and-media-pipeline` | Phase 3 | 高 |
| B-013 | 预览编辑与导出 | 部分（资产内核；缺播放器/导出） | `add-asset-and-media-pipeline` | Phase 0/3 | 高 |
| B-014 | 调用统计 | 未启动 | `add-metrics-and-dashboard-platform` | Phase 2 | 中 |
| B-015 | 安全检测与多级复核 | 部分（review.check 已通；缺 AI 治理/多级 UI） | `add-review-and-approval-platform` + `add-ai-content-governance` | Phase 0/2 | 高 |
| B-016 | 现有系统流程编排 | 未启动 | `add-external-integration-connector` + `add-async-job-and-callback-facade` | Phase 3 | 高 |
| B-017 | 移动端适配 | 未启动 | `add-education-reference-blueprint` | Phase 4 | 高 |
| B-018 | 在线视频学习 | 未启动 | `add-asset-and-media-pipeline` + `add-education-reference-blueprint` | Phase 4 | 中 |
| B-019 | 学习记录与日历 | 未启动 | `add-education-reference-blueprint` | Phase 3/4 | 中 |
| B-020 | 个人学习中心 | 未启动 | `add-education-reference-blueprint` | Phase 4 | 中 |
| B-021 | 知识点掌握度 | 未启动 | `add-education-reference-blueprint` | Phase 4 | 中 |
| B-022 | 学生消息中心 | 部分（Portal UI/偏好/角标已通；30 天清理待做） | `add-notification-center-and-announcements` | Phase 0 | 低 |
| B-023 | 在线测评 | 未启动 | `add-education-reference-blueprint` | Phase 4 | 高 |
| B-024 | 自动判分与解析 | 未启动 | `add-education-reference-blueprint` | Phase 4 | 高 |
| B-025 | 错题本与学习反馈 | 未启动 | `add-education-reference-blueprint` | Phase 4 | 中 |
| B-026 | 个性化推荐 | 未启动 | `add-education-reference-blueprint` | Phase 4 | 高 |
| B-027 | 推荐反馈 | 未启动 | `add-education-reference-blueprint` | Phase 4 | 中 |
| B-028 | 学习成就徽章 | 未启动 | `add-education-reference-blueprint` | Phase 4 | 中 |
| B-029 | 课程评价 | 未启动 | `add-education-reference-blueprint` | Phase 4 | 低 |
| B-030 | 离线下载 | 未启动 | `add-offline-content-package` | Phase 4 | 高 |
| B-031 | 播放偏好 | 未启动 | `add-education-reference-blueprint` | Phase 4 | 低 |
| B-032 | 用户数据隔离 | 部分（RLS/数据范围；教育实体用户级过滤待建） | `add-education-reference-blueprint` | Phase 3 | 中 |
| B-033 | 生成内容标识 | 未启动 | `add-ai-content-governance` | Phase 2 | 高 |
| B-034 | 机器初审与教师终审 | 部分（机器步骤回写已通；申诉/终审 UI 待做） | `add-review-and-approval-platform` + `add-ai-content-governance` | Phase 0/2 | 高 |
| B-035 | AI 评分规则确认 | 未启动 | `add-ai-content-governance` | Phase 2 | 高 |

