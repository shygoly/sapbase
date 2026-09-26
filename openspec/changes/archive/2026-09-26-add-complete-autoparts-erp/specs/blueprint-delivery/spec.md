# blueprint-delivery Specification

## ADDED Requirements

### Requirement: Template Upgrade Preserves Existing Data

模板升级（如 1.0.0 → 1.1.0）时，新增字段 MUST 有声明式默认值或明确的迁移路径；
旧数据 MUST 在升级后仍可读（读时按默认值补齐），且 MUST NOT 被隐式改写回库。
升级 MUST NOT 打破既有的非空约束。

#### Scenario: 升级后旧行仍可读

**Given** 已有 1.0.0 写入的旧行，缺失 1.1.0 新增字段
**When** 用 1.1.0 模板读取旧行
**Then** 读取 SHALL 成功，缺失字段按声明的默认值呈现
**And** 存储 SHALL NOT 被自动更新（读不改写）

#### Scenario: 升级后的写入受新约束

**Given** 1.1.0 新增了一个非空字段
**When** 写入一条缺该字段的记录
**Then** 写入 SHALL 被拒绝

### Requirement: Re-Sign After Upgrade

模板内容变更后 MUST 重新编译与**重新签名**：授权绑定 MUST NOT 因升级而被绕过。

#### Scenario: 升级未重签

**Given** 一份已签名的 1.0.0 包被就地改为 1.1.0
**When** 装载该包
**Then** 验签 SHALL 失败
**And** 装载 SHALL 被拒绝

### Requirement: Currency Is Part of the Type

金额字段 MUST 携带货币；**不同货币 MUST NOT 相加**，编译期与运行时都 MUST 判定。

#### Scenario: 跨币种求和被拒

**Given** 一张单的行分别是 CNY 与 USD
**When** 汇总金额
**Then** 汇总 SHALL 被拒并指明币种不一致

### Requirement: Built-in Query Views

平台 SHALL 提供常用查询视图（库存 / 应收 / 在途），其口径 MUST 冻结在协议里，
MUST NOT 要求使用者自行写 SQL 才能看到常用视图。

#### Scenario: 库存视图

**Given** 已写入的零件与库存记录
**When** 查询库存视图
**Then** 结果 SHALL 包含在库、预留、在途与可用量
**And** 口径 SHALL 与协议文本一致（含缺失列的 COALESCE 规则）
