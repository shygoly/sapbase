# 文档真源治理

## ADDED Requirements

### Requirement: Single Truth Source per Topic

每个主题 SHALL 只有一份权威文档；其他位置只能引用或派生，不得复述出第二版。

#### Scenario: Release topic has one source
- **WHEN** 需要了解发布/激活/回退
- **THEN** 权威来源 MUST 是 `docs/protocols/release.md` 与相关不变量
- **AND** 其他文档 MUST 引用它，不得复制一份完整规则

#### Scenario: PiAgent topic has one source
- **WHEN** 需要了解 PiAgent 双 profile、工具面与安全边界
- **THEN** 权威来源 MUST 是 `docs/protocols/piagent.md`
- **AND** `chat-erp.md` MUST 只保留交互协议本身

### Requirement: Reference Package Is Historical

采用完成后，`docs/reference/` SHALL 被标记为历史，已并入的提取文本 MUST 被移除。

#### Scenario: Reference README is marked
- **WHEN** 打开 `docs/reference/README.md`
- **THEN** 顶部 MUST 标注“已并入，保留作历史”
- **AND** MUST 列出合并映射与日期

#### Scenario: Parallel text is removed
- **WHEN** 归并完成
- **THEN** 已并入的 01–07、templates、scripts 提取副本 MUST 被删除
- **AND** `reference.zip` MAY 保留作历史归档，但 MUST 声明“不是入口，不参与校验”

### Requirement: Entry Points Point to Truth Sources

根 `AGENTS.md` 与 `openspec/project.md` SHALL 只指向唯一的定义层、工程参考与四份契约。

#### Scenario: Agent enters repository
- **WHEN** Agent 读取根 `AGENTS.md`
- **THEN** 它 MUST 被引导到 `docs/META_LANGUAGE.md`、`openspec/project.md`、`docs/ARCHITECTURE.md` 与根四契约
- **AND** MUST NOT 被引导到已标记历史的参考包提取文本

#### Scenario: Project context stays short
- **WHEN** 更新 `openspec/project.md`
- **THEN** 它 MUST 保留项目上下文与技术栈摘要
- **AND** 架构细节 MUST 链接到 `docs/ARCHITECTURE.md`，不重复长文

### Requirement: Contract Change Updates Truth Sources

任何契约或架构变更 SHALL 同时更新对应真源与 checker。

#### Scenario: Contract format changes
- **WHEN** 修改四份契约的格式
- **THEN** 对应 checker MUST 在同一变更中更新
- **AND** 真源文档 MUST 同步

#### Scenario: New topic is added
- **WHEN** 新增一个跨领域主题（如发布、Agent 进化）
- **THEN** 文档真源表 MUST 先登记落点
- **AND** MUST NOT 另建第四份“总设计”

### Requirement: Periodic Drift Audit

项目 SHALL 至少每季度审计文档漂移，并记录结果。

#### Scenario: Quarterly audit runs
- **WHEN** 执行季度审计
- **THEN** 必须检查术语漂移、重复契约、死链、入口分叉与基线债务
- **AND** 发现的问题 MUST 进入技术债或修复变更

#### Scenario: Dead links are fixed
- **WHEN** 审计发现死链
- **THEN** 必须在当季修复或登记 `TD-x`
- **AND** 不得长期保留失效引用
