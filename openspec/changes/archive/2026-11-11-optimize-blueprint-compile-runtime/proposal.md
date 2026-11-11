# Change: Blueprint 编译产物与运行时缓存

## Why

当前 Blueprint 的“编译”只产出校验结果与 IR 摘要，运行时**没有使用编译产物**：

- `BlueprintService.load()` 每次请求都 `unpackBlueprint + compileBlueprint + 验签 + 原子解析`；
- `SemanticRuntimeService` 每个写/读操作又 `readTemplate()` 再解包一次、重新 `JSON.parse`；
- 本机对 `auto-parts-min`（5 个文件的小模板）实测 `unpack + compile` 约 **8.7 ms/次**，100 QPS 就接近 1 个 CPU 核；
- `blueprint_records` 只有 `(blueprintId, entity, organizationId)` 一个 btree，过滤/排序字段没有表达式索引。

这使 Blueprint 更像“带校验的 JSON 解释器”，而不是“编译一次、运行多次”的低代码运行时。

## What Changes

- **ADDED** `CompiledBlueprint`：编译时产出不可变的运行时模型（实体/字段/状态机/规则索引/查询索引计划），运行时不读源 JSON。
- **ADDED** 进程内编译缓存：按 `packageId + tenantId + 文件 mtime/size` 缓存，TTL 可配，支持显式失效；缓存命中不再解包/编译/验签。
- **ADDED** `semantic` 字段级 `indexed: true` 声明；编译产出 `indexPlan`，运行时幂等创建表达式索引（匹配现有 `data->>'field'` 查询/排序表达式）。
- **MODIFIED** `loadBlueprint` 返回 `compiled`；原子绑定仍按加载时解析，并随缓存一起复用。
- 包格式不变；未声明 `indexed` 的旧包行为不变。

## Impact

- Affected specs: `blueprint-delivery`、`blueprint-semantic`、`semantic-runtime`
- Affected code:
  - `libs/platform-release/src/blueprint/{compiler,loader,blueprint.service,compiled-model,query-index}.ts`
  - `apps/api/src/semantic-runtime/{semantic-runtime.service.ts,record-query.ts}`
  - `schemas/blueprint-semantic.schema.json`
- 兼容性：`.erpkg` manifest/文件格式不变；`CompiledBlueprint` 带 `format` 版本，后续可独立演进。
- 不做的事：不生成物理表、不做出码、不改现有发布/签名语义。
