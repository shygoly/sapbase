## ADDED Requirements

### Requirement: Data Scope Enforcement in Semantic Runtime

语义运行时 SHALL 对声明了 `dataScope` 的实体执行统一的数据范围谓词。
范围 MUST 与字段级权限、单据级 `ownership` 组合（取交集），
MUST NOT 因为字段权限或 ownership 通过就绕过范围判定。

#### Scenario: 列表按范围过滤

- **WHEN** `Student` 声明 `classId → class` 绑定，调用方只被授权到“高二3班”
- **THEN** 列表 SHALL 只返回该班级的学生
- **AND** 班级外的学生 MUST NOT 出现在分页、计数或聚合结果中

#### Scenario: 详情越界返回 404

- **WHEN** 调用方按 ID 读取范围外的学生
- **THEN** 读取 SHALL 返回 404 或拒绝
- **AND** MUST NOT 返回该记录的任何字段

#### Scenario: 写入与迁移越界拒绝

- **WHEN** 调用方更新、删除或迁移范围外的记录
- **THEN** 操作 SHALL 被拒绝
- **AND** 记录状态、版本与审计 MUST NOT 改变

#### Scenario: 创建校验节点范围

- **WHEN** 调用方创建学生并写入其不可写的班级节点
- **THEN** 创建 SHALL 被拒绝并指明 `classId`

#### Scenario: 字段权限与范围组合

- **WHEN** 一条记录在范围内，但调用方缺少某字段的读权限
- **THEN** 记录 SHALL 可见
- **AND** 受限字段 SHALL 被省略并列入 `omittedFields`

#### Scenario: 视图、追溯与导入同样收窄

- **WHEN** 调用方读取视图、追溯历史或导入数据
- **THEN** 只能看到/写入范围内记录
- **AND** 导入 MUST NOT 部分落库越界行

#### Scenario: 解析失败拒绝

- **WHEN** 范围解析器异常或绑定/策略缺失
- **THEN** 读取 SHALL 返回拒绝或空集合
- **AND** MUST NOT 退化为租户内全量

## MODIFIED Requirements

### Requirement: Runtime Declares What It Does Not Enforce

语义运行时 SHALL 只声明**当前真正未执行**的部分，MUST NOT 让"被声明"与"被强制执行"混为一谈。
审批条件与记账分录在 v1.1 起**已执行**（见下方 ADDED 要求）；
数据范围自 `add-generic-data-scope-authorization` 起**已执行**
（见 `Data Scope Enforcement in Semantic Runtime` 要求）；
仍未执行的是：递归级联删除（`onDelete: cascade` 的递归顺序与环）、
库存数量的并发占用（ATP 的前置）。

#### Scenario: 审批条件被执行（取代 v1.0 的"不被执行"）

**Given** 模板声明了 `approval` 条件，且该条件在本次写入后成立
**When** 写入该记录
**Then** 单据 SHALL 进入待审状态并留下审批链
**And** 未经批准的后续迁移 SHALL 被拒绝

#### Scenario: 未执行的部分被显式声明

**Given** 模板声明了 `onDelete: cascade`
**When** 删除被引用的实例
**Then** 系统 SHALL 明确拒绝或明确说明该策略尚未执行
**And** MUST NOT 静默按"看起来合理"的顺序递归删除

#### Scenario: 数据范围被执行

**Given** 实体声明了 `dataScope`，且调用方只被授权到某个班级节点
**When** 读取列表、详情或写入记录
**Then** 只能访问该班级范围内的记录
**And** MUST NOT 再以"数据范围未执行"为由返回租户内全量
