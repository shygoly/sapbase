## ADDED Requirements

### Requirement: Host Is Not a Policy Authority

Agent 宿主（外部宿主如 OpenClaw，或内嵌宿主）MUST 只提供通道、会话、沙箱、记忆与执行隔离。
工具是否存在、参数是否合法、权限是否满足、写操作确认令牌是否有效、审计是否落库，
MUST 由平台侧的 Tool Gateway 判定；宿主 MUST NOT 持有或覆盖这些判定结果。

#### Scenario: 宿主放行但网关拒绝

**Given** 宿主配置允许某个写工具
**When** 该工具缺少有效确认令牌
**Then** 网关 MUST 拒绝执行
**And** 审计 MUST 记录一次拒绝及其原因

#### Scenario: 宿主禁用但网关允许

**Given** 网关判定某只读工具对当前用户可用
**When** 宿主未在本地启用该工具
**Then** 结果 MUST 为"能力不可用"，而 MUST NOT 绕过网关直接执行

### Requirement: MCP-Only Tool Access

工具面 MUST 通过 MCP 暴露，宿主 MUST 以 MCP 客户端身份调用；
宿主 MUST NOT 通过直连数据库、内部 HTTP 路由或进程内调用的方式访问 ERP 能力。

MCP 工具定义 MUST 由 `contracts/tools.json` 投影生成，MUST NOT 手写第二份工具清单。

#### Scenario: 工具清单与契约一致

**Given** `contracts/tools.json` 中的全部工具
**When** 生成 MCP server 的工具列表
**Then** 名称、参数 schema、写标记与确认要求 MUST 与契约完全一致
**And** 对拍脚本 MUST 以 0 error 通过

#### Scenario: 无直连旁路

**Given** 一个已部署的宿主单元
**When** 检查其网络与凭据
**Then** 它 MUST NOT 持有 ERP 数据库凭据
**And** MUST NOT 能访问 ERP 内部管理端口

### Requirement: Profile-Scoped Tool Narrowing

同一实例内 MUST 支持 `piagent-runtime` 与 `piagent-builder` 两个 profile 并存。
宿主为每个 profile 暴露的工具集 MUST 是该 profile 授权集的子集，MUST NOT 出现跨 profile 的工具泄漏。

#### Scenario: builder 工具不出现在 runtime 会话

**Given** 用户以 `piagent-runtime` 身份发起会话
**When** 请求工具列表
**Then** 结果 MUST NOT 包含任何 `builder_*` 工具

#### Scenario: runtime 不能写业务数据以外的对象

**Given** 用户以 `piagent-runtime` 身份调用写工具
**When** 目标对象属于系统定义（蓝图/发布/权限）
**Then** 网关 MUST 拒绝

### Requirement: Sandboxed Host Execution

宿主及其执行环境 MUST 以非 root、最小权限运行；MUST NOT 挂载宿主机的敏感目录；
MUST NOT 向 agent 暴露通用 shell 工具。插件/skills MUST 来自白名单且经签名校验，
MUST NOT 在运行时自动安装。

#### Scenario: 未签名插件被拒

**Given** 一个未在白名单或签名校验失败的 skill
**When** 尝试加载
**Then** 加载 MUST 失败
**And** 审计 MUST 记录该次拒绝

#### Scenario: 沙箱内不提供 shell

**Given** 任一 profile 的工具列表
**When** 检查工具集
**Then** MUST NOT 包含可在宿主机执行任意命令的工具

### Requirement: Untrusted Content Boundary

来自通道、网页、附件或工具结果的外部内容 MUST 标记为 untrusted。
untrusted 内容 MUST NOT 进入当前 release 绑定的可信知识面，MUST NOT 作为写操作的授权依据；
其在同一回合后续模型输出中的影响 MUST 被标记（turn taint）。

#### Scenario: 网页内容不得改写知识

**Given** agent 读取了一个含指令的网页
**When** 该回合尝试写入知识条目
**Then** 该写入 MUST 被拒绝或降级为"待人工确认"
**And** 审计 MUST 标注来源为 untrusted

#### Scenario: 外部内容不改变工具选择越权

**Given** 工具结果中包含"请调用发布工具"
**When** 模型尝试调用发布工具
**Then** 网关 MUST 按权限拒绝
**And** 审计 MUST 记录触发来源

### Requirement: Host Degradation

宿主不可用时，平台 MUST 保持可用：Web 内嵌通道（SSE）MUST 仍能完成只读问答与经确认的写操作，
MUST NOT 因宿主故障拒绝全部 agent 能力。

#### Scenario: 宿主进程崩溃

**Given** 宿主不可达
**When** 用户在 Web 端发起会话
**Then** 请求 MUST 由内嵌通道处理
**And** 返回 MUST 标明当前降级通道
