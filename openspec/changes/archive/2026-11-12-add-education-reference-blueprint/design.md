# Design: 教育参考蓝图（Education Reference Blueprint）

## Context

- sapbase 的产品路径是“签名 Blueprint + 租户内应用安装 + 共享 Runtime”；
- 平台通用能力由 9 个 P0 + 5 个 P1 changes 提供；
- 教育项目是垂直应用，不应把 school/class/course 等词写进平台核心；
- 参考蓝图应可作为可复用资产交付给多个教育客户，客户只做配置/品牌/集成。

## Goals / Non-Goals

**Goals**

1. 一个可编译、可安装、可运行的教育参考蓝图包。
2. 覆盖课程内容、班级学生、教学任务、学习记录、测评、推荐、徽章、评价。
3. 教师/学生/教学管理三类页面与权限。
4. 数据范围：校区/年级/班级 + 课程/任务关联；教师只看授课范围、学生只看自己。
5. Agent 定义：内容生产、知识点提取、出题、脚本/分镜、答疑、教学建议。
6. 核心指标/看板/预警、导入模板、AI 内容治理配置。
7. 明确客户定制边界：蓝图可配置，不 fork 平台代码。

**Non-Goals**

- 不在平台核心新增教育表/服务。
- 不实现客户 SSO/教务连接器/媒体 provider（走平台连接器/配置）。
- 不一次性实现全部页面/复杂交互；参考包定义核心与验收，客户定制另立。
- 不做跨租户/多学校数据汇聚（一个安装一个租户边界）。

## Decisions

### D1：包布局

```text
blueprints/education/
  blueprint.json          # 作者/版本/分层/许可
  semantic.json           # 实体/字段/关系/状态/校验
  flows.json              # 课程/任务/测评/复核流程
  rules.json              # 校验/审批/记账（如需）
  experience.json         # 交互优先级/确认/自动化
  ui.json                 # 页面/菜单
  permissions.json        # 角色 → 资源 → scope/actions + dataScope
  fixtures/               # 参考数据/样例
  agents/                 # Agent 定义/提示词/工具清单（按平台协议）
  imports/                # 知识点/学生/班级模板
  metrics/                # 指标/看板/预警配置
```

- 包通过现有 `packBlueprint` / `compileBlueprint` / 签名/装载链。
- 所有扩展必须是 v1 协议已覆盖的文件；未覆盖文件拒绝（不跳过）。
- 客户配置（品牌/名称/阈值）走 Config 层，不修改 Protected/Kernel。

### D2：核心实体

| 实体 | 关键字段 | 关系 |
|---|---|---|
| `Course` | title, intro, cover(asset), major, tags, status, version | 1:N Chapter, Material |
| `Chapter` | courseId, parentId, title, sortOrder | 自引用树；1:N KnowledgePoint |
| `KnowledgePoint` | chapterId, title, summary, difficulty, tags, sortOrder | N:1 Chapter |
| `Material` | courseId, knowledgePointId?, assetId, kind, tags | N:1 Course/KnowledgePoint |
| `EducationClass` | name, campusNodeId?, gradeNodeId?, major, studentCount | 1:N Student；N:M Teacher |
| `Student` | name, studentNo, classId, status | N:1 Class |
| `TeachingAssignment` | courseId, teacherId, classId? | 课程-教师-班级关联 |
| `CourseEnrollment` | courseId, studentId, classId?, status | 学生选课/课程可见 |
| `TeachingTask` | title, type, courseId, startAt, endAt, status | 1:N TaskClass |
| `TaskClass` | taskId, classId | 关联（避免数组字段） |
| `LearningRecord` | studentId, courseId, knowledgePointId, duration, progress, completedAt | 事件/汇总 |
| `Question` | knowledgePointId, type, difficulty, stem, options, answer, explanation | 1:N AssessmentQuestion |
| `Assessment` | courseId, title, startAt, endAt, status, totalScore | 1:N AssessmentQuestion/Attempt |
| `AssessmentClass` | assessmentId, classId | 测评-班级关联 |
| `AssessmentQuestion` | assessmentId, questionId, score, order | 关联 |
| `Attempt` | assessmentId, studentId, answers, aiScore, humanScore, status | N:1 Assessment/Student |
| `WrongAnswer` | studentId, questionId, attempts, lastWrongAt, mastered | 汇总 |
| `Recommendation` | studentId, resourceKey/Id, reason, score, source | 推荐 |
| `Badge` / `StudentBadge` | key/name/criteria；studentId/badgeId/awardedAt | 徽章 |
| `CourseReview` | courseId, studentId, contentScore, videoScore, clarityScore, comment | 评价 |
| `Announcement` | 平台通知中心/公告；蓝图只引用 | 平台能力 |

- 头行/树：Chapter 用 `tree`（parentField/sortOrder）；Assessment 用 children 头行或关联实体。
- 不把数组字段用于数据范围；多班级/多教师用关联实体（TaskClass/TeachingAssignment）。
- 学习记录/测评尝试写入量大，按时间分区/归档（平台/DB 能力，蓝图声明保留策略）。

### D3：状态与流程

**课程**：`draft → submitted → published → unpublished → archived`
（归档用记录生命周期；下架保留学习数据）。

**教学任务**：`draft → published → in_progress → completed → cancelled`。

**测评**：`draft → published → in_progress → closed → graded`。

**内容复核**：`draft → machine_check → human_review → final_review → published`
（复用复核平台；AI 内容治理标识/终审）。

**AI 评分**：`ai_only → teacher_confirmed → appealed → final`（复用 AI 治理）。

- 状态迁移必须走 semantic-runtime，不能直接改 DB。
- 发布/下架/归档触发通知/索引/指标事件。

### D4：数据范围

维度：

- `campus`（校区，可选多级）
- `grade`（年级）
- `class`（班级）
- `course`（课程；可作为 scope 节点或关系绑定）

绑定：

| 资源 | 绑定 |
|---|---|
| `Student` | `classId → class`（field） |
| `EducationClass` | `gradeNodeId → grade` / `campusNodeId → campus`（field） |
| `TeachingTask` | 通过 `TaskClass(classId)` 关联到 `class`（relation） |
| `Assessment` | 通过 `AssessmentClass(classId)` 或 `courseId` 关联 |
| `Course` | 教师通过 `TeachingAssignment(courseId, teacherId)`（relation）；学生通过选课/班级关联 |
| `LearningRecord` | `studentId → self`（owner）+ 教师通过班级关系 |
| `Material` | 通过 `courseId` 关联课程；课程可见则素材可见 |
| `Question` | 通过 `knowledgePointId → course` 关联 |
| `CourseReview` | `studentId → self`；课程评价对教师/管理员按课程范围 |

- 教师：`course`/`class` 成员关系 + 授课关联；学生：`self` + 班级；管理员：校区/年级子树。
- 所有列表/详情/导出/看板/Agent 工具必须走同一范围。
- 空绑定 fail-closed；上线前预检班级/课程节点。

### D5：角色与权限

角色（租户可复制/调整）：

- `education_admin`：校区/全校管理、课程建设统计、预警、配置。
- `department_admin`：院系/专业范围。
- `teacher`：课程建设、素材、任务、测评、学情、Agent。
- `student`：学习、测评、错题、推荐、徽章、评价。
- `reviewer`：内容/测评复核。

权限点（示例）：

- `education:course:read/create/update/delete/publish`
- `education:chapter:*` / `education:knowledge:*` / `education:material:*`
- `education:class:*` / `education:student:*`
- `education:task:*` / `education:assessment:*`
- `education:analytics:read/export`
- `education:review:act`
- `education:agent:use`（按 agent 再细分）

- 菜单/按钮/字段权限由 `permissions.json` + UI Runtime 执行；服务端仍强制。
- 数据范围与功能权限取交集；数据范围只收窄，不授权。

### D6：页面/菜单

**教师工作台**：待办（复核/任务/公告）、常用 Agent、课程列表、快捷操作、学情卡片。

**课程建设**：课程基础信息/封面上传、章节/知识点树、素材库、内容生成、草稿/版本、
提交审核/发布/下架/归档/克隆。

**教学运营**：班级/学生、教学任务发布、公告、消息中心、测评管理、学情分析/预警。

**学生端**：课程中心、课程详情/章节/知识点、视频学习/进度、测评/错题本、
学习中心/画像、推荐、徽章、课程评价、消息中心、离线下载。

**管理端**：课程建设统计、教学运行、学情预警、专题看板（校区/院系/专业/课程下钻）。

- 页面用 `ui.json` 声明；复杂交互用 Runtime 组件；不生成静态路由。
- 关键页面验收：教师工作台、课程编辑、学生课程详情/测评、管理看板。

### D7：Agent 定义

| Agent | 能力 | 工具/依赖 |
|---|---|---|
| `edu-outline` | 课程大纲生成 | 知识库、课程实体、ModelGateway |
| `edu-knowledge-extract` | 文档→知识点候选 | 文档智能、资产、人工确认 |
| `edu-question-gen` | 按知识点/难度出题 | 题库、知识库、评测 |
| `edu-script-storyboard` | 脚本/分镜/旁白 | 资产、异步任务、媒体 provider |
| `edu-tutoring` | 学习答疑 | 知识库、课程范围、只读工具 |
| `edu-teaching-advice` | 学情→教学建议 | 指标/学情、只读工具 |
| `edu-review` | 机器初审（内容安全/规则） | AI 治理、复核平台 |

- Agent 只能经 `contracts/tools.json` 工具面；写操作确认令牌。
- 教育 Agent 的工具按角色/课程范围收窄；不得跨租户/跨课程。
- 提示词/模型/版本随蓝图或租户配置发布；知识只取已发布版本。

### D8：指标/看板/预警

核心指标（首期 ≥7）：

1. 学生总数
2. 活跃学生数
3. 平均学习时长
4. 任务平均完成率
5. 测评平均成绩
6. 待处理预警数
7. 课程建设数/资源生产数
8. 智能体使用次数/成功率（可选）

看板：

- 学校/校区总览：用户/活跃/课程/资源/学习/测评/Agent。
- 院系/专业：课程建设、任务完成、成绩、预警。
- 课程/班级：学习进度、知识点掌握、任务完成、测评分析。
- 教师工作台：班级对比、待办、预警。
- 学生个人：学习画像/成长曲线（学生端）。

预警：

- 低活跃、进度滞后、成绩下降、任务未完成；30 分钟窗口可配；通知教师/管理员。

- 指标定义/看板/预警作为蓝图配置或租户配置；数据范围全程生效。

### D9：导入/导出

- 知识点 xlsx 模板（≥100/次、部分成功、行号/原因）。
- 学生 xlsx 模板（≥500/次、班级/学号校验）。
- 班级/课程/任务导入（可选）。
- 教学数据导出：成绩/进度/任务/访问/测评分析；Excel/CSV/PDF/MD；异步。
- 导入/导出走平台框架；蓝图只定义字段/模板/映射。

### D10：AI 内容治理

- 生成内容带 provenance/labels；发布前机器检测 + 人工终审。
- 视频/音频/图片标识/水印；导出/离线保留。
- AI 评分参考分 vs 教师评分；规则确认/申诉。
- 与复核/资产/审计/通知平台集成，不另建流程。

### D11：兼容与客户定制

- 客户只改 Config 层：品牌/文案/阈值/角色/菜单/字段可见性/集成配置。
- 不 fork 平台代码；客户特有实体/页面走蓝图扩展/新包。
- 蓝图版本升级保留数据；字段新增用默认值/迁移路径。
- 回滚：安装前一版本；数据兼容由 Blueprint 升级规则保证。

## Package Manifest

- `blueprint.json`：key `education`、name、version、分层、license、依赖平台版本。
- `semantic.json`：实体/字段/关系/状态/校验/tree/dataScope。
- `flows.json`：课程/任务/测评/复核流程。
- `rules.json`：校验/审批/记账（如学费/结算不在本期，可空）。
- `experience.json`：生成/确认/自动化策略。
- `ui.json`：页面/菜单/组件映射。
- `permissions.json`：角色/资源/scope/actions/dataScope。
- `metrics/`、`imports/`、`agents/`、`fixtures/`。

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| 蓝图范围过大 | 分阶段：核心课程/学习/测评先行；推荐/徽章/评价后置 |
| 与平台能力版本耦合 | 声明依赖版本；平台 change 先落地；兼容测试 |
| 测评/学习记录量大 | 分区/归档/异步聚合；不在蓝图存大文件 |
| 数据范围空绑定 | 上线前预检班级/课程节点；fail-closed |
| 客户定制膨胀 | Config 层 + 扩展包；不 fork 平台 |
| Agent 越权 | 工具面 + 角色/课程范围 + 审计 |
| AI 内容合规 | 标识/终审/AI 评分治理；不可关闭的合规项按客户策略 |

## Migration Plan

1. 先落平台 P0/P1（数据范围/资产/任务/导入/通知/审计/指标/复核/AI 治理）。
2. 创建蓝图骨架 + 课程/章节/知识点/素材 + 班级/学生。
3. 接教学任务/学习记录/测评/错题。
4. 接看板/预警/导入导出。
5. 接推荐/徽章/评价/离线。
6. 客户配置/联调/验收。

## Open Questions

- 课程是否作为 scope 节点，还是用 TeachingAssignment 关系？建议关系优先，课程节点仅在大规模课程权限时启用。
- 学习记录是否作为事件流 + 汇总表？建议事件 + 日汇总，避免全量扫描。
- 推荐 v1 用规则还是语义？建议规则 + 标签，向量后置。
- 测评 1000 并发是否需要独立服务/队列？按压测结果决定。
