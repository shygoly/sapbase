## 1. 产包服务

- [x] 1.1 `AIModuleBlueprintService.materialize(module, layers)`：writeBlueprintDir → packageFrom → compile(stamp)
- [x] 1.2 失败删除半成品 `.erpkg`
- [x] 1.3 `AIModulesModule` 导入 `BlueprintModule` 并注册服务

## 2. 接线

- [x] 2.1 `generateFromDefinition` 调用 materialize；写 `metadata.blueprint` + `patchContent.blueprint`
- [x] 2.2 `GET /ai-modules/:id/blueprint` 返回 packageId / irDigest
- [x] 2.3 `extractMetadataFromPatch` 同步 `blueprint` 到 module_registry metadata
- [x] 2.4 `module_registry.exportBlueprint` 优先返回真实包，旧模块回退骨架

## 3. 验收

- [x] 3.1 单测：materialize 走 packageFrom + compile，失败删包
- [x] 3.2 单测：generateFromDefinition 写入 packageId/irDigest
- [x] 3.3 单测：exportBlueprint 优先真实包
- [x] 3.4 `apps/api` 全量 jest 绿；build / check:all / lint:boundaries 0 error
- [x] 3.5 证据：`apps/api` 141 suites / 1031 tests 绿；真实 `BlueprintService` 产包并 `manifestOf` 校验 `compiled.irDigest`；exportBlueprint 真实包优先用例通过
