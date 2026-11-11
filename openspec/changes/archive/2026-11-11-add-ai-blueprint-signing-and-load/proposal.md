# Change: AI Blueprint 签名、授权与装载验证

## Why

AI 定义现在能产出并编译 `.erpkg`，但 AI 包没有 license/签名，`BlueprintService.load`
在生产会因缺少 `license.json`/签名而拒绝。也就是说：能编译，还不能合法装载。

## What Changes

- **ADDED** `BlueprintService.deliverPackage(packageId, licenseInput)`：对**已有包**补
  `license.json`、重新打包、编译盖章、Ed25519 签名；复用 `deliver` 的固定顺序。
- **REFACTOR** `deliver` 抽出 `deliverDirectory`，模板交付与已有包交付共用同一实现。
- **ADDED** `AIModuleBlueprintService.deliver/load`：对 AI 包签名并按租户装载验证。
- **ADDED** `POST /ai-modules/:id/blueprint/deliver`：传入 `grantedTo` / `expiresAt` /
  `issuer` / `resell`；成功后写 `metadata.blueprint.signedAt` / `loadedAt` / `grantedTo`。
- 不自动激活业务应用；激活仍走 installation/release。

## Impact

- Affected specs: `ai-module-management`
- Affected code:
  - `libs/platform-release/src/blueprint/blueprint.service.ts`
  - `apps/api/src/ai-modules/ai-module-blueprint.service.ts`
  - `apps/api/src/ai-modules/ai-modules.service.ts`
  - `apps/api/src/ai-modules/ai-modules.controller.ts`
- 兼容性：现有 `deliver(templateId)` 行为不变。
- 安全：生产仍要求 `BLUEPRINT_LICENSE_PRIVATE_KEY` 与 `BLUEPRINT_LICENSE_PUBLIC_KEYS`；
  未配置即失败，不静默放行。
