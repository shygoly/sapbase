# Patch DSL

Patch DSL 是声明式的 Schema 修改文档：只改 Schema JSON，不生成代码、不改业务数据。

- JSON Schema：`schemas/patch-dsl.schema.json`
- 实现：`libs/app-shared/src/core/patch/`
- 测试：`npm run test:patch-dsl`

## 文档结构

```json
{
  "version": "1.0",
  "patchId": "00000000-0000-4000-8000-000000000001",
  "timestamp": "2026-11-11T00:00:00.000Z",
  "actor": "ai",
  "scope": "object",
  "operation": "add",
  "target": { "type": "field", "identifier": "Customer" },
  "payload": {
    "field": { "name": "email", "label": "Email", "type": "email" }
  }
}
```

| 字段 | 说明 |
|---|---|
| `version` | 当前只接受 `1.0` |
| `patchId` | UUID |
| `timestamp` | ISO-8601 |
| `actor` | `ai` 或 `human` |
| `scope` | `page` / `object` / `permission` / `state` / `menu` |
| `operation` | `add` / `update` / `remove` / `reorder` / `replace` |
| `target` | `type` + `identifier`，可选 `path` |
| `payload` | 按 scope 解释的修改内容 |
| `dependsOn` | 可选，批量执行的拓扑依赖 |
| `securityLevel` | 由 validator 赋值，客户端值会被覆盖 |

## Scope 与操作

| Scope | 可修改 | 典型操作 |
|---|---|---|
| `page` | 页面 metadata / 页面字段与动作（字段/动作需改 view） | update metadata |
| `object` | 对象字段、关系、状态机引用 | add/update/remove field |
| `permission` | view/create/edit/delete 规则 | add/update/remove/replace |
| `state` | 状态机 states / transitions | add/update/remove |
| `menu` | 菜单项/子菜单 | add/update/remove |

系统核心字段 `id`、`createdAt`、`updatedAt`、`version` 不能被删除或修改。
组件只能来自 `COMPONENT_REGISTRY`，字段类型只能来自 `VALID_FIELD_TYPES`。

## 安全等级

| 等级 | 行为 |
|---|---|
| `L1` | 可自动执行（例如 page/object add field、menu add） |
| `L2` | 需要确认（例如 object update field、permission add） |
| `L3` | 直接拒绝（例如 permission update/remove、object remove field） |

`PatchManager.applyPatch` 会强制执行等级；L2 必须提供 `requireConfirmation` 回调。

## 执行流程

```
validate → security level → execute → register updated schema
         → create version → hot reload → audit
```

- 更新后的 Schema 会写回 `SchemaRegistry`，后续 `PageRuntime` 才能看到。
- 每次成功应用都会生成递增版本，并记录审计。
- 失败/拒绝也会写审计（`failure` / `rejected`）。

## Dry run

```ts
const preview = await patchManager.dryRun(patch)
```

返回 `changes.before/after`、`warnings`、`errors`、`securityLevel`，不写 registry、不生成版本、不触发 hot reload。

## 版本控制与回滚

```ts
patchManager.getVersionHistory('Customer')
patchManager.rollback('Customer', 1)
```

`VersionControl` 支持 `createVersion`、`getHistory`、`compareVersions`、`rollbackToVersion`。
回滚会删除目标版本之后的版本记录；Schema 内容由返回的 version 交给调用方重新注册/渲染。

## 批量与依赖

```ts
await patchManager.applyBatchPatches([second, first])
```

`dependsOn` 是 patchId 数组；执行前做拓扑排序并检测环。任一 patch 失败时当前实现返回失败结果，后续 patch 不再执行。

## 限流

`PatchRateLimiter` 默认 `120 次 / 60s / actor`：

```ts
new PatchManager(resolver, registry, new PatchRateLimiter({ max: 60, windowMs: 60_000 }))
```

超过限制返回 `Patch rate limit exceeded`，并写拒绝审计。它是单进程安全阀，多副本部署仍需网关限流。

## AI 工具定义

`PATCH_GENERATION_TOOL_DEFINITION`（`libs/app-shared/src/core/patch/gateway.ts`）是 Agent 工具层的契约：

- name：`erp_patch_generate`
- write：`false`
- confirmation：`none`
- permission：`tool:patch:generate`
- 输入：`intent`（必填）、`targetSchema`

工具 handler 应调用 `PatchGateway.generatePatch`，再走 `PatchManager.applyPatch` 的 L1/L2/L3 确认路径；生成器不能直接写代码或业务数据。

## 版本化 Schema

`SchemaResolver` 支持按版本读取：

```ts
schemaResolver.loadObjectSchema('Customer', 2)
// GET /specs/versions/Customer/v2.json
```

`resolvePage(path, version)` 会把同一版本传给 page/view/object；未给版本时仍读 `/specs/{objects,views,pages}/...`。
缓存 key 区分 `name` 与 `name@vN`；`clearCacheFor` 同时清理两者。

## 热更新

`PatchManager` 成功应用后调用 `HotReloader.invalidateSchema`：

1. 清理 `SchemaResolver` 对应缓存；
2. 300ms 防抖后通知订阅者；
3. `useHotReload` 在 Next.js App Router 中同时 `router.refresh()`，避免整页刷新。

`forceReload()` 可绕过防抖，用于测试或显式刷新。

## 与 Runtime 组件

`PageRuntime` / `FormRuntime` / `CollectionRuntime` 继续负责权限与布局；Schema 数据通过
`useRuntimeSchema(path, version)` 从 `SchemaResolver` 获取，再把 `ResolvedPageSchema`
传给 Runtime 子树。Patch 只改 Schema，不生成新的 React 页面。

## 测试

```bash
npm run test:patch-dsl
```

覆盖：JSON schema、validator 规则、五种 scope、executor、version control、audit、
hot reload、manager apply/dry-run/rollback、L2/L3、rate limit、batch 依赖/环、
AI tool definition、版本化 resolver。
