## Context

UI/permissions 层已经进入 Blueprint 包，但运行时消费者缺失。`ui-runtime` 只有
SchemaRuntime 包装组件，没有“按包加载 UI”的入口；后端权限层只是数据。

## Goals / Non-Goals

**Goals**

1. 一个租户能打开 `/dashboard/apps/<packageId>` 看到发布的页面/菜单。
2. 页面/记录按 `permissions.json` 过滤；无层旧包不受影响。
3. AI 角色可通过 `roleMappings` 映射到平台权限点。

**Non-Goals**

- 不做拖拽编辑器。
- 不把 UI 层编译成静态 Next 路由。
- 不实现 `team` 数据范围的物理过滤（沿用既有 ownership；team 视为声明范围）。

## Decisions

### D1. 通用消费者而不是代码生成

`BlueprintAppRuntime` 在运行时读取 `ui.json` / entities / permissions，使用既有
`SchemaList` / `SchemaForm` 渲染。页面 identifier 决定显示哪一页；不生成代码。

### D2. 权限判定一份逻辑

`canAccessBlueprintResource` 在 shared-core，前后端共用：
- `roleMappings[role]` 任一权限点命中 → 角色成立
- 否则 `actor.role === role` 或 `permissions.includes(role)`
- 再匹配 resource（含 `*`）与 action（缺省=全部）

### D3. 服务端默认放行，有层才收紧

无 `permissions.json` 或空 rules → 保持旧行为。有规则时，未命中即 403。
这避免旧包/旧测试被新规则误伤。

### D4. UI 只做 list/form/detail

v1 不做任意布局 DSL；`ui.json` 的页面类型映射到既有 SchemaList/SchemaForm/详情网格。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| AI 角色未映射 | 用户看不到页面/写被拒 | `roleMappings` 配置；错误 403 明确 |
| 通用表单字段有限 | 复杂页面体验不足 | v1 只承诺 CRUD；复杂页面仍可手写 |
| 动态路由影响构建 | Next 静态化失败 | catch-all 动态路由，构建已验证 |
