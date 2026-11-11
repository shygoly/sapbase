# Change: Configure Default AI Model (DeepSeek, replaced Kimi)

> 历史 change id 仍为 `kimi-api-configuration`；2026-11 起默认提供方切换为 DeepSeek，
> 本文件与 spec 已同步改写。真实 key 不落在仓库，只从环境变量读取。

## Why

要让 AI 模块的 Patch / Model DSL 生成可用，系统需要一个 active 且 default 的模型配置。
此前默认是 Kimi；现在统一改为 **DeepSeek（OpenAI 兼容）**，凭据只走环境变量，避免明文入库到仓库。

## What Changes

- **ADDED**：DeepSeek 模型配置（provider `deepseek`，OpenAI 兼容 `/chat/completions`）
- **CONFIGURED**：`isDefault=true` 且 `status=active`
- **MODIFIED**：模型调用统一走 `AIModelsService.generate`，按 provider 选择
  DeepSeek/OpenAI（`/chat/completions`）或 Kimi/Anthropic（`/v1/messages`）
- **ENABLED**：AI 模块生成（Patch DSL / 六步定义）与 `/admin/ai-models` 连接测试
- **SECURITY**：seed 与文档不包含真实 key，key 只从 `DEEPSEEK_API_KEY` 读取

## Configuration

| 项 | 值 |
|---|---|
| Provider | `deepseek` |
| Base URL | `https://api.deepseek.com/v1`（`DEEPSEEK_BASE_URL` 可覆盖） |
| Model | `deepseek-chat`（`DEEPSEEK_MODEL` 可覆盖） |
| API key | `DEEPSEEK_API_KEY`（env，不提交） |
| Status / Default | `active` / `true` |

## Impact

- **Affected specs**：`kimi-api-configuration`（本 change）
- **Affected code**：`apps/api/src/ai-models/ai-models.service.ts`、
  `apps/api/src/ai-modules/ai-modules.service.ts`、
  `apps/api/src/ai-module-context/infrastructure/external/ai-model.service.ts`、
  `apps/api/src/seeds/mock-data.seed.ts`
- **Breaking changes**：无（旧 Kimi 模型保留为 inactive，可随时切回）

## Success Criteria

- ✅ DeepSeek 模型配置在数据库且为 default/active
- ✅ `POST /api/ai-models/:id/test` 连接成功
- ✅ `POST /api/ai-modules/:id/generate` 用 DeepSeek 生成非空 Patch DSL
- ✅ `/admin/ai-models` 可查看/测试模型
- ✅ 仓库不包含任何明文 API key
