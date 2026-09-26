# semantic-runtime Specification

## Purpose
TBD - created by archiving change add-minimal-autoparts-template. Update Purpose after archive.
## Requirements
### Requirement: Template-Enforced Record Writes

实体实例的写入 MUST 经过已装载模板的校验。任一校验不通过 MUST 拒绝写入且 MUST NOT 落库；
MUST NOT 存在"部分写入"或"跳过校验直接落库"的入口。

#### Scenario: 合法写入

**Given** 一份已装载的模板，其中声明了实体与字段
**When** 写入一条字段齐全、类型正确、通过 validation 的记录
**Then** 写入 SHALL 成功
**And** 该记录 SHALL 可读回

#### Scenario: 未知实体

**Given** 模板未声明该实体
**When** 写入该实体的记录
**Then** 写入 SHALL 被拒并指明实体名

#### Scenario: 未知字段

**Given** 模板声明了实体但未声明某字段
**When** 记录里出现该字段
**Then** 写入 SHALL 被拒
**And** MUST NOT 忽略该字段继续写入（通用记录表没有列约束，放过未知字段等于把校验变成抽查）

#### Scenario: 类型不匹配与悬空引用

**Given** 字段声明为数值却传入文本，或 `reference` 指向不存在的实例
**When** 写入该记录
**Then** 写入 SHALL 被拒并指明字段

#### Scenario: 违反 validation 规则

**Given** 模板声明了 `so-qty-positive`（`quantity > 0`）
**When** 写入 `quantity = 0` 的记录
**Then** 写入 SHALL 被拒并指明是哪条规则
**And** MUST NOT 落库

### Requirement: Delivery Command Produces Authorized Artifact

系统 SHALL 提供一条命令，把模板目录产出为**已授权、已签名**的可交付包，
且 MUST 保证编译盖章发生在签名之前。

#### Scenario: 一条命令产出可交付制品

**Given** 一个可编译的模板目录
**When** 执行交付命令
**Then** 产出的包 SHALL 能通过装载链（含授权与验签）
**And** 清单 SHALL 记录 `compiled.irDigest` 与 `signature`

#### Scenario: 先签名后编译会让签名失效

**Given** 一个已签名的包
**When** 之后再执行编译盖章（改变 `compiled`）
**Then** 验签 SHALL 失败
**And** 装载 SHALL 被拒（这是有意的：编译结果变了就该重签）

### Requirement: Runtime Declares What It Does Not Enforce

语义运行时 SHALL 只声明**当前真正未执行**的部分，MUST NOT 让"被声明"与"被强制执行"混为一谈。
审批条件与记账分录在 v1.1 起**已执行**（见下方 ADDED 要求）；
仍未执行的是：递归级联删除（`onDelete: cascade` 的递归顺序与环）、
部门/仓库级数据范围（需要可信的用户属性模型）、库存数量的并发占用（ATP 的前置）。

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

### Requirement: Approval Execution with Rollups

`approval.when` MUST 被求值；条件中含**金额合计**（多行汇总）时 MUST 依赖派生字段的计算结果，
MUST NOT 退化成"只看单行某字段"的近似条件。

#### Scenario: 金额合计触发审批

**Given** 订单头声明 `totalAmount` 为行金额的汇总，审批条件为 `totalAmount > 100000`
**When** 一张三行订单合计 120,000 被提交
**Then** 该订单 SHALL 进入待审状态
**And** 审批依据 SHALL 记录合计金额（而不是任一单行金额）

### Requirement: Journal Entry Generation and Runtime Balance

`accounting` 规则 MUST 在触发事件时生成分录；
借贷平衡 MUST 在**运行时**同样判定（不只编译期字面量）。

#### Scenario: 运行时不平衡被拒

**Given** 一条记账规则的借贷两侧在运行时求值后不相等
**When** 触发该规则
**Then** 分录 SHALL NOT 落库
**And** 错误 SHALL 给出两侧的实际值

### Requirement: Database-Enforced Constraints

模板声明的唯一性与非空约束 MUST 落到数据库（唯一索引 / CHECK 约束），
且违反时 MUST 返回**可定位**的错误（指明实体、字段与冲突值），
MUST NOT 把数据库错误原样抛给调用方。

#### Scenario: 应用层绕过也被兜住

**Given** `Part.partNo` 声明唯一
**When** 绕过应用层校验直接写库，写入重复值
**Then** 数据库 SHALL 拒绝
**And** 应用层 SHALL 能把该错误映射为"哪个实体的哪个字段与谁冲突"

#### Scenario: 索引键含租户

**Given** 两个租户各自的 `partNo` 都是 `P-001`
**When** 两个租户分别写入
**Then** 两次写入 SHALL 都成功（唯一性在同一租户内成立）

### Requirement: Scoped Permissions

系统 SHALL 支持字段级与单据级权限：未授权的字段 MUST 在读取时被剔除（而不是返回后由前端隐藏），
未授权的单据 MUST NOT 可读或可改。

#### Scenario: 成本价对销售不可见

**Given** 当前身份没有 `part.cost` 的读权限
**When** 读取该零件
**Then** 返回结果 MUST NOT 含成本价字段
**And** 尝试过滤或排序该字段 SHALL 被拒绝（否则可反推出值）

