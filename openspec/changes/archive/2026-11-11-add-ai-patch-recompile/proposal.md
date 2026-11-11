# Change: AI 修改在服务端应用并重编译

## Why

AI 的“修改”目前只生成 Patch DSL 写入 `ai_modules.patch_content`；真正的
`PatchManager` 在前端，只改浏览器 schema，不会更新服务端 Blueprint、不会重新编译、
不会产生新版本包。于是 AI 修改永远进不了运行时。

## What Changes

- **ADDED** `DefinitionPatchService`：把 Patch DSL 的 `object` / `state` 子集应用到
  六步定义（字段增删改、状态/迁移增删改）；`page` / `permission` / `menu` 明确拒绝
  （Blueprint 层没有对应语义，不能静默忽略）。
- **ADDED** `POST /ai-modules/:id/patches/apply`：应用 patch → 校验定义 → 版本号 bump →
  `definitionToBlueprint` → 产包 + 编译；L3 拒绝，L2 需要 `confirmed: true`。
- **MODIFIED** `AIModulesService.generateFromDefinition` 抽出 `persistDefinitionAsBlueprint`，
  apply-patch 复用同一产包路径。
- 旧 `modifyExistingModule` 仍只生成 patch（预览）；显式 apply 才会改服务端状态。

## Impact

- Affected specs: `ai-module-management`
- Affected code:
  - `apps/api/src/ai-modules/definition-patch.service.ts`
  - `apps/api/src/ai-modules/ai-modules.service.ts`
  - `apps/api/src/ai-modules/ai-modules.controller.ts`
- 兼容性：新增端点；现有 modify 生成行为不变。
- 不做的事：不做 page/menu/permission 的服务端 patch（Blueprint 不承载这些层）；
  不自动签名/激活。
