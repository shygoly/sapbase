# Module Registry

`module_registry` 是组织内 AI 创建/手工注册模块的登记表；能力、关系、统计、配置文档都是它的子表。
契约：`schemas/module-registry.schema.json`。
模块本身不是运行时真源：发布物是 Blueprint / erpkg，注册表负责**可见性、关系、健康与 AI 上下文**。

## 1. 模块

入口：Console `/admin/module-registry` 与 `/admin/module-registry/[id]`。

| 字段 | 说明 |
|---|---|
| `name` / `description` | 展示名与用途 |
| `moduleType` | `crud` / `workflow` / `integration` / `report` / `analytics` |
| `status` | `active` / `inactive` / `deprecated` / `error` |
| `version` | 模块版本标签，不替代发布物版本 |
| `dependsOnAtomics` | `atomicType@range`；发布为 active 时逐条解析 |
| `metadata.entities` | 模块实体名，供导出与 AI 上下文 |
| `aiModuleId` | 来源 AI 模块（可空） |

状态更新：`PUT /api/module-registry/:id/status`。`error` 表示需要人工处理，不会自动降级为 healthy。

## 2. 能力

`POST /api/module-registry/:id/capabilities`

```json
{
  "capabilityType": "crud",
  "entity": "Customer",
  "operations": ["create", "read", "update", "delete", "list"],
  "apiEndpoints": ["/api/customers"],
  "description": "Customer CRUD"
}
```

能力是 AI 上下文与蓝图导出的实体来源；没有能力的模块在健康检查里是 `warn`。

## 3. 关系

类型：`dependency` / `integration` / `data-flow` / `hierarchical`。

- `POST /api/module-registry/:id/relationships`
- `PUT /api/module-registry/:id/relationships/:relId`
- `DELETE /api/module-registry/:id/relationships/:relId`
- `GET /api/module-registry/graph`

规则：

- 源/目标必须同组织；自引用拒绝。
- 相同 `(source, target, type)` 只允许一条。
- `dependency` 加入前检测环，错误信息返回具体路径（`A → B → A`）。
- 图接口返回 `{nodes, edges, summary}`，供详情页可视化与 AI 关系上下文。

## 4. 统计与健康

- `POST /api/module-registry/:id/statistics/collect`：按实体候选名查 `information_schema`，
  对真实表执行 `COUNT(*)`；找不到表记 `warning`，查询失败记 `error`。
- `GET /api/module-registry/:id/health`：模块状态、能力数、统计健康三类检查。
- `GET /api/module-registry/health`：组织级 healthy/warning/error 汇总。

统计是**可重建派生物**，不是业务真源；`averageResponseTime` 记录本次收集耗时，`errorCount` 记录查询失败。

## 5. 配置与文档

配置类型：`schema` / `usage` / `api` / `relationship`。

- `POST /api/module-registry/:id/configurations`
- `PUT /api/module-registry/:id/configurations/:configId`
- `DELETE /api/module-registry/:id/configurations/:configId`
- `GET /api/module-registry/:id/documentation`：从能力、关系、配置生成 Markdown。

`documentation` 存使用说明；`schema` 存结构化配置（如字段、参数、权限）。生成文档包含：

1. 模块基本信息和实体；
2. Capabilities 表与 API 端点；
3. 关系（入/出）；
4. 配置文档。

## 6. AI 上下文

`GET /api/ai/modules` 与 `GET /api/ai/modules/:id` 供 AI 读取模块、能力、关系、统计。
六步定义生成时，服务端会把最近 20 个注册模块的实体/能力/端点追加到 system prompt，
避免 AI 重复造实体或端点（`ModuleRegistryService.getAiGenerationContext`）。

## 7. 边界

- 注册表不执行模块；运行仍走 Blueprint / Module Registry 发布链。
- 不把 `metadata.entities` 当数据库表真源；统计收集会先用 `information_schema` 校验。
- 不做跨组织模块复用；关系、能力、统计、配置都按 `organizationId` 隔离。
- 配置文档不是发布许可；`active` 仍需通过原子依赖校验。
