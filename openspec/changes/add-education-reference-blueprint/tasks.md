## 1. 包骨架与协议

- [ ] 1.1 创建 `blueprints/education/` 包布局与 `blueprint.json`
- [ ] 1.2 `semantic.json` 骨架：实体/字段/关系/状态/tree/dataScope
- [ ] 1.3 `flows.json` / `rules.json` / `experience.json` 骨架
- [ ] 1.4 `ui.json` / `permissions.json` 骨架
- [ ] 1.5 通过 `packBlueprint` / `compileBlueprint` / 签名/装载链
- [ ] 1.6 未覆盖文件/非法引用负例

## 2. 内容域实体

- [ ] 2.1 `Course`：基础信息/封面/标签/状态/版本
- [ ] 2.2 `Chapter`：tree(parentId/sortOrder)、课程关系
- [ ] 2.3 `KnowledgePoint`：章节/难度/标签/排序
- [ ] 2.4 `Material`：assetId/kind/tags/课程/知识点
- [ ] 2.5 课程状态机/发布/下架/归档/克隆
- [ ] 2.6 版本快照/历史（复用 record-lifecycle）
- [ ] 2.7 数据范围绑定：课程/班级/素材

## 3. 班级/学生

- [ ] 3.1 `EducationClass`：名称/校区/年级/专业/人数
- [ ] 3.2 `Student`：学号/姓名/班级/状态
- [ ] 3.3 `TeachingAssignment`：课程-教师-班级
- [ ] 3.4 学生/班级导入模板（xlsx，≥500 行，部分成功）
- [ ] 3.5 数据范围：Student.classId、Class 节点
- [ ] 3.6 班级/学生页面与权限

## 4. 教学任务/学习记录

- [ ] 4.1 `TeachingTask`：类型/课程/时间/状态
- [ ] 4.2 `TaskClass` 关联（避免数组）
- [ ] 4.3 `LearningRecord`：学生/课程/知识点/时长/进度
- [ ] 4.4 学习事件/汇总策略
- [ ] 4.5 任务发布/通知/完成统计
- [ ] 4.6 数据范围：教师按班级/课程、学生按 self

## 5. 题库/测评/错题

- [ ] 5.1 `Question`：题型/难度/题干/选项/答案/解析
- [ ] 5.2 `Assessment` / `AssessmentQuestion`
- [ ] 5.3 `Attempt`：答案/AI 分/教师分/状态
- [ ] 5.4 `WrongAnswer`：错误次数/掌握状态
- [ ] 5.5 测评状态机/判分/解析
- [ ] 5.6 并发/性能压测（1000 提交）
- [ ] 5.7 数据范围：班级/self

## 6. 推荐/徽章/评价

- [ ] 6.1 `Recommendation`：规则/标签召回/理由
- [ ] 6.2 `Badge` / `StudentBadge`：条件/发放/展示
- [ ] 6.3 `CourseReview`：三维滑块评分/评论
- [ ] 6.4 推荐反馈/徽章规则/评价统计
- [ ] 6.5 数据范围：self/课程

## 7. 页面/菜单/权限

- [ ] 7.1 教师工作台（待办/Agent/课程/快捷）
- [ ] 7.2 课程建设（基础/章节/知识点/素材/生成/审核/发布）
- [ ] 7.3 教学运营（班级/学生/任务/公告/测评）
- [ ] 7.4 学生端（课程/学习/测评/错题/学习中心/推荐/徽章/评价）
- [ ] 7.5 管理端（课程建设/运行/学情/专题看板）
- [ ] 7.6 权限点/菜单/按钮/字段权限
- [ ] 7.7 关键界面验收

## 8. Agent 定义

- [ ] 8.1 `edu-outline`
- [ ] 8.2 `edu-knowledge-extract`
- [ ] 8.3 `edu-question-gen`
- [ ] 8.4 `edu-script-storyboard`
- [ ] 8.5 `edu-tutoring`
- [ ] 8.6 `edu-teaching-advice`
- [ ] 8.7 `edu-review`（机器初审）
- [ ] 8.8 工具面/角色/课程范围/确认令牌
- [ ] 8.9 Agent e2e：生成/提取/出题/答疑

## 9. 指标/看板/预警

- [ ] 9.1 7+ 核心指标定义
- [ ] 9.2 学校/校区/院系/课程看板
- [ ] 9.3 三级下钻/联动筛选
- [ ] 9.4 学情预警规则（30 分钟窗口）
- [ ] 9.5 教师/学生个人看板
- [ ] 9.6 数据范围负例

## 10. 导入/导出/AI 治理

- [ ] 10.1 知识点导入模板/部分成功
- [ ] 10.2 学生导入模板/校验
- [ ] 10.3 教学数据多格式异步导出
- [ ] 10.4 生成内容 provenance/labels/终审
- [ ] 10.5 AI 评分参考分/教师确认/申诉
- [ ] 10.6 标识在导出/离线保留

## 11. 验收与交付

- [ ] 11.1 包编译/签名/安装/升级/回滚
- [ ] 11.2 课程→章节→知识点→素材→任务→学习→测评→推荐闭环
- [ ] 11.3 教师/学生/管理员关键页面验收
- [ ] 11.4 数据范围/权限/跨租户负例
- [ ] 11.5 导入/导出/看板/预警/Agent 验收
- [ ] 11.6 性能：测评 1000 并发、看板 100 并发
- [ ] 11.7 文档：安装/配置/客户定制边界
- [ ] 11.8 `openspec validate add-education-reference-blueprint --strict`
- [ ] 11.9 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
