## ADDED Requirements

### Requirement: Offline Package Manifest

系统 SHALL 生成可签名、可版本化的离线包 manifest，包含包 ID/版本、资产列表、
变体、大小、校验和、标识/水印、过期时间与签名。
客户端 MUST 校验签名、过期、包/组织/设备绑定；失败 MUST 拒绝使用。

#### Scenario: 下载前校验 manifest

- **WHEN** 客户端获取离线包 manifest
- **THEN** 系统 SHALL 提供签名与校验和
- **AND** 客户端校验失败 MUST NOT 播放

#### Scenario: manifest 篡改

- **WHEN** manifest 或资产被篡改
- **THEN** 校验 SHALL 失败
- **AND** 客户端 MUST 拒绝/清理

### Requirement: Entitlement and Device Binding

下载/离线播放 MUST 校验用户、组织、课程、设备与授权有效期。
授权 MUST 支持设备上限、换设备与撤销；跨用户/跨租户 MUST 拒绝。

#### Scenario: 设备上限

- **WHEN** 用户已在最大设备数上授权
- **THEN** 新设备下载 SHALL 被拒绝或要求先撤销旧设备
- **AND** 行为 SHALL 可配置

#### Scenario: 跨租户

- **WHEN** A 组织用户请求 B 组织离线包
- **THEN** 请求 SHALL 被拒绝
- **AND** MUST NOT 返回 manifest/资产

### Requirement: Download and Resume

下载 SHALL 支持分片/Range、暂停、继续、取消、批量与断点续传；
完成 MUST 校验资产大小/校验和。失败 MUST 可重试，MUST NOT 留下损坏缓存。

#### Scenario: 断点续传

- **WHEN** 下载中断后恢复
- **THEN** 客户端 SHALL 从已完成分片继续
- **AND** 最终校验和 SHALL 通过

#### Scenario: 批量下载

- **WHEN** 用户一次选择 5 个视频
- **THEN** 系统/客户端 SHALL 支持批量队列
- **AND** 可暂停/取消单个任务

### Requirement: Offline Playback and Preferences

离线播放 SHALL 使用本地 manifest/资产，MUST 校验授权/过期/用户隔离；
播放倍速/清晰度偏好 MUST 按用户保存并在后续播放生效。

#### Scenario: 断网播放

- **WHEN** 设备无网络且授权未过期
- **THEN** 已下载内容 SHALL 可播放
- **AND** 标识/水印 SHALL 显示

#### Scenario: 偏好保存

- **WHEN** 用户设置默认倍速/清晰度
- **THEN** 后续离线播放 SHALL 使用该偏好
- **AND** 不影响其他用户

### Requirement: Expiry and Revocation

离线授权/manifest SHALL 支持过期与撤销；过期/撤销后 MUST 不可继续播放/续期。
联网时 MUST 校验最新状态；客户端 SHALL 按策略清理本地缓存。

#### Scenario: 授权过期

- **WHEN** 离线授权超过 `expiresAt`
- **THEN** 播放 SHALL 被拒绝
- **AND** 客户端 SHALL 提示/清理

#### Scenario: 管理员撤销

- **WHEN** 管理员撤销用户/设备/包授权
- **THEN** 联网客户端 SHALL 收到并停止播放
- **AND** 本地缓存 SHALL 按策略清理

### Requirement: Labels and Watermark Preservation

AI 生成内容的显式/隐式标识 MUST 在离线 manifest、下载、缓存、播放链路保留。
MUST NOT 因离线/转码/导出丢失标识；缺失 MUST 阻断播放或标记异常。

#### Scenario: 离线标识

- **WHEN** 下载 AI 生成视频
- **THEN** manifest/文件 SHALL 含标识
- **AND** 播放器 SHALL 显示显式标识

#### Scenario: 标识缺失

- **WHEN** 离线资产标识校验失败
- **THEN** 播放 SHALL 被拒绝或提示
- **AND** MUST NOT 静默播放无标识内容

### Requirement: User Isolation and Security

离线缓存/授权/偏好 MUST 按用户/设备隔离；MUST NOT 让其他用户读取。
下载 MUST 使用短期令牌/签名 URL，MUST NOT 暴露永久对象地址；
可选本地加密；审计授权/撤销/下载。

#### Scenario: 跨用户缓存

- **WHEN** 另一用户尝试读取同一设备上的缓存
- **THEN** 访问 SHALL 被拒绝
- **AND** 缓存 MUST 按用户隔离

#### Scenario: 永久 URL

- **WHEN** 下载使用过期/伪造令牌
- **THEN** 请求 SHALL 被拒绝
- **AND** MUST NOT 返回资产

### Requirement: Backward Compatibility

本能力 MUST NOT 改变在线播放、资产上传、旧客户端行为。
离线为可选能力；未启用时 MUST NOT 产生离线包/授权。

#### Scenario: 未启用离线

- **WHEN** 组织未启用离线包
- **THEN** 在线播放/资产行为 SHALL 不变
- **AND** MUST NOT 产生离线授权

#### Scenario: 旧客户端

- **WHEN** 旧客户端只使用在线播放
- **THEN** 行为 SHALL 与升级前一致
- **AND** 不要求 manifest
