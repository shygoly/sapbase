## 1. P0 — 编译/模板缓存

- [x] 1.1 `CompiledBlueprint` 类型与构建函数（`libs/platform-release/src/blueprint/compiled-model.ts`）
- [x] 1.2 `loadBlueprint` 返回 `compiled`；编译失败不产出半成品
- [x] 1.3 `BlueprintService` 进程内缓存：key `packageId::tenantId`，校验 mtime/size/TTL/expiresAt
- [x] 1.4 `SemanticRuntimeService.readTemplate` 优先读 `compiled.template`，不再二次解包
- [x] 1.5 `invalidate(id?)` + `deliver` 后失效；缓存命中/未命中可观测（debug 日志）

## 2. P1 — 运行时不解释源 JSON

- [x] 2.1 `LoadedBlueprint` 暴露 compiled template（实体/validation/approval/accounting）
- [x] 2.2 `readTemplate` 的 fallback 只保留给未 load 的后台任务；正常路径不触发
- [x] 2.3 单测：同一包 load 两次返回同一缓存对象；invalidate 后重新编译
- [x] 2.4 单测：compiled template 与源 JSON 语义一致（实体/规则/状态机）

## 3. P2 — 查询索引计划

- [x] 3.1 `semantic` 字段新增可选 `indexed: boolean`；Schema 与类型同步
- [x] 3.2 `query-index.ts`：索引名/DDL/应用函数；文本与数值表达式与 `record-query` 完全一致
- [x] 3.3 `CompiledBlueprint.indexPlan` 汇总 unique/not-null/query 三类
- [x] 3.4 `SemanticRuntimeService.applyIndexesOrThrow` 应用查询索引并缓存成功结果
- [x] 3.5 单测：`indexed` 文本/数值字段生成匹配查询的 DDL；未声明不生成

## 4. 验收

- [x] 4.1 `npm run build --workspace @sap/platform-release`、`npm run typecheck --workspace @sap/ui-shipping`、`npm run build --workspace @sap/api` 通过
- [x] 4.2 `apps/api` 全量 jest 绿；新增缓存/编译产物/索引用例
- [x] 4.3 `npm run check:all` / `check:boundaries` / `lint:boundaries` 0 error
- [x] 4.4 基准：同一包第二次 `BlueprintService.load` 命中缓存；实测 cache hit 0.026ms/op，cache miss 4.03ms（小模板）；单测断言两次 `load` 返回同一对象
- [x] 4.5 相关 e2e：`blueprint-pipeline` 3/3；`autoparts-atoms` + `blueprint-delivery-template` + `blueprint-read-interfaces` 18/18（含真实 Wasm 调用）
