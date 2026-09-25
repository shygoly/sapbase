# blueprint-package Specification

## ADDED Requirements

### Requirement: Package Format and Integrity

系统 SHALL 以带清单的压缩包（`.erpkg`）作为蓝图交付物；清单 MUST 是唯一权威，
且 MUST 为包内每个文件记录 SHA-256 校验和。任何"内容与清单不一致"的情形 MUST 被拒绝。

#### Scenario: 打包产出可校验的包

**Given** 一个包含 `semantic.json` / `flows.json` / `forms.json` 与 `config/thresholds.json` 的蓝图目录
**When** 执行打包
**Then** 产出 `.erpkg`，其中 `manifest.json` SHALL 包含蓝图 id、语义化版本、runtime 版本范围、依赖列表、分层文件清单
**And** `manifest.files` SHALL 为每个文件记录 `sha256`
**And** 打包结果 SHALL 可由解包还原为等价的文件集合

#### Scenario: 内容与清单不符则拒绝

**Given** 一个已打包的 `.erpkg`
**When** 包内任一文件被替换、缺失，或出现清单未声明的文件
**Then** 校验 SHALL 失败
**And** SHALL 给出具体的文件与期望/实际哈希
**And** MUST NOT 返回部分可用的蓝图

#### Scenario: 拒绝路径穿越

**Given** 一个包内条目路径试图跳出解包目录（如 `../../etc/passwd`）
**When** 解包该条目
**Then** 解包 SHALL 失败
**And** MUST NOT 在目标目录之外写入任何文件

### Requirement: Layered Visibility

蓝图包 SHALL 通过清单声明分层可见性（public / configurable / protected），
加载方 MUST 按声明强制校验；v1 **不承诺** protected 层的加密。

#### Scenario: 分层文件必须被声明

**Given** 一个包含 `protected/` 目录的包
**When** 其清单未把该目录下文件列入任何层
**Then** 校验 SHALL 失败（未声明的文件一律视为非法）

#### Scenario: protected 层只校验存在性与校验和

**Given** 清单声明了 `protected/rules.enc`
**When** 执行校验
**Then** 系统 SHALL 校验该文件存在且校验和匹配
**And** MUST NOT 声称该文件已加密或已验证签名（加密能力属 License 协议，另立变更）

### Requirement: Dependency Declaration and Resolution

蓝图 MUST 在清单中声明其依赖（原子与模块）；编译与加载时 SHALL 逐条解析，
不可满足 MUST 拒绝，且 MUST NOT 回退到任何内置实现。

#### Scenario: 原子依赖可满足

**Given** 清单声明 `{ "atomic": "available-inventory", "version": "^1.0.0" }`
**And** 原子注册表中存在满足该范围的 `active` 契约与可执行实现
**When** 编译或加载该蓝图
**Then** 依赖解析 SHALL 成功
**And** 结果 SHALL 记录解析到的具体版本与模块哈希

#### Scenario: 原子依赖不可满足

**Given** 清单声明了一个不存在或不可执行的原子依赖
**When** 编译或加载该蓝图
**Then** 操作 SHALL 失败并指明是哪一个依赖
**And** MUST NOT 以"缺这个能力也能跑"的方式继续
