# autoparts-capabilities Specification

## ADDED Requirements

### Requirement: ATP with Supersession

可承诺量（ATP）SHALL 由平台计算，MUST 包含替代件（supersession）合并：
被新件替代的旧件库存 SHALL 计入可用量，且合并方向 MUST 明确（旧→新，不回向）。

#### Scenario: 替代件合并可用量

**Given** 新件 X 在库 5 套，被它替代的旧件 Y 在库 3 套，X 声明 Y 为其前身
**When** 查询 X 的可承诺量
**Then** 结果 SHALL 为 8
**And** 查询 Y 的可承诺量时 MUST NOT 把 X 的库存算进去（方向单向）

#### Scenario: 预留与在途计入

**Given** 现存量 10、预留 3、在途 2
**When** 查询可承诺量
**Then** 结果 SHALL 为 9（10 − 3 + 2）

### Requirement: Price Resolution

价格 SHALL 由平台解析，优先级 MUST 显式且确定（客户等级价 → 阶梯价 → 最近成交价 → 标准价），
MUST NOT 由调用方任选一个。

#### Scenario: 命中客户等级价

**Given** 客户为 A 级，某零件声明了 A 级价
**When** 解析该客户该零件的价格
**Then** 返回 SHALL 是 A 级价
**And** 结果 SHALL 附带"命中了哪条规则"的依据

#### Scenario: 无任何特定价时回落到标准价

**Given** 该客户没有等级价、也没有阶梯价与历史成交价
**When** 解析价格
**Then** 返回 SHALL 是标准价

### Requirement: Credit Check

信用检查 SHALL 由平台判定：`额度 − 应收 − 在途` MUST 作为依据返回，
结论与依据 MUST 同时给出（MUST NOT 只返回"通过/不通过"）。

#### Scenario: 超额度

**Given** 客户额度 100,000、应收 90,000、本单 20,000
**When** 检查信用
**Then** 结论 SHALL 为超限
**And** 依据 SHALL 包含额度、应收、本单金额三个数

### Requirement: Unit Conversion Without Float Error

单位换算（箱/套/件）SHALL 由平台完成，MUST NOT 产生二进制浮点误差。

#### Scenario: 箱转件

**Given** 1 箱 = 12 套
**When** 把 2.5 箱换算成套
**Then** 结果 SHALL 精确等于 30

### Requirement: Batch Traceability

系统 SHALL 支持**反向**追溯：给定批次号，能查到涉及它的单据与客户。
只记录日志而无法反查 MUST NOT 视为满足本条。

#### Scenario: 召回场景

**Given** 批次 `B-2026-001` 已随某订单发货给客户
**When** 用该批次号查询
**Then** 结果 SHALL 包含那张订单与客户
**And** 结果 SHALL 可继续追溯到发货时间与数量

### Requirement: Master Data Import with Per-Row Errors

主数据导入 MUST 逐行校验并**逐行报错**：MUST NOT 因一行失败而放弃整批，
也 MUST NOT 静默丢弃非法行。

#### Scenario: 部分行非法

**Given** 一个含 100 行的零件导入文件，其中第 7 行缺必填字段
**When** 执行导入
**Then** 合法行 SHALL 被导入
**And** 第 7 行 SHALL 出现在错误清单里（含行号与原因）
