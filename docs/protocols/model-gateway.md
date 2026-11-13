# Model Gateway Contract v1（冻结）

> 权威形状：[`schemas/model-gateway.schema.json`](../../schemas/model-gateway.schema.json)
> 正负例：[`fixtures/schemas/model-gateway/`](../../fixtures/schemas/model-gateway/)
> 实现：`apps/api/src/ai-models/model-gateway.service.ts`

## 1. 请求

```json
{
  "task": "intent | design | vision | evaluation",
  "modelId": "optional explicit model",
  "messages": [{ "role": "system|user|assistant", "content": "..." }],
  "maxTokens": 2000,
  "temperature": 0.2,
  "timeoutMs": 20000,
  "metadata": { "organizationId": "..." }
}
```

- `task` 按 `AGENT_MODEL_PROFILE_<TASK>` 选模型；显式 `modelId` 优先。
- 消费方不拼 provider URL/headers，不接触密钥。

## 2. 响应与 trace

```json
{
  "text": "normalized text",
  "raw": {},
  "provider": "deepseek",
  "model": "deepseek-chat",
  "modelRowId": "uuid",
  "trace": {
    "requestId": "uuid",
    "provider": "deepseek",
    "model": "deepseek-chat",
    "resolvedModelId": "uuid",
    "requestedModelId": "uuid|null",
    "credentialSource": "secret-ref | legacy-inline",
    "latencyMs": 12
  }
}
```

- `requestedModelId` 是调用方请求的模型；`resolvedModelId` 是实际使用的模型。
- trace 与 `ai_model_calls` 都不保存密钥。
- stream chunk 形如 `{ delta, done, trace }`；不支持 SSE 时降级为单 chunk。

## 3. Secret reference

只允许：

```text
env:NAME        → process.env[NAME]
file:/abs/path  → 文件内容（trim）
```

- 不存明文密钥；旧内联 `apiKey` 只作兼容读取。
- 解析失败 fail-closed，不把空值当可用。
- 响应绝不回显 `apiKey`，只返回 `hasCredential` / `credentialSource`。

## 4. 兼容

`ai_model_calls` 与 trace 字段一旦发布即冻结；新增字段只能追加，不能改语义。
