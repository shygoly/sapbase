## Context

Blueprint 的运行时语义层只覆盖实体/状态/规则/经验策略。AI 定义的页面与权限没有落点；
服务端 patch 也只能处理 object/state。

## Goals / Non-Goals

**Goals**

1. 页面/菜单与角色规则成为可签名、可版本化、可装载的包层。
2. 页面/权限引用必须在编译期可解析。
3. AI 定义和 AI patch 都能更新这两层并重新产包。
4. 运行时能按租户读到已发布的 UI/权限声明。

**Non-Goals**

- 不做页面渲染器（消费方仍用 `ui-runtime`）。
- 不把 AI 的角色名自动映射为平台 RBAC 权限点。
- 不做服务端数据范围强制执行（`own/team/all` 是声明；`own` 已有 ownership 作为数据面基础）。

## Decisions

### D1. 两层独立文件，而不是塞进 experience

`ui.json` 与 `permissions.json` 各自有 Schema 和摘要；`experience` 保持“动作优先级/确认/自动化”，不混入页面布局与角色 ACL。

### D2. IR 增加层摘要

`ui` / `permissions` 与 semantic/rules/experience 一样计算 canonical digest 并进入 `irDigest`；
改页面/权限必须重新编译/签名，不能悄悄换 UI。

### D3. 权限层是声明，不是平台 RBAC 的替代

`permissions.json` 只表达“角色 → 资源 → 范围/动作”。平台 RBAC 的点（`system:manage` 等）仍由 JWT 权限点控制；两者不是同一层。

### D4. 服务端 Patch 支持三类新 payload

- `page`: `payload.page`
- `permission`: `payload.permission`
- `menu`: `payload.menu`

沿用 L1/L2/L3 与确认规则；不支持的操作/字段明确报错。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| 页面 identifier 与前端路由冲突 | 渲染冲突 | 编译期重复检查；route 可选 |
| 角色名与平台角色不一致 | 声明无法直接执行 | 明确为声明层；映射另立变更 |
| 旧包缺层 | 读取 404 | 两层 optional；旧包行为不变 |
