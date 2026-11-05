## Context

Blueprint 是模型解释型低代码运行时：`semantic.json` / `flows.json` / `rules.json` /
`experience.json` 是作者格式，`compileBlueprint` 做逐文件 Schema、依赖闭包、冲突检测与 IR。
但当前运行时在**每个请求**上重复执行整条编译链：

- `BlueprintService.load()` → `loadBlueprint()` → `unpackBlueprint + compileBlueprint`
- `SemanticRuntimeService.readTemplate()` → 再 `unpackBlueprint + JSON.parse(semantic.json)`

IR 只被当作 `irDigest` 使用，没有成为运行时模型。

## Goals / Non-Goals

**Goals**

1. 编译只发生在缓存未命中时；命中后请求路径只读编译产物。
2. 运行时不再直接解释包内源 JSON。
3. 为声明式过滤/排序字段提供可执行的索引计划。
4. 保持 `.erpkg` 格式、签名与发布语义不变。

**Non-Goals**

- 不生成物理表 / 不做 per-domain 数据库迁移。
- 不引入 Redis 或分布式缓存；先用进程内缓存 + 可失效接口。
- 不改变 AI 六步定义链路（另有独立变更）。
- 不做出码（code generation）。

## Decisions

### D1. 编译产物是 `CompiledBlueprint`，不是 IR

`compileBlueprint` 现有 IR 是摘要/审计形态（实体数、事件、层 digest），不足以驱动运行时。
新增 `CompiledBlueprint`：

```ts
{
  format: 'blueprint-runtime/v1'
  blueprint, version, irDigest
  template: { entities, validation, approval, accounting }
  indexPlan: Array<{ entity, field, kind: 'query'|'unique'|'not-null', sqlType: 'text'|'numeric' }>
  compiledAt
}
```

`loadBlueprint` 在编译成功后用已解包的 `semantic.json` / `rules.json` 构建它；
构建失败视为编译失败（不产出半成品）。

**Alternatives considered**：把 IR 扩成完整运行时模型。否决——IR 是协议产物，
会被签名/清单引用；把运行时细节塞进去会让协议版本与运行时版本耦合。

### D2. 缓存放在 `BlueprintService`，key 带租户与文件指纹

- key：`packageId::tenantId`
- 命中条件：`mtimeMs`、`size` 未变、未过 TTL（`BLUEPRINT_CACHE_TTL_MS`，默认 300000）
- `license.expiresAt` 已过 → 视为未命中
- `invalidate(id?)` 显式清理；`deliver` 后自动清理同 id
- 缓存的是 `LoadedBlueprint`（含 compiled 与 atomic bindings），所以缓存命中不会重新解析原子

**为什么不在 `SemanticRuntimeService` 再放一层**：`load` 已返回 compiled template，
`readTemplate` 优先读它；只有直接调用 `readTemplate` 且未 load 的后台任务才回退解包。

### D3. 查询索引由 `indexed: true` 显式声明

不在编译期猜测“哪些字段会被过滤”。语义字段新增可选 `indexed: boolean`：

- 文本/枚举 → `(data->>'field')`
- 数值/decimal/i32 → `((data->>'field')::numeric)`

索引 DDL 带 `entity` 与 `blueprintId` 谓词，和应用查询的 WHERE 完全一致；
名字由 `blueprintId/version/entity/field` 哈希派生，`IF NOT EXISTS` 幂等。
`indexed` 不替代 `unique`：唯一索引仍走既有部分唯一索引。

### D4. 失败策略

- 编译/构建产物失败：`CompileError`，不写缓存。
- 索引创建失败：写入路径抛 `RecordWriteError('query-index-failed')`，不静默跳过。
- 缓存条目损坏（文件被替换但 mtime/size 相同）：TTL 到期后重新编译；`irDigest` 仍会在
  `loadBlueprint` 内校验，不能绕过。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| 缓存持有旧 license | 过期后仍可用 | 命中时检查 `expiresAt`；TTL 默认 5 分钟 |
| 包被原地替换但 mtime 相同 | 读到旧模型 | 同时比较 size；`deliver` 调 `invalidate`；TTL 兜底 |
| 表达式索引创建锁表 | 大表写入抖动 | 先 `IF NOT EXISTS`；后续迁移到 `CONCURRENTLY`（需确认不在事务内） |
| CompiledBlueprint 格式演进 | 旧缓存不兼容 | `format` 版本 + 缓存进程内，重启即失效 |

## Migration Plan

1. 合并后首次 load 自动编译并缓存；无需数据迁移。
2. `indexed` 是可选字段；旧模板不生成新索引。
3. 回退：删除缓存层即可回到逐次编译；`.erpkg` 不受影响。
