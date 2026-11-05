# Change: 严格校验 AI 模块定义并接通 Blueprint

## Why

当前 AI 六步定义只有 step3 有显式校验；其余五步只靠 prompt 与 `JSON.parse`。
`generateFromDefinition` 又把 “Model DSL” 当 Patch 信封处理，解析失败会静默返回空 patch，
且 `definitionToBlueprint`（真正带 Schema + 冲突检测的桥）没有任何生产调用点。

结果：AI 生成的 JSON 可以“看起来保存成功”，但既没有可验证的运行时语义，也没有进入
Blueprint 编译链。

## What Changes

- **ADDED** 六份 `ai-definition-*.schema.json`：object-model / relationships / state-flow /
  pages / permissions / reports。
- **ADDED** `definition-schema.ts`：按 stepId 做 JSON Schema 校验，`generateDefinitionStep`、
  `generateAllDefinitionSteps`、`saveDefinition` 都走同一份判据。
- **MODIFIED** `generateFromDefinition`：不再调用 LLM 生成未定义的 “Model DSL”，改为
  **确定性** `definitionToBlueprint`；产物写入 `patchContent`（含 `objects`/semantic/flows/
  rules/experience），并保存规范化定义。
- **MODIFIED** AI 响应提取：解析失败必须报错，不得返回默认空 patch；兼容 Kimi 与
  OpenAI 两种响应形状。
- **ADDED** `definitionToBlueprint` 接受扁平 wizard 载荷（`entities` / `states` /
  `transitions`）与嵌套六步载荷。
- 不改变 Blueprint 包格式与发布语义。

## Impact

- Affected specs: `ai-module-management`
- Affected code:
  - `schemas/ai-definition-*.schema.json`
  - `apps/api/src/ai-modules/{definition-schema.ts,ai-response.ts,definition-to-blueprint.ts,ai-modules.service.ts}`
  - `apps/api/src/ai-module-context/infrastructure/external/ai-model.service.ts`
- 行为变化：`generateFromDefinition` 不再产生随机 Model DSL，而是确定性 Blueprint 层；
  解析失败由静默降级改为 400。
- 不做的事：不新增视觉编辑器、不改变 Patch DSL、不把 AI 输出直接当可执行 SQL/代码。
