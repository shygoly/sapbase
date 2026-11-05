## Context

前端 Patch DSL 的 scope 是 page/object/permission/state/menu；Blueprint 的运行时语义层
只有实体/字段/状态机/规则/经验策略。两者不是一一对应。

## Goals / Non-Goals

**Goals**

1. AI 修改可以在服务端应用，产生新的定义版本与新 `.erpkg`。
2. 不支持的 patch scope 明确失败，不产生“看似成功、实际没改”的结果。
3. 安全级别与确认语义在服务端也成立（L3 拒绝、L2 必须确认）。

**Non-Goals**

- 不做 page/menu 的服务端渲染变更（那属于前端 schema，不是 Blueprint）。
- 不做 permission 规则到 rules.json 的自动映射（语义不等价）。
- 不自动签名/激活。

## Decisions

### D1. 只支持 Blueprint 能表达的 scope

- `object`：字段 add/update/remove
- `state`：状态与迁移 add/update/remove

其余 scope 抛 `unsupported-scope`，并列出支持范围。**不静默忽略**。

### D2. Patch 应用后必须重跑完整校验

顺序：normalize → apply → assertMergedDefinition → definitionToBlueprint → packageFrom →
compile(stamp)。任一失败不更新模块版本/包。

### D3. 版本 bump 与包 id 同源

`semver.inc(module.version, 'patch')`；包 id 由 `blueprintIdentity(module.name, newVersion)`
决定，因此新 patch 不会覆盖旧包。

### D4. 应用是显式动作

`modifyExistingModule` 仍只生成 patch 供预览；`POST /:id/patches/apply` 才落库/产包。
这样“AI 提议”与“平台应用”保持分离。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| AI 生成 page/permission patch | apply 返回 400 | 明确列出支持范围；前端可继续前端预览 |
| 字段类型改变导致旧数据不兼容 | 运行时拒绝 | 本轮不自动迁移数据；由后续 schema migration 变更处理 |
| 版本 bump 冲突 | 包覆盖 | semver patch + 包 id 含版本 |
