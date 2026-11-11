# Module DSL

Module DSL 是 AI 模块的**完整数据产物**，不是增量修改文档。

## 两个产物

| 产物 | 存储 | 说明 |
|---|---|---|
| Module DSL | `ai_modules.patchContent`（jsonb） | 由 6-step definition 生成/合并后的模块级 DSL；`publish`、metadata、capability 提取都读这里 |
| 6-step definition | `ai_module_definitions` | `step1_objectModel` … `step6_reports` 与 `mergedDefinition`；保留生成前的原始定义，便于恢复/重生成 |

`ai_modules.version` 是模块版本标签（默认 `1.0.0`），当前没有 DSL 历史表；因此暂不提供版本 diff。
需要历史时，应新增 `ai_module_dsl_versions` 之类的快照表，而不是把 `version` 当历史。

## Module DSL vs Patch DSL

| | Module DSL | Patch DSL |
|---|---|---|
| 形态 | 完整模块快照（对象/页面/权限等） | 增量修改文档（scope + operation + target + payload） |
| 用途 | 发布、metadata/capability 提取、查看/导出 | 修改已有模块/Schema |
| 入口 | `POST /ai-modules/:id/generate-from-definition` 生成 | `PatchGateway.generatePatch` / `PatchManager.applyPatch` |
| 存储 | `ai_modules.patchContent` | `apps/web-portal/public/patches/**` 或 PatchStorage |
| 安全等级 | 不适用（不是操作） | L1/L2/L3 |

`docs/patch-dsl.md` 描述 Patch DSL；本文件描述 Module DSL。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/ai-modules/dsl?search=&page=&limit=` | 浏览/搜索已保存 Module DSL |
| GET | `/api/ai-modules/:id/dsl` | 返回 `{ module, patchContent, definition }` |
| GET | `/api/ai-modules/:id/dsl/export` | 返回可下载的 JSON bundle（前端用 Blob 下载） |
| GET | `/api/ai-modules/:id/definition` | 只返回 6-step definition |

权限沿用 `@Auth()` 与组织上下文；查询始终带 `organizationId`。

## 管理端

`/admin/ai-modules/dsl`：

- 左侧搜索/选择模块
- 右侧查看 `patchContent` 与 6-step definition（按 step 折叠）
- “Export JSON” 下载当前模块的 DSL bundle
- 只读；不提供编辑/生成代码

## 明确不做

- 不生成代码文件（已由 `add-dsl-management-and-display` 移除）
- 不做 DSL 编辑
- 不做版本 diff（没有历史表）
- 不做自动部署
