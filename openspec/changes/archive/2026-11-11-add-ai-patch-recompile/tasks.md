## 1. Patch 应用器

- [x] 1.1 `definition-patch.service.ts`：object 字段 add/update/remove
- [x] 1.2 state 状态/迁移 add/update/remove
- [x] 1.3 不支持 scope 明确拒绝；L3 拒绝；L2 需要 confirmed
- [x] 1.4 单测覆盖正例/负例/非法目标

## 2. 服务端接线

- [x] 2.1 `AIModulesService.persistDefinitionAsBlueprint` 抽取，generateFromDefinition 复用
- [x] 2.2 `applyDefinitionPatch(moduleId, patch, org, confirmed)`：load definition → apply → bump version → 产包/编译
- [x] 2.3 `POST /ai-modules/:id/patches/apply` 端点
- [x] 2.4 patch 历史写入 `module.metadata.patches`

## 3. 验收

- [x] 3.1 单测：object/state patch 后定义变化正确
- [x] 3.2 单测：不支持 scope / L3 / 未确认 L2 → 400
- [x] 3.3 单测：apply 后调用产包服务且版本 bump
- [x] 3.4 `apps/api` 全量 jest 绿；build / check:all / lint:boundaries 0 error
- [x] 3.5 证据：`definition-patch` 7 例、`applyDefinitionPatchToModule` 1 例；apply 后版本 1.0.0→1.0.1，产包服务收到 1.0.1
