# semantic-runtime Specification

## ADDED Requirements

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

语义运行时 SHALL 明确声明其未执行的部分（审批条件、记账分录、流程推进），
MUST NOT 让"被声明"与"被强制执行"混为一谈。

#### Scenario: 审批条件不被执行

**Given** 模板声明了 `approval` 条件（`when` 为表达式）
**When** 写入一条满足该条件的记录
**Then** 写入 SHALL 成功（v1 不执行审批）
**And** 协议 SHALL 说明该条件何时会被执行（需要表达式求值器，属后续变更）
