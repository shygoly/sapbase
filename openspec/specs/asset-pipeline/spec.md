# asset-pipeline Specification

## Purpose
TBD - created by archiving change add-asset-and-media-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Storage Abstraction and Tenant Isolation

平台 SHALL 通过统一的对象存储接口支持本地开发存储与 S3 兼容/OSS/MinIO 生产存储。
资产 MUST 绑定唯一组织（可再绑定应用），MUST NOT 跨租户读取、写入或复用签名 URL。
存储凭证 MUST 使用 secret 引用，MUST NOT 明文入库或回显。

#### Scenario: 跨租户访问被拒

- **WHEN** A 组织用户请求 B 组织的资产或签名 URL
- **THEN** 请求 SHALL 被拒绝
- **AND** MUST NOT 返回任何对象元数据或内容

#### Scenario: 切换存储 provider

- **WHEN** 平台从本地存储切换为 S3 兼容存储
- **THEN** 新上传 SHALL 使用新 provider
- **AND** 旧资产 URL 仍可通过兼容路径访问

### Requirement: Resumable Upload Sessions

平台 SHALL 支持分片/断点续传上传，MUST 记录上传会话、已上传分片、校验和与过期时间。
完成上传 MUST 校验大小、分片与校验和；不匹配 MUST 拒绝。
重复 complete MUST 幂等，不得产生重复资产。

#### Scenario: 断点续传

- **WHEN** 客户端上传部分分片后中断，再以同一上传会话继续
- **THEN** 系统 SHALL 返回已上传分片并允许续传
- **AND** 已上传分片 MUST NOT 被重复计费/覆盖

#### Scenario: 校验和不匹配

- **WHEN** 完成上传时校验和与服务端计算不一致
- **THEN** 上传 SHALL 失败
- **AND** MUST NOT 创建可用资产

### Requirement: Asset Registry and Metadata

系统 SHALL 持久化资产元数据：类型、MIME、大小、校验和、原始文件名、状态、扫描结果、
宽高/时长/页数、标签、创建者、保留期。资产 MUST 有明确状态机，
只有 `ready` 资产可被业务引用。

#### Scenario: 上传后进入扫描

- **WHEN** 上传完成
- **THEN** 资产状态 SHALL 从 `uploading` 进入 `scanning`/`processing`
- **AND** 在 `ready` 前业务 MUST NOT 引用该资产

#### Scenario: 元数据可查询

- **WHEN** 查询资产列表
- **THEN** 结果 SHALL 包含类型、大小、MIME、状态与创建者
- **AND** 查询 SHALL 受组织与权限约束

### Requirement: Processing Pipeline and Fail-Closed

平台 SHALL 通过异步任务执行 MIME 嗅探、病毒扫描、图片裁剪/缩略图、文档预览、
音频/视频转码与水印钩子。扫描/处理失败 MUST 标记为 `failed` 或 `quarantined`，
MUST NOT 静默降级为原始文件；`infected` 资产 MUST NOT 可下载。

#### Scenario: 病毒扫描失败

- **WHEN** 扫描 provider 返回 infected 或异常
- **THEN** 资产 SHALL 被隔离
- **AND** 业务读取/下载 SHALL 被拒绝

#### Scenario: 视频转码

- **WHEN** 上传 MP4 且请求 HLS 变体
- **THEN** 系统 SHALL 异步生成 HLS/缩略图
- **AND** 生成完成前只返回原始可播放变体或 `processing`

### Requirement: Access Control and Signed URLs

资产默认私有；访问 MUST 同时满足租户隔离、业务记录权限/数据范围、资产状态 `ready`。
签名 URL MUST 短时有效并绑定组织（可选用户/应用），MUST NOT 永久公开。
视频 MUST 支持 Range/串流；公开资产 MUST 显式标记。

#### Scenario: 签名 URL 过期

- **WHEN** 使用已过期签名 URL 访问资产
- **THEN** 请求 SHALL 被拒绝
- **AND** MUST NOT 返回对象内容

#### Scenario: 业务记录越权

- **WHEN** 用户能访问资产 URL 但无权访问引用它的业务记录
- **THEN** 通过业务接口读取 SHALL 被拒绝
- **AND** 不得仅凭 URL 绕过记录权限

### Requirement: Quotas and Retention

平台 SHALL 按组织/应用限制单文件、单次总量、总存储与并发上传，并提供用量查询。
超限 MUST 拒绝新上传并返回明确错误；保留期到期 MUST 软删除/清理，
MUST NOT 静默删除仍被引用的资产。

#### Scenario: 超出总存储配额

- **WHEN** 组织总存储达到配额
- **THEN** 新上传 SHALL 被拒绝
- **AND** 错误 SHALL 包含已用量与上限

#### Scenario: 被引用资产到期

- **WHEN** 资产到达保留期但仍被业务记录引用
- **THEN** 系统 SHALL 延迟物理删除或要求显式迁移
- **AND** MUST NOT 让业务记录出现悬空引用

### Requirement: Backward Compatibility

本能力 MUST NOT 破坏现有品牌图片上传与 `/uploads/...` URL。
旧 `StorageService` 入口 MUST 继续可用；旧 URL 文本字段 MUST 继续可读。
新实体 MAY 使用 `asset` 字段类型。

#### Scenario: 旧品牌图片上传

- **WHEN** 管理员上传品牌 Logo
- **THEN** 上传 SHALL 成功
- **AND** 旧 URL 行为 SHALL 保持不变

#### Scenario: 旧 URL 文本字段

- **WHEN** 读取仍存 URL 文本的旧记录
- **THEN** 字段 SHALL 正常返回
- **AND** MUST NOT 因未使用 `asset` 类型而失败

