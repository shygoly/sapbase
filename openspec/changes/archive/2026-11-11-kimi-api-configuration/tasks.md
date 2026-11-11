# Implementation Tasks

> 历史 change id 仍为 `kimi-api-configuration`；默认提供方已切换为 DeepSeek。
> key 只从环境变量 `DEEPSEEK_API_KEY` 读取，不落仓库。

## 1. Database Configuration

- [x] 1.1 Create OpenSpec proposal
- [x] 1.2 Add DeepSeek model seed data to mock-data.seed.ts（env key，不写死）
- [x] 1.3 Set model as default and active（DeepSeek active/default，Kimi inactive）
- [x] 1.4 Upsert model to database

## 2. Verification

- [x] 2.1 Verify model appears in `/admin/ai-models`（API `GET /ai-models` 可见 DeepSeek）
- [x] 2.2 Test model connection（`POST /ai-models/:id/test` → success）
- [x] 2.3 Verify model is set as default（`GET /ai-models/default` → DeepSeek）
- [x] 2.4 Test patch generation（`POST /ai-modules/:id/generate` 返回非空 `patchContent.payload`）

## 3. Provider Abstraction

- [x] 3.1 `AIModelProvider.DEEPSEEK` + `AIModelsService.generate`（OpenAI 兼容）
- [x] 3.2 AI 模块三处生成调用统一走 provider 抽象（grep 无遗留 `/v1/messages`）
- [x] 3.3 连接测试按 provider 选择 endpoint
- [x] 3.4 移除仓库内明文 Kimi key（seed / proposal / README / spec 改为 `$KIMI_API_KEY`）
