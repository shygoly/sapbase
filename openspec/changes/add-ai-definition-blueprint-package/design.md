## Context

AI 定义到 Blueprint 层的转换已完成；缺的是“层 → 包 → 编译”以及模块注册表对真实包的引用。
`BlueprintService` 已提供 `packageFrom` / `compile`，但没有 AI 侧调用方。

## Goals / Non-Goals

**Goals**

1. `generateFromDefinition` 成功后一定产出一个可编译包。
2. 模块记录能指回该包（id + IR 摘要）。
3. 导出模块时优先返回真实包。
4. 旧模块没有真实包时仍能导出最小骨架。

**Non-Goals**

- 不自动签名/授权（需要 `BLUEPRINT_LICENSE_PRIVATE_KEY` 与租户授权）。
- 不自动激活/装载到运行时（激活仍走 release/installation）。
- 不把包路径写进数据库（路径随部署变化，只存 packageId）。

## Decisions

### D1. 包 id = `blueprintIdentity(module.name, module.version)`

复用 `module-registry/blueprint-export` 的 kebab-case + semver 校验，避免 AI 模块名
产生非法 blueprint id。包写到 `BlueprintService` 的 packagesDir。

### D2. 编译失败删除半成品

`packageFrom` 成功后立即 `compile({ stamp: true })`；失败删除 `.erpkg`，避免留下
“能列出但不能编译”的包。

### D3. 元数据只用 packageId + irDigest

`module.metadata.blueprint = { packageId, irDigest, compiledAt }`。
不存绝对路径；包目录由 `BLUEPRINT_PACKAGES_DIR` 决定。

### D4. 导出优先真实包

`exportBlueprint` 先看 `metadata.blueprint.packageId`，文件存在则 `manifestOf` 返回；
否则走旧的最小骨架。这样 AI 模块导出不再丢字段。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| 编译依赖原子不可用 | 生成失败 | 编译失败即 400；不保存半成品 |
| 同名/同版本覆盖包 | 旧包被替换 | 版本由 module.version 控制；发布应 bump version |
| 多实例写同一 packagesDir | 文件竞争 | v1 单写者；后续接对象存储 |
