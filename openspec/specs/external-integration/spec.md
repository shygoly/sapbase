# external-integration Specification

## Purpose
TBD - created by archiving change add-external-integration-connector. Update Purpose after archive.
## Requirements
### Requirement: Connector Registry and Secrets

平台 SHALL 提供按组织/应用隔离的连接器注册（REST / Webhook / Database）。
连接器 MUST 有唯一 key、类型、配置、状态与 secret 引用；凭证 MUST NOT 明文入库或回显。
连接器管理 MUST 需要专门权限并写审计。

#### Scenario: 创建连接器

- **WHEN** 管理员创建 REST 连接器并引用 secret
- **THEN** 系统 SHALL 保存配置与引用
- **AND** 响应 MUST NOT 返回密钥明文

#### Scenario: 越权管理

- **WHEN** 无 `integrations:manage` 权限的用户创建/修改连接器
- **THEN** 请求 SHALL 返回 403

### Requirement: Outbound REST/Webhook Delivery

出站调用 SHALL 支持认证、headers、超时、限流、幂等键、重试/退避、DLQ 与熔断。
4xx（除 408/429）MUST NOT 无限重试；5xx/超时/限流 MUST 按策略重试。
每次调用 MUST 记录状态、尝试次数、响应摘要与错误（脱敏）。

#### Scenario: 5xx 重试

- **WHEN** 外部系统返回 500
- **THEN** 系统 SHALL 按退避重试
- **AND** 超过上限进入 DLQ

#### Scenario: 4xx 不重试

- **WHEN** 外部系统返回 400
- **THEN** 系统 SHALL 标记失败/死信
- **AND** MUST NOT 无限重试

#### Scenario: 幂等

- **WHEN** 同一事件用同一幂等键重复投递
- **THEN** 外部系统 SHALL 只收到一次有效副作用（配合幂等键）
- **AND** 平台 MUST NOT 创建重复消息

### Requirement: Inbound Webhook Verification

入站 Webhook SHALL 校验签名与时间戳，支持幂等 eventId、payload hash、映射与重放。
签名错误/过期/重复/超大 payload MUST 被拒绝或去重；未知事件 MUST NOT 静默丢弃。

#### Scenario: 签名错误

- **WHEN** Webhook 签名不匹配
- **THEN** 请求 SHALL 被拒绝
- **AND** 记录安全事件

#### Scenario: 重复事件

- **WHEN** 同一 eventId 重复到达
- **THEN** 系统 SHALL 只处理一次
- **AND** 返回幂等结果

### Requirement: Database Connector Read-Only Access

数据库连接器 MUST 使用只读账号、最小权限、TLS 与 IP allowlist；
MUST NOT 修改源库、执行 DDL/DML 或任意 SQL。查询 MUST 来自受控模板并参数化。

#### Scenario: 只读连接

- **WHEN** 连接器执行同步查询
- **THEN** 只能执行白名单查询模板
- **AND** 任何写操作 MUST 被拒绝

#### Scenario: 注入尝试

- **WHEN** 参数中包含 SQL/注入片段
- **THEN** 系统 SHALL 参数化/拒绝
- **AND** MUST NOT 拼接执行

### Requirement: Field Mapping and Incremental Sync

同步 SHALL 支持声明式字段映射、类型转换、默认值、必填与枚举映射；
MUST 支持游标/水位增量、批量、断点续跑与幂等写入。
无游标时 MUST 要求 full 模式并提示风险。

#### Scenario: 增量同步学生

- **WHEN** 按 `updatedAt` 水位同步学生
- **THEN** 只拉取水位之后的变更
- **AND** 成功后更新水位

#### Scenario: 重复同步

- **WHEN** 同一批数据重复同步
- **THEN** 目标数据 MUST NOT 重复
- **AND** 按唯一键/导入适配器幂等

### Requirement: Retry, DLQ, and Reconciliation

同步/投递失败 SHALL 可重试并保留错误；超过上限 MUST 进入 DLQ。
系统 MUST 提供源/目标计数、校验和与差异报告；差异超阈值 MUST 告警。
MUST NOT 静默跳过失败行。

#### Scenario: 对账差异

- **WHEN** 源 1000 行、目标 998 行
- **THEN** 系统 SHALL 报告差异
- **AND** 告警/支持重跑

#### Scenario: DLQ 重放

- **WHEN** 管理员重放死信
- **THEN** 消息/同步 SHALL 重新执行
- **AND** 重放写审计

### Requirement: Security and SSRF

出站 URL/数据库主机 MUST 走 allowlist；私网/元数据地址默认拒绝；
MUST NOT 跟随重定向到未授权地址。凭证/TLS/PII MUST 受保护；
所有连接器变更、调用、同步与失败 MUST 写审计。

#### Scenario: SSRF 尝试

- **WHEN** 出站 URL 指向元数据/未授权私网地址
- **THEN** 请求 SHALL 被拒绝
- **AND** 记录安全事件

#### Scenario: 凭证泄露

- **WHEN** 查看连接器详情/日志
- **THEN** 密钥 MUST 被脱敏
- **AND** 只有授权角色能看到必要信息

### Requirement: External System Authentication

外部系统调用平台 SHALL 使用服务令牌/委托身份，绑定组织（可再绑定应用）与 scope。
平台 MUST 二次校验功能权限与数据范围；MUST NOT 信任调用方传入的权限声明。

#### Scenario: 服务令牌调用

- **WHEN** 外部系统用服务令牌调用受保护 API
- **THEN** 平台 SHALL 校验 token/scope/组织
- **AND** 代用户调用时重新解析用户权限

#### Scenario: 越权 scope

- **WHEN** token 缺少目标 API scope
- **THEN** 调用 SHALL 返回 403

### Requirement: Audit and Observability

连接器/同步/投递 MUST 提供状态、尝试次数、耗时、成功率、差异与 DLQ 指标；
关键操作 MUST 审计。超过阈值（失败率/积压/差异）MUST 告警。

#### Scenario: 同步失败告警

- **WHEN** 连续同步失败或差异超阈值
- **THEN** 系统 SHALL 告警
- **AND** 管理员 SHALL 能查看运行详情

### Requirement: Backward Compatibility

本能力 MUST NOT 改变内部 outbox、cron、现有同步导入接口与 MCP 工具面。
连接器为可选；未配置时 MUST NOT 产生外部调用。

#### Scenario: 未配置连接器

- **WHEN** 组织没有任何外部连接器
- **THEN** 内部 outbox/导入行为 SHALL 不变
- **AND** MUST NOT 产生外部请求

#### Scenario: 旧导入接口

- **WHEN** 调用方使用旧导入接口
- **THEN** 行为 SHALL 与升级前一致
- **AND** 不强制走连接器

