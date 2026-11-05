# Change: AI 定义产出可编译 Blueprint 包

## Why

`generateFromDefinition` 已能把六步定义确定性转换为 Blueprint 层，但只写入
`ai_modules.patch_content`，没有打包/编译；`module_registry.exportBlueprint` 又只从
实体名生成 `fields: []`、`states: [active]` 的骨架，AI 的字段/状态机/规则全部丢失。

结果：AI 定义“转换成功”，但没有可装载的 `.erpkg`，也不会进入 Blueprint 编译链。

## What Changes

- **ADDED** `AIModuleBlueprintService`：把 `BlueprintLayers` 写成目录 → `packageFrom` →
  `compile({ stamp: true })`，失败删除半成品包。
- **MODIFIED** `generateFromDefinition`：转换后立即产包并编译；把 `packageId` / `irDigest`
  写入 `module.metadata.blueprint` 与 `patchContent.blueprint`。
- **MODIFIED** `module_registry.exportBlueprint`：若模块已有 AI 产出的包，直接返回该包，
  不再生成丢字段的最小骨架；旧模块仍走骨架回退。
- **MODIFIED** publish metadata：把 `blueprint.packageId` 同步进 `module_registry.metadata`。
- **ADDED** `GET /ai-modules/:id/blueprint`：返回包 id、IR 摘要、是否可装载所需的元数据。

## Impact

- Affected specs: `ai-module-management`
- Affected code:
  - `apps/api/src/ai-modules/ai-module-blueprint.service.ts`
  - `apps/api/src/ai-modules/ai-modules.service.ts`
  - `apps/api/src/ai-modules/ai-modules.module.ts`
  - `apps/api/src/module-registry/module-registry.service.ts`
  - `apps/api/src/ai-module-context/infrastructure/external/module-registry.service.ts`
- 兼容性：旧模块没有 `metadata.blueprint` 时继续走最小骨架导出。
- 不做的事：不自动签名/授权；签名仍走 `BlueprintService.deliver` 与私钥流程。
