# chat-erp Specification

## ADDED Requirements

### Requirement: Whitelisted Agent Tool Surface

智能体可调用的工具 MUST 来自工具契约（`contracts/tools.json`），
且每个工具 MUST 声明参数形状、权限点、是否写数据。
MUST NOT 存在"契约之外仍可执行"的路径；未声明的能力 MUST 以"没有这个能力"回应，
MUST NOT 由智能体自行编造替代路径。

#### Scenario: 未声明的能力

**Given** 一个用户请求需要某个未在契约里声明的能力
**When** 编排器处理该请求
**Then** 系统 SHALL 明确回应"没有这个能力"
**And** MUST NOT 生成任何会改动数据的动作

#### Scenario: 契约里的工具但缺权限

**Given** 当前身份缺少该工具声明的权限点
**When** 调用该工具
**Then** 调用 SHALL 被拒
**And** 错误 SHALL 指明缺哪个权限点
**And** 拒绝 SHALL 写入审计

### Requirement: Write Actions Require Confirmation

声明为写数据的工具 MUST NOT 在用户确认前执行。
确认 MUST 由平台签发一次性令牌（绑定工具与参数摘要），智能体 MUST NOT 自行确认。

#### Scenario: 无令牌的写调用

**Given** 一个 `confirmation: required` 的工具
**When** 在没有任何确认令牌的情况下调用它
**Then** 调用 SHALL 被拒
**And** MUST NOT 产生任何数据改动

#### Scenario: 令牌只能用一次

**Given** 平台已为某个写操作签发令牌
**When** 同一令牌被第二次使用
**Then** 第二次调用 SHALL 被拒

### Requirement: Structured Interaction Plan

运行时 MUST 以结构化交互计划（`interaction-plan/v1`）描述"要展示什么、能做什么"。
计划中的 `blocks[].kind` 与 `actions[].kind` MUST 属于封闭枚举；
渲染器遇到未知枚举值 MUST 拒绝渲染整份计划，MUST NOT 跳过未知部分继续渲染。

#### Scenario: 未知 block 类型

**Given** 一份包含未知 `kind` 的计划
**When** 渲染器渲染它
**Then** 渲染 SHALL 失败
**And** MUST NOT 渲染该计划中的任何部分

#### Scenario: 动作必须绑定工具

**Given** 计划里的一个动作（`cancel` 除外）
**When** 校验该计划
**Then** 该动作 MUST 引用一个契约内的工具
**And** 缺少工具引用的动作 SHALL 使整份计划非法

### Requirement: Agent Does Not Own Facts or Rules

智能体 MUST NOT 成为事实或规则的真源：数据 SHALL 来自 runtime，
权限/审批/账务判定 SHALL 由平台完成。
计划 MUST 记录其依据的工具调用（`trace`），使"这些事实从哪来"可复现。

#### Scenario: 计划必须留痕依据

**Given** 一份由工具结果生成的计划
**Then** 计划 SHALL 包含 `trace`，列出参与生成的事实来源工具
**And** 每一项工具调用 SHALL 可在审计中查到
