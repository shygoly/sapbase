# test-gate Specification

## ADDED Requirements

### Requirement: Reproducible Full-Suite Gate

后端的测试门禁 MUST 以**整仓命令**为准（`npm run test --workspace backend`）。
任何"全绿"的说法 MUST 由这条命令的输出支持；MUST NOT 以子集命令的结果代替。

#### Scenario: 全绿的说法必须可复现

**Given** 一份声称测试全绿的结论
**When** 复核者执行 `npm run test --workspace backend`
**Then** 输出 SHALL 显示全部套件通过、零失败
**And** 若只跑了子集，结论 MUST 写明跑的是哪个范围

#### Scenario: 子集验证的正确定位

**Given** 开发过程中只跑了与改动相关的几个目录
**Then** 该结果 MAY 作为中间证据
**But** MUST NOT 被表述为"整仓测试通过"

### Requirement: Test Utility Contract

spec 引用的测试工具（`backend/test/utils/*` 等）MUST 存在且**路径正确**；
MUST NOT 用路径模糊匹配（如 jest `moduleNameMapper`）掩盖写错的导入。

#### Scenario: 导入路径必须真实可解析

**Given** 一个 spec 通过相对路径引用测试工具
**When** 运行该 spec
**Then** 该路径 SHALL 在文件系统上真实存在
**And** 修法 SHALL 是修正路径本身，而不是让解析器去猜

### Requirement: Honest Test Removal

删除测试用例 MUST 以"被测行为已不存在"为唯一理由，且 MUST 在变更记录中逐条登记
（文件、用例名、理由、覆盖来源）。MUST NOT 以删除测试的方式让门禁变绿。

#### Scenario: 删除必须留下理由

**Given** 一个用例断言的行为在实现中已被移除
**When** 该用例被删除
**Then** 变更记录 SHALL 列出该文件、用例名与理由
**And** 若行为是被**静默删除**的（而非有意变更），SHALL 作为实现问题单独列出
