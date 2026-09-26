# module-registry Specification (delta)

## ADDED Requirements

### Requirement: Module Blueprint Export

注册表 SHALL 支持把模块导出为**最小蓝图**（语义对象骨架 + 依赖声明），
作为"模块定义 → 蓝图包"的入口；导出结果 MUST 能通过蓝图校验与编译。

#### Scenario: 导出模块为最小蓝图

**Given** 一个已登记的模块，声明了 `dependsOnAtomics: ["available-inventory@^1.0.0"]`
**When** 执行导出
**Then** SHALL 产出蓝图目录（含 `semantic.json` 与清单）
**And** 清单 SHALL 携带该模块的原子依赖声明
**And** 导出结果 SHALL 能被打包并编译通过

#### Scenario: 导出时校验依赖可用性

**Given** 模块声明的原子依赖在当前环境中不可解析
**When** 执行导出
**Then** 导出 SHALL 失败并指明缺失的依赖
**And** MUST NOT 产出一份注定编译失败的蓝图
