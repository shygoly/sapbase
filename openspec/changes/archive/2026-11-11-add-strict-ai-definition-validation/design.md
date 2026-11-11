## Context

AI 六步定义是 Blueprint 的作者侧输入。现状：

- `generateDefinitionStep` 只做 `extractJsonFromAiResponse`（正则 + `JSON.parse`）；
- `saveDefinition` 只对 step3 做 normalizer/validator；
- `generateFromDefinition` 让 LLM 生成 “Model DSL”，再套上 Patch 信封存进 `patchContent`；
- `definitionToBlueprint` 已实现完整转换与 Schema/冲突校验，但全仓无生产调用点；
- `extractPatchFromResponse` 解析失败时返回默认空 patch。

## Goals / Non-Goals

**Goals**

1. 六步输出在返回/入库前都过同一份 JSON Schema。
2. AI 定义到 Blueprint 的转换是确定性的，不依赖第二次 LLM 调用。
3. 解析失败显式报错，不产生“合法但空”的 patch。
4. 兼容现有 wizard 的扁平载荷与 `generate-all-steps` 的嵌套载荷。

**Non-Goals**

- 不定义新的 Model DSL 协议（本轮直接使用 Blueprint 层）。
- 不把 AI 输出直接变成运行期 SQL/代码。
- 不改 Patch DSL / Release 语义。

## Decisions

### D1. 六份独立 Schema，而不是一个巨型 Schema

每一步的输出形状独立、可单独校验、可单独演进；`definition-schema.ts` 只维护
`stepId → schemaFile` 映射。校验统一用 `jsonschema` + `loadSchema`（与 Blueprint 同一套）。

### D2. `generateFromDefinition` 改成确定性转换

原实现让 LLM 把定义“再翻译一次”，产物没有 schema、也没有运行时消费者。改为：

```text
normalizeDefinitionShape → definitionToBlueprint → patchContent
```

`patchContent` 保留 `objects`（publish 的 metadata/capability 提取仍可用）以及
`semantic/flows/rules/experience`（预览与后续打包可直接用）。
失败抛 `BadRequestException`，带 `DefinitionToBlueprintError.reason`。

### D3. 失败必须显式

- `extractAiJsonObject` 在无文本 / 非 JSON / 非对象时抛错；
- `saveDefinition` 对每个非空步骤做 Schema 校验；
- 不再保留“默认空 patch”回退。

### D4. 兼容两种定义形状

- 嵌套：`{ objectModel, relationships, stateFlow, pages, permissions, reports }`
- 扁平：wizard 的 `{ entities, relationships, states, transitions, pages, rules, reports }`

`normalizeDefinitionShape` 把扁平形状补成 `objectModel` / `stateFlow`，不修改入参。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| 更严格的 Schema 拒绝原本能保存的输出 | 用户看到 400 | 错误带 stepId 与字段路径；prompt 已声明形状 |
| 确定性转换要求每个实体有状态机 | 简单定义可能被拒 | 与 Blueprint 协议一致（不编造默认态）；错误明确 |
| 旧 `ai_modules.patchContent` 是 Patch 形状 | 旧数据仍可读 | 新写入带 `objects` + Blueprint 层；读取方按存在字段兼容 |
| `generateFromDefinition` 不再用模型 | 预览内容变化 | 预览是确定性产物，更利于审计与复现 |
