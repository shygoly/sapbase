# 模型凭据的公开与内部边界

## ADDED Requirements

### Requirement: 模型对象的直接与嵌套响应均无秘密

平台 SHALL 对默认、列表、详情、创建/更新回执、连接测试及其他 API 嵌套的模型对象使用显式白名单公开 DTO，仅暴露非敏感配置和 hasApiKey 状态。包括管理员在内的客户端 MUST NOT 读取 apiKey、密文、credentialRef 或 config/baseUrl/上游异常中的秘密；秘密 MUST NOT 进入模型上下文、审计、日志或浏览器回填。

#### Scenario: 公开读取和表单正常编辑
- **WHEN** 授权用户读取已配置模型或打开编辑表单
- **THEN** 响应 SHALL 只含白名单字段与正确 hasApiKey
- **AND** 表单 SHALL 以空凭据输入显示已配置状态，不读取历史密钥

#### Scenario: 嵌套模型也不能泄露
- **WHEN** 用户读取或更新带 aiModel 关系的 AI 模块
- **THEN** 其中模型对象 SHALL 同样映射为公开 DTO
- **AND** 即使实体关系已加载凭据，响应 MUST NOT 直接序列化该秘密

#### Scenario: 敏感配置或异常不得绕过
- **WHEN** 管理员请求模型测试且 config、URL 或上游错误含认证信息
- **THEN** 平台 MUST 拒绝不安全公开配置或返回安全错误码/requestId
- **AND** 响应、日志与上下文 MUST NOT 带原始认证信息或凭据引用

### Requirement: 凭据只写并由服务端受控引用解析

模型配置 SHALL 仅保存受控凭据引用，只有获授权服务端模型适配器可解析实际凭据。更新省略 apiKey MUST 保留原引用，空白 key、越权写入、clearApiKey 与新 key 同时出现 MUST 拒绝。迁移/替换 SHALL 使用修订核对、先建后切和可追踪补偿，切换成功后撤销旧凭据；引用不可用 MUST 停止模型调用，MUST NOT 回退裸明文解析或公开读取。

#### Scenario: 授权替换和省略更新
- **WHEN** 管理员写新 key 并成功核对预期模型修订，或更新配置时省略 key
- **THEN** 前者 SHALL 切换到受控新引用并撤销旧凭据，后者 SHALL 保留现引用
- **AND** 内部适配器 SHALL 按授权解析，客户端回执与审计 SHALL 无秘密，输入状态 SHALL 被清理

#### Scenario: 非法写入或解析故障保持安全
- **WHEN** 收到空白/冲突/越权请求，或存储、加密根、修订切换、引用解析失败
- **THEN** 平台 MUST 拒绝请求或模型调用，保留原安全状态并处理孤立新引用
- **AND** MUST NOT 恢复 key 回读、明文兜底或浏览器凭据来换取可用性
