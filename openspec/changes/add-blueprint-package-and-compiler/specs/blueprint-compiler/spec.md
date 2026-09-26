# blueprint-compiler Specification

## ADDED Requirements

### Requirement: Compilation Pipeline

编译器 SHALL 按固定顺序执行：包与清单校验 → 逐文件 Schema 校验 → 依赖闭包 → 冲突检测 → IR 生成；
任一阶段失败 MUST 终止且不产出可加载的编译结果。

#### Scenario: 合法蓝图编译成功

**Given** 一个通过包校验的 `.erpkg`
**When** 执行编译
**Then** 编译器 SHALL 产出结构化 IR、文本 IR、依赖清单与内容摘要
**And** 摘要 SHALL 足以在加载时检测 IR 与包内容是否漂移

#### Scenario: 缺 Schema 的文件不被跳过

**Given** 包内某个文件在 v1 尚无对应 Schema
**When** 执行编译
**Then** 编译 SHALL 失败并说明该文件尚未被协议覆盖
**And** MUST NOT 以"跳过未知文件"的方式放行

### Requirement: Deterministic Conflict Detection

编译器 SHALL 只执行**可确定性判定**的冲突检测，并 MUST NOT 引入需要主观判断的检查；
检测到的冲突 MUST 以可定位的方式报告（文件、路径、冲突类型）。

#### Scenario: 检测四类确定性冲突

**Given** 一份蓝图，存在下列任一情形：
- 同一语义对象/规则/流程 id 被定义两次
- 引用了不存在的实体、状态、规则或原子
- 实体关系图或流程图中存在环（含自环）
- 状态机初始态不唯一、无终态、或含不可达状态

**When** 执行编译
**Then** 编译 SHALL 失败并逐条报告冲突（类型 + 位置）
**And** 报告 SHALL 可直接定位到具体文件与字段

#### Scenario: 不做主观检查

**Given** 一份命名风格不统一、但结构合法的蓝图
**When** 执行编译
**Then** 编译 SHALL 成功（命名风格与语义相似度不在确定性判据内）

### Requirement: IR Equivalence

IR SHALL 同时提供结构化与文本两种形态，且 MUST 可互相转换而不丢信息。

#### Scenario: 文本与结构往返等价

**Given** 任意合法蓝图编译出的 IR
**When** 将结构化 IR 导出为文本，再解析回结构化 IR
**Then** 两次结果 SHALL 等价
**And** 文本形态 SHALL 可用于代码评审与 diff
