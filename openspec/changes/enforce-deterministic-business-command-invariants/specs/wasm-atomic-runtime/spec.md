## ADDED Requirements

### Requirement: Closed Numeric Projection Before ABI Memory Write

ABI v1 的宿主 SHALL 在任何 Int32Array 内存写入前验证输入为安全整数、属于 i32 范围与列声明的更窄值域。业务定点文本 SHALL 在宿主以 bigint 按冻结单位/标度无损投影；未知标度、不能整除、超范围 MUST 拒绝，MUST NOT 截断或回绕。标识、租户和货币 MUST NOT 进入模块内存。

宿主 SHALL 对输出反向标度与范围执行相同契约校验，保留既有 ABI、准入、输出闸与错误码；中间/输出溢出、INEXACT、缺绑定或引擎不可用 MUST 拒绝且不返回部分结果、不静默降级。实际契约/ABI/模块/引擎摘要及标度 SHALL 进入执行证据，业务 command/effect MUST NOT 因此扩张为 Wasm 原子。

#### Scenario: 合法边界与无损投影

- **WHEN** 输入在 i32/列域内，或批准定点数量可按绑定标度无损转换且许可/模块/准入均满足
- **THEN** 宿主 SHALL 在校验后投影整数列、执行实际绑定模块并按索引回填
- **AND** 证据 SHALL 记录实际 ABI、标度、模块和引擎，标识字段 MUST NOT 入内存

#### Scenario: 内存写前拒绝非法范围与标度

- **WHEN** 输入超 i32、非安全整数、超列域、标度未知或无损换算不能整除
- **THEN** SHALL 在写入 Int32Array 前拒绝且 MUST NOT 实例化执行该次输入
- **AND** MUST NOT 通过 JS 位运算/typed array 窄化让超范围值回绕

#### Scenario: 模块溢出或不可用不产生结果

- **WHEN** 实际模块返回中间/输出溢出、INEXACT，输出反向转换不合法，或绑定/引擎不可用
- **THEN** 调用 SHALL 明确失败且 MUST NOT 返回部分结果或内置替代成功
- **AND** 调用它的事务命令 SHALL 回滚相关业务效果
