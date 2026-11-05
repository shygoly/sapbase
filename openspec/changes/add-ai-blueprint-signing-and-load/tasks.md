## 1. Blueprint 交付重构

- [x] 1.1 抽出 `deliverDirectory(staging, licenseInput, targetPackagePath?)`
- [x] 1.2 `deliver(templateId)` 复用，行为不变
- [x] 1.3 `deliverPackage(packageId, licenseInput)`：解包 → 临时目录 → 补 license → 重打包/编译/签名
- [x] 1.4 交付后 `invalidate(packageId)`

## 2. AI 接线

- [x] 2.1 `AIModuleBlueprintService.deliver/load`
- [x] 2.2 `AIModulesService.deliverBlueprint`：签名 → 按租户 load → 写 metadata
- [x] 2.3 `POST /ai-modules/:id/blueprint/deliver`
- [x] 2.4 缺私钥/公钥/未授权租户 → 明确失败

## 3. 验收

- [x] 3.1 单测：已有包重签后可被 `loadBlueprint` 按租户装载
- [x] 3.2 单测：模板 `deliver` 既有用例仍绿
- [x] 3.3 单测：AI deliver 写入 signedAt/loadedAt，load 失败不写
- [x] 3.4 `apps/api` 全量 jest 绿；build / check:all / lint:boundaries 0 error
- [x] 3.5 证据：`deliverPackage` 重签后 org-b 装载成功、org-a 被拒；AI `deliverBlueprint` 写入 signedAt/loadedAt，load 失败不写；模板 deliver 既有 6 例仍绿
