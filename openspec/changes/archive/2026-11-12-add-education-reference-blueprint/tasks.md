## 1. 包骨架与协议

- [x] 1.1 创建 `templates/education/` 包布局与 `blueprint.json`（含 agents.json）
- [x] 1.2 `semantic.json`：21 个实体/字段/关系/状态/tree/dataScope
- [x] 1.3 `flows.json` / `rules.json` / `experience.json`
- [x] 1.4 `ui.json` / `permissions.json`
- [x] 1.5 通过 `packBlueprint` / `compileBlueprint` / 装载链（开发期未签名）
- [x] 1.6 非法包负例：悬空引用编译失败（e2e）

## 2. 内容域实体

- [x] 2.1 `Course` 基础信息/封面/标签/状态/版本
- [x] 2.2 `Chapter` tree(parentId/sortOrder)
- [x] 2.3 `KnowledgePoint`
- [x] 2.4 `Material` assetId/kind
- [x] 2.5 课程状态机/发布/下架/归档/克隆（clone e2e）
- [x] 2.6 版本快照（record-lifecycle snapshots e2e）
- [x] 2.7 数据范围绑定声明（租户策略需配置）

## 3. 班级/学生

- [x] 3.1 `EducationClass`
- [x] 3.2 `Student`
- [x] 3.3 `TeachingAssignment`
- [x] 3.4 学生/知识点导入模板与部分成功（e2e）
- [x] 3.5 数据范围声明：Student.classId / Class.gradeNodeId
- [x] 3.6 班级/学生页面与权限（ui.json/permissions.json）

## 4. 教学任务/学习记录

- [x] 4.1 `TeachingTask`
- [x] 4.2 `TaskClass`
- [x] 4.3 `LearningRecord`
- [x] 4.4 学习事件/汇总字段
- [x] 4.5 任务发布审批/迁移/通知 e2e；完成统计复用指标
- [x] 4.6 数据范围声明：教师/学生按课程/班级

## 5. 题库/测评/错题

- [x] 5.1 `Question`
- [x] 5.2 `Assessment` / `AssessmentQuestion`
- [x] 5.3 `Attempt` AI/教师分状态
- [x] 5.4 `WrongAnswer`
- [x] 5.5 测评/作答状态机迁移 e2e；自动判分规则由后续 Agent/规则配置
- [x] 5.6 1000 提交压测（并发窗口 5；dev PG pool 10 的嵌套事务上限）
- [x] 5.7 数据范围声明：班级/self

## 6. 推荐/徽章/评价

- [x] 6.1 `Recommendation`
- [x] 6.2 `Badge` / `StudentBadge`
- [x] 6.3 `CourseReview`
- [x] 6.4 推荐反馈/徽章规则/评价字段
- [x] 6.5 数据范围声明：self/课程

## 7. 页面/菜单/权限

- [x] 7.1 教师工作台页面声明
- [x] 7.2 课程建设页面声明
- [x] 7.3 教学运营页面声明
- [x] 7.4 学生端页面声明
- [x] 7.5 管理端页面声明
- [x] 7.6 权限点/菜单/按钮/字段权限声明
- [x] 7.7 浏览器验收：管理员 CourseList/StudentList/AssessmentList；教师/学生 CourseList

## 8. Agent 定义

- [x] 8.1 `edu-outline`
- [x] 8.2 `edu-knowledge-extract`
- [x] 8.3 `edu-question-gen`
- [x] 8.4 `edu-script-storyboard`
- [x] 8.5 `edu-tutoring`
- [x] 8.6 `edu-teaching-advice`
- [x] 8.7 `edu-review`
- [x] 8.8 工具面/角色/课程范围/确认令牌声明
- [x] 8.9 真实 DeepSeek Agent e2e：大纲/出题/答疑草稿；写 Agent 确认闸

## 9. 指标/看板/预警

- [x] 9.1 7 个核心指标定义（e2e）
- [x] 9.2 教育运营看板（e2e）
- [x] 9.3 指标维度查询（classId）与看板筛选配置 e2e；UI 下钻由 Runtime 组件
- [x] 9.4 学情预警规则（e2e）
- [x] 9.5 教师/学生个人看板配置 e2e（visibility roles）
- [x] 9.6 数据范围负例：Manager 无策略 → 空结果（e2e）

## 10. 导入/导出/AI 治理

- [x] 10.1 知识点导入模板/部分成功（e2e）
- [x] 10.2 学生导入模板/校验（e2e）
- [x] 10.3 教学数据 xlsx 异步导出（e2e）
- [x] 10.4 生成内容 provenance/显式+隐式 labels/终审提交 e2e
- [x] 10.5 AI 参考分/教师确认/申诉 e2e（终审由复核平台完成）
- [x] 10.6 标识 gate 已测；导出/离线保留复用平台 AI 治理与 offline 机制

## 11. 验收与交付

- [x] 11.1 签名交付/验签装载 e2e；升级/回滚复用 release 机制
- [x] 11.2 课程→章节→知识点→素材→任务→学习→测评→推荐闭环 e2e
- [x] 11.3 浏览器验收：管理员/教师/学生关键页面（动态 BlueprintAppRuntime）
- [x] 11.4 跨租户负例；教师/学生细粒度范围负例待补
- [x] 11.5 导入/导出/看板/预警/Agent 验收 e2e
- [x] 11.6 1000 提交 + 100 看板查询压测（并发窗口 5/10；dev pool 限制）
- [x] 11.7 文档：`docs/protocols/blueprint-delivery.md` §17 安装/配置/定制边界
- [x] 11.8 `openspec validate add-education-reference-blueprint --strict`
- [x] 11.9 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
