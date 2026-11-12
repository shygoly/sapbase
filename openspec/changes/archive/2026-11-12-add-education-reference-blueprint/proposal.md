# Change: 教育参考蓝图（Education Reference Blueprint）

## Why

教育项目的课程/知识点、班级/学生、教学任务、学习记录、测评、推荐、徽章、评价、
教师/学生工作台都是**垂直业务能力**。如果写进平台核心：

- 平台会被教育语义写死，后续行业要再改一次；
- 与 sapbase 的 Blueprint / 业务应用安装模型冲突；
- 无法作为可复用参考资产交付给其他教育客户。

本变更把教育项目做成一个**签名的 Blueprint 参考应用**：复用平台通用能力
（数据范围、资产、异步任务、通知、审计、指标、复核、AI 治理），只定义教育实体、
状态、页面、权限、Agent 与配置，不改平台核心。

## What Changes

- **ADDED** `education-blueprint`：教育参考蓝图包
  - 课程/章节/知识点/素材、班级/学生、教学任务、学习记录、题库/测评/错题、
    推荐/徽章/课程评价等实体与关系。
  - 课程生命周期、任务/测评/复核状态机与规则。
  - 教师/学生/教学管理页面、菜单、权限点。
  - `dataScope` 维度/绑定：校区/年级/班级 + 课程/任务关联。
  - 内容生产/答疑/出题/脚本/教学建议等 Agent 定义（复用平台 Agent Runtime）。
  - 知识点/学生/班级导入模板；核心指标/看板/预警配置。
  - AI 内容标识/终审/AI 评分规则（复用 AI 治理）。
- **ADDED** 参考数据/样例：课程树、班级/学生、测评、学习记录、推荐/徽章。
- **NOT CHANGED** 平台核心表/服务；不新增教育专用平台表。
- **NON-GOALS** 客户品牌/文案定制、客户 SSO/教务连接器实现（走平台配置/连接器）、
  90 天项目全部页面的一次性实现（本 change 定义参考包与验收，不含客户定制）。
- **BREAKING** 无。新蓝图包按应用安装；不影响现有应用。

## Impact

- 受影响规格：`education-blueprint`（新增）
- 受影响代码/资产：
  - `blueprints/education/**`（或 `templates/education/**`）：
    `blueprint.json`、`semantic.json`、`flows.json`、`rules.json`、`experience.json`、
    `ui.json`、`permissions.json`、fixtures
  - `apps/web-portal` 动态蓝图页/必要静态入口
  - 教育 Agent 定义/提示词/工具清单
  - `openspec/specs/education-blueprint/spec.md`
- 依赖：
  - `add-generic-data-scope-authorization`
  - `add-asset-and-media-pipeline`
  - `add-async-job-and-callback-facade`
  - `add-bulk-import-export-framework`
  - `add-notification-center-and-announcements`
  - `add-review-and-approval-platform`
  - `add-metrics-and-dashboard-platform`
  - `add-ai-content-governance`
  - `add-document-intelligence`
  - 现有 Blueprint 编译/加载、UI Runtime、Agent Runtime、知识/评测、发布
- 迁移：新增蓝图包；不迁移平台数据。
- 风险：实体/页面范围过大、与平台能力版本耦合、客户定制边界、测评/学习记录性能。
