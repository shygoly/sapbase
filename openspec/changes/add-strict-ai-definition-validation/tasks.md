## 1. 六步 Schema

- [x] 1.1 `schemas/ai-definition-object-model.schema.json`
- [x] 1.2 `schemas/ai-definition-relationships.schema.json`
- [x] 1.3 `schemas/ai-definition-state-flow.schema.json`
- [x] 1.4 `schemas/ai-definition-pages.schema.json`
- [x] 1.5 `schemas/ai-definition-permissions.schema.json`
- [x] 1.6 `schemas/ai-definition-reports.schema.json`
- [x] 1.7 `definition-schema.ts`：stepId → schema，`validateDefinitionStep` / `assertDefinitionStep`
- [x] 1.8 `generateDefinitionStep`、`generateAllDefinitionSteps`、`saveDefinition` 全部接入

## 2. AI 响应提取

- [x] 2.1 `ai-response.ts`：统一提取 Kimi / OpenAI / nested 响应；失败抛错
- [x] 2.2 `generatePatch` / `modifyExistingModule` / DDD `AIModelService` 去掉默认空 patch
- [x] 2.3 单测：无 JSON / 非法 JSON / 非对象 → 报错；合法响应 → 正常解析

## 3. 定义 → Blueprint

- [x] 3.1 `normalizeDefinitionShape`：扁平 wizard 载荷与嵌套载荷统一
- [x] 3.2 `definitionToBlueprint` 使用规范化输入
- [x] 3.3 `generateFromDefinition` 改为确定性转换，不再调用 LLM
- [x] 3.4 `patchContent` 保留 `objects` + semantic/flows/rules/experience
- [x] 3.5 单测：扁平载荷可转换；缺状态机/非法字段给出明确 reason

## 4. 验收

- [x] 4.1 `apps/api` 全量 jest 绿
- [x] 4.2 `npm run build --workspace @sap/api` 通过
- [x] 4.3 `npm run check:all` / `check:boundaries` / `lint:boundaries` 0 error
- [x] 4.4 文档：`apps/api/docs/ai-modules-database-and-security.md` 更新「六步定义如何校验」与确定性 Blueprint 产物；spec 变更见本 change 的 delta
