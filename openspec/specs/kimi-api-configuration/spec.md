# kimi-api-configuration Specification

## Purpose
TBD - created by archiving change kimi-api-configuration. Update Purpose after archive.
## Requirements
### Requirement: Configure DeepSeek as Default AI Model

系统 SHALL 使用 DeepSeek（OpenAI 兼容）作为默认 AI 模型，凭据 MUST 只从环境变量读取。

#### Scenario: DeepSeek Model Configuration

- **WHEN** 系统初始化或 seed 默认模型
- **THEN** 系统 SHALL 创建 provider=`deepseek` 的模型配置
- **AND** API key SHALL 来自 `DEEPSEEK_API_KEY`，MUST NOT 写入仓库文件
- **AND** base URL SHALL 默认为 `https://api.deepseek.com/v1`（可由 `DEEPSEEK_BASE_URL` 覆盖）
- **AND** model SHALL 默认为 `deepseek-chat`（可由 `DEEPSEEK_MODEL` 覆盖）
- **AND** status SHALL 为 `active` 且 `isDefault=true`
- **AND** 旧 Kimi 模型 MAY 保留为 `inactive` 以便切回

#### Scenario: Model Appears in Admin Interface

- **WHEN** 管理员访问 `/admin/ai-models`
- **THEN** 系统 SHALL 展示 DeepSeek 模型配置
- **AND** SHALL 显示为 default / active
- **AND** SHALL 允许测试连接

#### Scenario: Provider-Aware Generation

- **WHEN** AI 模块生成或六步定义生成调用默认模型
- **THEN** DeepSeek/OpenAI provider SHALL 调用 `/chat/completions`
- **AND** Kimi/Anthropic provider SHALL 调用 `/v1/messages`
- **AND** 响应解析 SHALL 同时兼容 `choices[].message.content` 与 `content[].text`
- **AND** 模型返回的 `{"patch": {...}}` 包装 SHALL 被展开为 Patch DSL `payload`

#### Scenario: Connection Test

- **WHEN** 管理员测试 DeepSeek 模型连接
- **THEN** 系统 SHALL 发送最小 chat completion 请求
- **AND** 成功时 SHALL 更新 `lastTestedAt` 并保持 active
- **AND** 失败时 SHALL 标记 inactive 并返回可行动错误

