## ADDED Requirements

### Requirement: Blueprint-Bounded Evolution Scope

实例内自迭代的变更范围 MUST 限于蓝图层：字段、表单、列表视图、流程/状态机、权限映射、菜单、知识条目。
MUST NOT 修改平台代码、表结构与迁移、工具契约（`contracts/tools.json`）、评测闸门（G0–G6）与发布策略本身。

#### Scenario: 越界变更被拒

**Given** 实例内 builder 起草一个新增数据库表的变更
**When** 提交校验
**Then** 校验 MUST 失败并说明"超出实例演进范围"
**And** 提议 MUST NOT 进入预览或发布

#### Scenario: 蓝图层变更可完整走通

**Given** 一个新增可选字段并调整表单布局的变更
**When** 依次执行校验、预览、人工批准、灰度激活
**Then** 每一步 MUST 留下可追溯记录
**And** MUST 能从激活结果回退到上一 release

### Requirement: Human Approval By Default

实例内变更的默认自主等级 MUST 为 A1：agent 可起草、校验、预览、生成 changelog，
MUST NOT 批准或发布自己起草的变更。A2 仅在变更类命中白名单、应用显式开启且策略经人工审批后适用；
发布者 MUST 是 `release-automation` 策略服务而非 agent。

#### Scenario: 作者不得自批

**Given** builder 起草的提议
**When** 同一身份尝试批准
**Then** 平台 MUST 拒绝
**And** 审计 MUST 记录该次尝试

#### Scenario: 非白名单变更不得自动发布

**Given** 一个修改审批规则或权限映射的变更
**When** 应用声明 A2
**Then** 平台 MUST 仍要求人工批准

### Requirement: Version Binding

每次实例变更 MUST 记录其所基于的 `platformVersion` 与 `evolutionScope`。
未声明版本绑定的变更 MUST NOT 被批准发布。

#### Scenario: 缺少版本绑定

**Given** 一份未声明 `platformVersion` 的提议
**When** 提交批准
**Then** 平台 MUST 拒绝
**And** 提示补充版本信息

### Requirement: Divergence Guard

平台版本升级时，系统 MUST 检测实例蓝图与目标平台版本之间在演进范围内的结构性冲突，
并在升级前给出可执行的差异清单；检测失败 MUST 阻止升级而不是静默覆盖。

#### Scenario: 平台升级与实例改动冲突

**Given** 实例修改过某表单布局
**When** 平台新版本也修改了同一表单结构
**Then** 升级 MUST 暂停并列出冲突项
**And** MUST NOT 自动选择任一方

#### Scenario: 无冲突时升级不被阻断

**Given** 实例改动与平台新版本无结构冲突
**When** 执行升级
**Then** 升级 MUST 正常完成
**And** 实例改动 MUST 保留

### Requirement: Upstream Promotion

验证过的实例变更 MAY 回流为平台模板。回流内容 MUST 去除客户数据与可识别信息，
MUST 由平台侧人工审批后方可进入平台版本；实例 MUST NOT 自动接收未审批的模板。

#### Scenario: 回流携带客户数据被拒

**Given** 一份含客户名称、金额等业务数据的实例变更
**When** 发起回流
**Then** 平台 MUST 拒绝并要求脱敏
**And** MUST 记录拒绝原因

#### Scenario: 模板需实例本地确认

**Given** 平台发布了源自其他实例的模板
**When** 本实例同步
**Then** 模板 MUST 以"可选变更"呈现
**And** MUST NOT 自动应用

### Requirement: Evolution Audit

实例演进的每一步（提议、校验、预览、批准、激活、回退、回流）MUST 落审计，
审计 MUST 可回答"谁在何时基于哪个版本改了什么、结果如何"。

#### Scenario: 回溯一次失败的回退

**Given** 一次因护栏异常触发的回退
**When** 审计查询该 release
**Then** 结果 MUST 包含触发原因、回退目标版本与操作者
**And** MUST 能定位到对应的提议与校验记录
