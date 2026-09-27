# workflow-consolidation Specification

## Purpose
TBD - created by archiving change consolidate-platform-foundations. Update Purpose after archive.
## Requirements
### Requirement: Single State Machine

平台 MUST 只有**一套**状态机实现：蓝图驱动的记录状态迁移。
状态与实例 MUST 存在同一份数据里（MUST NOT 通过外部注册表把状态"写回"另一个存储）。
历史实现 MUST 在收敛完成后移除，MUST NOT 与其长期并存。

#### Scenario: 迁移只走一套入口

**Given** 一个声明了状态与迁移的蓝图
**When** 推进一张单据的状态
**Then** 迁移 SHALL 经蓝图记录接口完成
**And** MUST NOT 存在第二条可以改变该状态的路径

#### Scenario: 收敛期双跑一致

**Given** 收敛期间新旧接口并存
**When** 用同一份流程定义分别读取实例与历史
**Then** 两者 SHALL 一致（对拍）
**And** 两条路径的写入 SHALL 记入同一条审计（用 `source` 区分）

#### Scenario: 旧路径退场可回退

**Given** 前端仍在使用旧接口
**When** 旧实现被停用
**Then** 旧路由 SHALL 返回 410 并给出迁移指引
**And** 回退 SHALL 只需恢复装配，不需回滚数据

### Requirement: AI Output Conforms to Blueprint Layers

AI 生成的模块定义 MUST 能转换为蓝图五层并进入既有的编译与交付链；
MUST NOT 为 AI 产物另建一条协议或交付路径。
转换时缺失的层 MUST 保持缺失（MUST NOT 编造规则或经验策略）。

#### Scenario: AI 产物进既有链

**Given** 一份 `mergedDefinition`
**When** 转换并打包
**Then** 产物 SHALL 能被编译成 IR、能被装载
**And** SHALL 能按既有授权链签名交付

#### Scenario: 不编造缺失的层

**Given** AI 产物中没有规则
**When** 转换
**Then** 产物 SHALL NOT 含 `rules.json`
**And** MUST NOT 生成占位规则

### Requirement: Nightly Suggestion Producer

平台 MUST 在每天 02:00 为声明了 `autoSuggest` 的非终态蓝图记录产生建议。
建议 MUST 来自与按需接口相同的组装（`listSuggestedTransitions`）。
生产者 MUST 只追加建议日志，MUST NOT 改变记录状态、版本或审计行。
未声明 `autoSuggest` 的实体 MUST NOT 产生日志。
`@Cron('0 2 * * *')` 在 `backend/src` MUST 恰好出现一处，且该类 MUST 只注册进一个模块。

#### Scenario: 标了准入的非终态记录写入一条建议

**Given** 实体声明 `autoSuggest` 且记录不在终态
**When** 夜间任务运行且存在至少一条合法建议
**Then** SHALL 追加一行建议日志，目标状态为建议列表的第一条
**And** 记录的 state 与 version MUST 不变
**And** MUST NOT 调用迁移入口

#### Scenario: 未准入、已终态或没有建议

**Given** 实体未声明 `autoSuggest`，或记录已在终态，或建议列表为空
**When** 夜间任务运行
**Then** SHALL NOT 写入建议日志

