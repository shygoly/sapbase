## ADDED Requirements

### Requirement: Education Blueprint Package and Installation

教育能力 MUST 以签名 Blueprint 包交付，MUST NOT 在平台核心新增教育专用表。
包 MUST 包含语义、流程、规则、经验、页面、权限、指标/导入/Agent 配置，
并 MUST 能通过现有打包/编译/签名/装载链安装到租户。
客户定制 MUST 只改 Config 层，MUST NOT fork 平台代码。

#### Scenario: 安装参考蓝图

- **WHEN** 租户安装 education 蓝图包
- **THEN** 包 SHALL 通过编译/签名/装载
- **AND** 课程/班级/测评等实体与页面 SHALL 可用

#### Scenario: 非法包

- **WHEN** 包引用不存在的实体/字段/角色
- **THEN** 编译/装载 SHALL 失败
- **AND** MUST NOT 部分安装

### Requirement: Course and Knowledge Structure

蓝图 SHALL 定义课程、章节、知识点、素材及关系；章节 MUST 支持树（parent/order），
知识点 MUST 归属章节，素材 MUST 引用资产；课程 MUST 支持草稿/审核/发布/下架/归档/克隆/版本。

#### Scenario: 课程树

- **WHEN** 教师创建课程、三级章节与知识点
- **THEN** 树结构/排序/归属 SHALL 正确
- **AND** 知识点可关联素材/题目

#### Scenario: 课程克隆

- **WHEN** 教师克隆课程
- **THEN** 章节/知识点/素材引用 SHALL 复制
- **AND** 新课程与原课程数据隔离

### Requirement: Class and Student Management

蓝图 SHALL 定义班级与学生，支持班级-教师/课程关联、学生导入与班级归属；
数据 MUST 按班级/校区/年级隔离。批量导入 MUST 支持部分成功与行级错误。

#### Scenario: 批量导入学生

- **WHEN** 教师导入 500 名学生
- **THEN** 成功行 SHALL 落库
- **AND** 失败行 SHALL 返回行号/原因

#### Scenario: 班级隔离

- **WHEN** 教师只被授权到某班级
- **THEN** 只能看到该班学生/任务/学情

### Requirement: Teaching Tasks and Learning Records

蓝图 SHALL 定义教学任务（类型/班级/课程/起止/状态）与学习记录（学生/课程/知识点/时长/进度）。
任务发布/完成 MUST 产生通知与统计；学习记录 MUST 支持进度/时长/完成状态与汇总。

#### Scenario: 发布教学任务

- **WHEN** 教师向多个班级发布任务
- **THEN** 目标任务 SHALL 对班级学生可见
- **AND** 通知/截止时间 SHALL 生效

#### Scenario: 学习进度

- **WHEN** 学生观看视频/完成知识点
- **THEN** 学习时长/进度 SHALL 记录
- **AND** 可按课程/班级汇总

### Requirement: Assessment and Wrong Answers

蓝图 SHALL 定义题库、测评、作答、判分、错题本；MUST 支持单选/多选/判断，
MUST 记录 AI 参考分/教师分状态，MUST 支持错题重做与掌握度。

#### Scenario: 在线测评

- **WHEN** 学生提交 20 道客观题
- **THEN** 系统 SHALL 判分/解析/记录作答
- **AND** 错题 SHALL 进入错题本

#### Scenario: AI 分数

- **WHEN** 测评产生 AI 评分
- **THEN** 学生端 SHALL 显示 AI 参考分
- **AND** 未教师确认 MUST NOT 作为正式成绩

### Requirement: Recommendation, Badges, and Course Evaluation

蓝图 SHALL 定义推荐、徽章、课程评价；推荐 MUST 带理由并可按学生学习数据更新；
徽章 MUST 按规则发放；评价 MUST 支持内容/视频/讲解三维评分。

#### Scenario: 推荐课程

- **WHEN** 学生完成部分课程/测评
- **THEN** 系统 SHALL 推荐相关课程/知识点
- **AND** 推荐 SHALL 显示理由

#### Scenario: 徽章发放

- **WHEN** 学生满足徽章条件
- **THEN** 徽章 SHALL 自动发放
- **AND** 徽章墙 SHALL 展示已获得/未获得条件

### Requirement: Teacher, Student, and Admin Surfaces

蓝图 SHALL 提供教师工作台、课程建设/教学运营、学生课程学习/测评/学习中心、
管理看板；页面 MUST 由 `ui.json` 声明并复用 UI Runtime，MUST NOT 生成静态路由。
关键页面 MUST 通过可用性验收。

#### Scenario: 教师工作台

- **WHEN** 教师登录
- **THEN** 工作台 SHALL 展示待办/课程/Agent/快捷操作
- **AND** 无权限项 MUST NOT 显示

#### Scenario: 学生课程详情

- **WHEN** 学生打开课程
- **THEN** 章节/知识点/视频/进度 SHALL 可浏览
- **AND** 无权限内容 MUST NOT 出现

### Requirement: Permissions and Data Scope

蓝图 MUST 声明角色、权限点与 `dataScope` 绑定；教师只看授课课程/班级，
学生只看自己，管理员按校区/院系/专业范围。数据范围 MUST 在列表/详情/写/导出/看板/Agent 生效。

#### Scenario: 教师跨班访问

- **WHEN** 教师尝试访问未授课班级学生
- **THEN** 请求 SHALL 被拒绝或返回空
- **AND** MUST NOT 返回该班数据

#### Scenario: 学生越权

- **WHEN** 学生尝试查看他人学习记录/测评
- **THEN** 请求 SHALL 被拒绝
- **AND** 只返回本人数据

### Requirement: Agent Definitions and AI Content Governance

蓝图 SHALL 定义内容生产、知识点提取、出题、脚本/分镜、答疑、教学建议等 Agent，
MUST 只经平台工具面调用，写操作 MUST 确认；生成内容 MUST 带标识/终审，
AI 评分 MUST 区分参考分/教师分。

#### Scenario: 生成课程大纲

- **WHEN** 教师调用大纲 Agent
- **THEN** 结果 SHALL 作为草稿返回
- **AND** MUST NOT 直接发布

#### Scenario: 生成内容标识

- **WHEN** Agent 生成教案/视频
- **THEN** 内容 SHALL 带来源/标识
- **AND** 发布前 MUST 经机器检测/人工终审

### Requirement: Metrics, Dashboards, and Alerts

蓝图 SHALL 定义 ≥7 个核心指标、学校/校区/院系/课程看板、三级下钻与学情预警；
查询/下钻/导出 MUST 应用数据范围；预警 MUST 通过通知中心发送。

#### Scenario: 校区看板

- **WHEN** 校区管理员查看看板
- **THEN** 只显示其校区/下属范围
- **AND** 可下钻到课程/班级

#### Scenario: 学情预警

- **WHEN** 学生低活跃/进度滞后达到规则
- **THEN** 系统 SHALL 产生预警并通知教师/管理员
- **AND** 冷却期内不重复

### Requirement: Import and Export Templates

蓝图 SHALL 提供知识点/学生/班级导入模板与教学数据导出配置；
导入 MUST 支持部分成功/行级错误，导出 MUST 支持多格式/异步/权限与范围。

#### Scenario: 知识点导入

- **WHEN** 教师导入 100 个知识点
- **THEN** 成功/失败行 SHALL 分开返回
- **AND** 失败 SHALL 带行号/原因

#### Scenario: 教学数据导出

- **WHEN** 教师导出班级成绩/进度
- **THEN** 结果 SHALL 只含其班级
- **AND** 大导出 SHALL 异步完成

### Requirement: Acceptance and Compatibility

参考蓝图 MUST 能编译/签名/安装/升级/回滚；MUST NOT 改变平台核心与现有应用行为。
数据升级 MUST 保留旧数据；客户定制 MUST 通过 Config/扩展包完成。

#### Scenario: 升级蓝图

- **WHEN** 安装新版本蓝图
- **THEN** 旧数据 SHALL 可读
- **AND** 新增字段 MUST 有默认值/迁移路径

#### Scenario: 回滚

- **WHEN** 回滚到上一版本
- **THEN** 平台/其他应用 MUST NOT 受影响
- **AND** 数据兼容问题 SHALL 明确报错
