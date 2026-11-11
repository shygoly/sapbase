# document-intelligence Specification

## Purpose
TBD - created by archiving change add-document-intelligence. Update Purpose after archive.
## Requirements
### Requirement: Document Ingestion and Parsing

平台 SHALL 支持 PDF、PPTX、DOCX、TXT、MD 文档解析；扫描件 MAY 通过 OCR provider 处理。
解析 MUST 返回页/段落/字符范围等来源锚点；损坏/超限/不支持格式 MUST 拒绝，
MUST NOT 静默返回空结构。

#### Scenario: PPTX 解析

- **WHEN** 上传一份 PPTX 课件
- **THEN** 系统 SHALL 解析页/文本/段落
- **AND** 每个结果 SHALL 带来源页/段落锚点

#### Scenario: 不支持格式

- **WHEN** 上传不支持的文件类型
- **THEN** 解析 SHALL 被拒绝并说明原因
- **AND** MUST NOT 创建可确认草案

### Requirement: Structure Extraction

系统 SHALL 提取章节树、知识点候选、关键概念、关联、难度/标签，
并为每个候选保留来源锚点与置信度。LLM 输出 MUST 通过 schema 校验；
非法输出 MUST 被拒绝，MUST NOT 写入草案。

#### Scenario: 章节与知识点

- **WHEN** 解析一份含三级标题的文档
- **THEN** 系统 SHALL 生成章节树与知识点候选
- **AND** 每个候选 SHALL 可追溯到来源段落

#### Scenario: 非法模型输出

- **WHEN** 提取器返回不符合 schema 的结构
- **THEN** 该次提取 SHALL 失败
- **AND** 不得产生部分可确认候选

### Requirement: Candidate Editing

人工 SHALL 能查看、编辑、合并、拆分、排序、删除/恢复章节与知识点候选；
合并 MUST 保留来源锚点，拆分 MUST 分配锚点。草案 MUST 可保存/丢弃/版本化。

#### Scenario: 合并知识点

- **WHEN** 用户合并两个候选
- **THEN** 合并结果 SHALL 保留两个来源锚点
- **AND** 原候选状态 SHALL 标记 merged

#### Scenario: 拆分知识点

- **WHEN** 用户把一个候选拆成两个
- **THEN** 每个新候选 SHALL 至少有一个来源锚点
- **AND** 原候选状态 SHALL 标记 split

### Requirement: Human Confirmation and Conversion

候选 MUST 经人工确认后才能转换为业务实体；转换 MUST 使用声明式映射与幂等键。
未确认草案 MUST NOT 写入课程/知识点等正式实体。冲突 MUST 可定位，MUST NOT 静默覆盖。

#### Scenario: 确认后生成知识点

- **WHEN** 用户确认章节/知识点并触发转换
- **THEN** 系统 SHALL 按映射创建实体
- **AND** 记录 run/候选与实体 ID 的映射

#### Scenario: 重复转换

- **WHEN** 同一草案重复转换
- **THEN** 系统 SHALL 幂等处理
- **AND** MUST NOT 创建重复实体

### Requirement: Async Runs and Progress

解析/提取 SHALL 通过异步任务执行，提供状态、进度、取消、重试与历史。
大文档 MUST 分页/分块处理；超时/失败 MUST 可重试，MUST NOT 阻塞在线请求。

#### Scenario: 大文档解析

- **WHEN** 解析一份 300 页 PDF
- **THEN** 任务 SHALL 异步执行并显示进度
- **AND** 客户端 SHALL 能取消/重试

### Requirement: Security and Untrusted Content

文档 MUST 被视为不可信输入：解析 MUST 在受限环境执行，MUST NOT 执行宏/脚本/外链；
LLM 提取 MUST 将文档内容包裹为 untrusted，MUST NOT 执行文档内指令。
PII MUST 最小化保存/脱敏；文件大小/页数/解压 MUST 限制。

#### Scenario: 提示词注入

- **WHEN** 文档包含“忽略之前指令”等文本
- **THEN** 提取器 MUST NOT 执行该指令
- **AND** 仅按 schema 输出结构

#### Scenario: 恶意文件

- **WHEN** 文档含宏/外部链接/超限解压
- **THEN** 解析 SHALL 拒绝
- **AND** 记录安全事件

### Requirement: Provenance and Audit

每个解析运行 MUST 记录文档资产、parser/extractor、模型/提示词版本、操作者与时间；
候选必须保留来源锚点。确认/转换/修改 MUST 写审计，并可回溯到源文档。

#### Scenario: 来源追溯

- **WHEN** 管理员查看一个知识点候选
- **THEN** 结果 SHALL 显示源文档/页/段落
- **AND** 解析/确认/转换记录 SHALL 可查

### Requirement: Backward Compatibility

本能力 MUST NOT 改变现有知识库、课程、导入/审批流程；未启用解析时行为不变。
旧文档/知识 MUST 可读；草案 MUST NOT 自动进入正式实体。

#### Scenario: 未启用解析

- **WHEN** 组织未启用文档智能
- **THEN** 旧知识/课程流程 SHALL 保持不变
- **AND** MUST NOT 产生解析任务

#### Scenario: 旧知识条目

- **WHEN** 读取现有知识条目
- **THEN** 行为 SHALL 与升级前一致
- **AND** 不要求重新解析

