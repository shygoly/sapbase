# blueprint-delivery Specification

## Purpose
TBD - created by archiving change add-deliverable-blueprint. Update Purpose after archive.
## Requirements
### Requirement: Licensed and Signed Delivery

蓝图包 SHALL 能声明授权范围（可运行的租户、可否再销售、到期时间）并携带签名。
装载器 MUST 在装载前验签并校验授权；任一项不通过 MUST 拒绝装载，
MUST NOT 以"先跑起来"的方式降级。

#### Scenario: 授权范围内的租户

**Given** 一个已签名、`grantedTo` 含当前租户且未过期的包
**When** 装载该包
**Then** 装载 SHALL 成功
**And** 审计 SHALL 记录授权校验结果

#### Scenario: 未授权租户

**Given** 一个 `grantedTo` 不含当前租户的包
**When** 装载该包
**Then** 装载 SHALL 失败并说明该租户不在授权范围内
**And** MUST NOT 产生任何可执行计划

#### Scenario: 包被篡改

**Given** 一个已签名的包
**When** 任一文件或清单被修改（授权字段包含在内）而签名未更新
**Then** 验签 SHALL 失败
**And** 装载 SHALL 被拒

#### Scenario: 授权过期

**Given** 一个 `expiresAt` 已过去的包
**When** 装载该包
**Then** 装载 SHALL 被拒

### Requirement: Explicit Unsigned Exemption

系统 MAY 为开发场景提供未签名豁免，但该豁免 MUST 显式开启、MUST 只豁免授权链
（完整性、编译、防漂移 MUST 仍然生效）、MUST 写审计，且在**生产环境 MUST 被拒绝**
（报错，而不是警告）。

#### Scenario: 开发豁免

**Given** 显式开启未签名豁免且非生产环境
**When** 装载一个未签名的包
**Then** 装载 MAY 成功
**And** SHALL 写入一条明确的审计记录

#### Scenario: 生产下拒绝豁免

**Given** 生产环境
**When** 配置里带有未签名豁免
**Then** 该豁免 SHALL 被拒绝

### Requirement: Complete Business Definition Layers

蓝图包 SHALL 能表达完整的业务定义：语义、流程、规则（校验/审批/记账）、经验策略。
编译器 MUST 逐文件校验，**未覆盖的文件 MUST 被拒绝**（不跳过未知文件），
且规则与经验策略中引用的一切（实体、字段、状态、事件、动作、角色）MUST 在包内可解析。

#### Scenario: 规则引用不存在的字段

**Given** `rules.json` 里一条校验规则引用了 `semantic.json` 中不存在的字段
**When** 编译该包
**Then** 编译 SHALL 失败并指明是哪条规则的哪个引用

#### Scenario: 借贷不平衡

**Given** 一条记账规则，其借贷两侧是**字面量**且不相等
**When** 编译该包
**Then** 编译 SHALL 失败
**And** 明细 SHALL 指出两侧的值（而不是一句"不平衡"）

#### Scenario: 经验策略不得包含布局

**Given** `experience.json` 里出现 `layout` / `width` / `position` 之类的布局字段
**When** 校验该文件
**Then** 校验 SHALL 失败（经验策略只描述"何时需要人介入"，不描述界面长什么样）

#### Scenario: 未覆盖的层文件

**Given** 包内存在 v1 协议未覆盖的文件
**When** 编译该包
**Then** 编译 SHALL 失败
**And** MUST NOT 忽略该文件继续编译

