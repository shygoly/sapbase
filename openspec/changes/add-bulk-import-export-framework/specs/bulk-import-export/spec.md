## ADDED Requirements

### Requirement: Resource Adapters and Templates

平台 SHALL 通过资源适配器支持通用导入/导出；每个资源 MUST 声明可导入/导出的字段、
必填/类型/枚举/引用/示例。系统 MUST 能生成对应模板。
未知资源键或未注册适配器 MUST 被拒绝。

#### Scenario: 生成导入模板

- **WHEN** 用户请求某 Blueprint 实体的导入模板
- **THEN** 系统 SHALL 返回含表头、必填标记与示例的 xlsx/csv
- **AND** 字段 MUST 与该实体声明一致

#### Scenario: 未知资源

- **WHEN** 请求未注册资源的导入/导出
- **THEN** 请求 SHALL 被拒绝并指明资源键

### Requirement: Import Formats

导入 SHALL 支持 CSV、XLSX、JSON；解析 MUST 校验表头、列映射、类型与行号。
XLSX MUST 限制解压大小、sheet 数、行数与宏/外部链接；超限 MUST 拒绝。

#### Scenario: XLSX 知识点导入

- **WHEN** 上传包含 100 行的 xlsx 知识点模板
- **THEN** 系统 SHALL 解析并逐行校验
- **AND** 错误 SHALL 带 sheet/行号/列

#### Scenario: 恶意 XLSX

- **WHEN** 上传包含宏、外部链接或超限解压内容的 xlsx
- **THEN** 系统 SHALL 拒绝解析
- **AND** MUST NOT 执行宏/外部请求

### Requirement: Validation and Partial Success

导入 MUST 在写入前逐行校验必填、类型、枚举、引用、唯一性、字段权限与数据范围。
系统 SHALL 支持 `atomic`（任一行失败整批回滚）与 `partial`（成功行落库、失败行返回）
两种模式，并支持 dry-run。

#### Scenario: 部分成功

- **WHEN** 100 行中 3 行校验失败且模式为 partial
- **THEN** 97 行 SHALL 落库
- **AND** 3 行错误 SHALL 带行号与原因
- **AND** 汇总 SHALL 给出成功/失败数

#### Scenario: 原子模式回滚

- **WHEN** 模式为 atomic 且任一行失败
- **THEN** 整批 MUST NOT 落库
- **AND** 返回失败行

### Requirement: Async Import Runs

大导入 SHALL 通过异步任务执行，提供状态、进度、取消、重试、历史与错误报告下载。
运行 MUST 绑定组织、资源、操作者与幂等键；重复提交 MUST 返回同一运行。

#### Scenario: 大导入异步执行

- **WHEN** 上传超过同步阈值的文件
- **THEN** 系统 SHALL 创建 import run 并返回任务 ID
- **AND** 客户端 SHALL 能查询进度与最终结果

#### Scenario: 重复提交

- **WHEN** 使用同一幂等键重复创建导入
- **THEN** 系统 SHALL 返回同一运行
- **AND** MUST NOT 重复写入

### Requirement: Export Formats and Field Selection

导出 SHALL 支持 CSV、XLSX、PDF、MD，并允许选择字段、筛选与排序。
导出字段 MUST 受字段读权限约束；无权限字段 MUST 被拒绝或省略（按配置），
MUST NOT 通过导出绕过字段权限。

#### Scenario: 自定义字段导出

- **WHEN** 用户选择部分字段导出
- **THEN** 结果文件 SHALL 只含所选字段
- **AND** 无读权限字段 MUST NOT 出现

#### Scenario: 多格式导出

- **WHEN** 用户选择 PDF 导出
- **THEN** 系统 SHALL 生成 PDF 文件
- **AND** 表头/分页 SHALL 可读

### Requirement: Async Export and Download

大导出 SHALL 通过异步任务执行，分页/流式查询，每页 MUST 应用数据范围；
结果 MUST 存为受权限约束的资产，并提供短时签名下载与过期清理。
导出 MUST 记录操作者、资源、筛选、字段、行数与下载审计。

#### Scenario: 一万行异步导出

- **WHEN** 用户导出 1 万行数据
- **THEN** 系统 SHALL 异步生成文件
- **AND** 完成后返回签名下载 URL
- **AND** 行数与筛选条件 SHALL 可查

#### Scenario: 数据范围生效

- **WHEN** 用户只被授权到某班级/院系
- **THEN** 导出结果 MUST 只含该范围
- **AND** 不得因导出绕过范围

### Requirement: Permissions and Tenant Isolation

导入/导出 MUST 校验功能权限、字段权限、数据范围与租户隔离。
运行记录与结果资产 MUST 绑定组织；跨租户访问 MUST 被拒绝。

#### Scenario: 跨租户导出

- **WHEN** A 组织用户请求 B 组织的导出结果
- **THEN** 请求 SHALL 被拒绝
- **AND** 签名 URL MUST NOT 可用

#### Scenario: 无导出权限

- **WHEN** 用户缺少资源的导出权限
- **THEN** 请求 SHALL 返回 403
- **AND** MUST NOT 创建导出任务

### Requirement: Security

导入/导出 MUST 防护公式注入、恶意文件、超大载荷与敏感数据泄露。
导出单元格以 `= + - @` 开头时 MUST 转义；敏感字段 MAY 脱敏或禁止导出。

#### Scenario: 公式注入

- **WHEN** 导出值以 `=` 开头
- **THEN** 单元格 SHALL 被转义
- **AND** 打开文件 MUST NOT 执行公式

#### Scenario: 敏感字段

- **WHEN** 用户尝试导出被标记为敏感/禁止导出的字段
- **THEN** 请求 SHALL 被拒绝或字段被省略
- **AND** 行为 SHALL 写入审计

### Requirement: History and Retention

系统 SHALL 保留导入/导出运行历史、错误报告与结果文件，并按配置过期清理。
被引用的结果 MUST NOT 被静默删除；下载 MUST 受权限与有效期约束。

#### Scenario: 历史可查

- **WHEN** 用户查看导入/导出历史
- **THEN** 结果 SHALL 包含状态、行数、操作者、时间与下载入口
- **AND** 过期结果 SHALL 标记或清理

### Requirement: Backward Compatibility

本能力 MUST NOT 破坏现有 `POST /semantic/:id/import/:entity` 与审计导出行为。
旧接口 MUST 继续可用；新能力逐步接入，不强制迁移历史数据。

#### Scenario: 旧导入接口

- **WHEN** 调用方使用旧导入接口
- **THEN** 行为 SHALL 与升级前一致
- **AND** MUST NOT 要求新模板/新参数

#### Scenario: 旧审计导出

- **WHEN** 调用方使用审计 CSV/JSON 导出
- **THEN** 行为 SHALL 保持不变
- **AND** 可选择走新框架但不强制
