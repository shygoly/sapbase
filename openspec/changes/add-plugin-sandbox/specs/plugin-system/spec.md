# plugin-system Specification

## ADDED Requirements

### Requirement: Plugin Process Isolation

插件 MUST 在**受限子进程**中执行，MUST NOT 与宿主同进程。宿主 MUST 在启动插件前探测
运行时的权限模型可用性；探测失败时 MUST 拒绝启动插件，MUST NOT 静默退回同进程加载。

#### Scenario: 文件与子进程能力被关死

**Given** 一个声明了合法能力的插件
**When** 它在插件进程内尝试读取 allowlist 之外的文件、创建子进程或 worker
**Then** 运行时 SHALL 抛出访问拒绝错误
**And** 该调用 MUST NOT 到达宿主

#### Scenario: 运行时权限模型不可用

**Given** 宿主运行在缺少权限模型的 Node 版本上
**When** 请求加载插件
**Then** 加载 SHALL 失败并说明原因
**And** MUST NOT 以同进程方式加载插件作为退化路径

### Requirement: Plugin Capability Mediation

插件的能力 MUST 由其清单声明；MUST NOT 存在"声明之外仍可执行"的路径。
每一次能力调用 SHALL 逐项校验声明（all-of），缺任一项即拒，且拒绝原因 MUST 指明缺哪条声明。

#### Scenario: 未声明的数据访问

**Given** 清单只声明了 `database.tables: ["orders"]` 与 `operations: ["read"]`
**When** 插件向另一张表发起写操作
**Then** 该调用 SHALL 被拒
**And** 错误 SHALL 指明缺失的声明项
**And** MUST NOT 以"降级为只读"或其他方式继续执行

#### Scenario: 插件的 HTTP 与模块能力

**Given** 清单未声明 `api.endpoints` 或 `modules.extend`
**When** 插件请求调用宿主端点或扩展模块
**Then** 请求 SHALL 被拒

### Requirement: Plugin Audit Trail

插件的激活、调用、越权拒绝与安全信号 MUST 写入同一条审计出口，
且 MUST 记录插件 id、版本与清单摘要，使"这个插件做过什么"可被事后还原。

#### Scenario: 越权也留痕

**Given** 一次被拒的能力调用
**When** 审计被写入
**Then** 记录 SHALL 包含插件 id、被拒的声明项与失败状态

## MODIFIED Requirements

### Requirement: Plugin Static Safety Signal

源码文本扫描 MUST NOT 作为安全判决：命中 SHALL 只写入审计信号供审查，
MUST NOT 阻断安装或执行。安全边界 MUST 由进程隔离与能力中介提供。

#### Scenario: 命中文本扫描不阻断

**Given** 插件源码里出现了被扫描规则命中的字符串（例如注释中的 `require('fs')`）
**When** 安装该插件
**Then** 安装 SHALL 成功
**And** 审计 SHALL 记录一条安全信号

#### Scenario: 绕过文本扫描也无法越权

**Given** 一个把模块名拼接起来以避开扫描规则的插件
**When** 它尝试读取文件
**Then** 调用 SHALL 因进程边界被拒
**And** 这 MUST NOT 依赖文本扫描是否命中
