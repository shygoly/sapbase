> 当前进度（2026-11-09）：2.1/2.2/2.3/2.4a/2.5、3.1/3.2a/3.3/3.4/3.5/3.6a/3.7、
> 4.1a/4.1b/4.2a/4.3/4.4、5.1a/5.1b/5.2a/5.2b、6.1/6.2a 已完成；解析器 + SQL 编译器 + DataScopeService + 管理 API + 列表/单条读/创建/更新/删除/迁移执行点 + 蓝图 dataScope 元数据已落地，
> 尚未接导入/视图/导出/Agent、Redis 缓存、预览 UI、permissions scope/cap、e2e。

## 1. 元语与契约

- [ ] 1.1 在 `docs/META_LANGUAGE.md` 新增数据范围一节（五原语、范围代数、不变量 INV-DS-01..06），并在第 6 节术语表登记 `Data Scope` / `Scope Dimension` / `Scope Node` / `Scope Membership` / `Data Policy` / `Scope Resolver` / `Scope Predicate`
- [x] 1.2 在 `DOMAIN.md` 新增“数据范围”小节：表、关系、状态词、不变量；运行 `node scripts/meta/check-domain-doc.mjs`
- [ ] 1.3 在 `DECISIONS.md` 登记关键决策（通用原语而非扩展 departments、定义/实例分离、范围只收窄、应用层谓词 + RLS 租户边界、模板 cap）
- [ ] 1.4 新增/扩展 JSON Schema：`data-scope/v1`（binding/policy/scope AST 的持久化形状）
- [ ] 1.5 更新 `schemas/blueprint-semantic.schema.json` 与 `schemas/blueprint-permissions.schema.json`（`dataScope`、`scope: "policy"`），保持加法式扩展

## 2. 存储与 RLS

- [x] 2.1 迁移：`scope_dimensions` / `scope_nodes` / `scope_memberships` / `scope_bindings` / `data_policies` / `scope_versions`
- [x] 2.2 索引：`scope_nodes(organizationId, dimensionId, path)`、`scope_memberships(organizationId, subjectType, subjectId)`、`data_policies(organizationId, resourceKey, status)`
- [x] 2.3 外键与唯一约束：维度 key 按组织唯一；节点父级同维度同组织；绑定 `(organizationId, resourceKey, dimensionKey, kind)` 唯一
- [x] 2.4a 把新表加入 `TENANT_RLS_DDL.DIRECT_TABLES`
- [ ] 2.4b 补 RLS e2e（跨租户不可见/不可写）
- [x] 2.5 TypeORM 实体与模块注册；确保实体注册检查通过

## 3. 范围解析器

- [x] 3.1 定义 `ScopeSpec` / `ScopeExpr` / `FieldRef` / `RelationSpec` / `ScopePredicate` 类型
- [x] 3.2a 实现树展开：`exact` / `subtree` / `ancestors`
- [ ] 3.2b 路径维护与环检测
- [x] 3.3 实现成员解析：用户/角色/组、岗位过滤、有效期过滤
- [x] 3.4 实现策略组合：allow 并集、deny 覆盖、多角色并集、模板 cap 交集
- [x] 3.5 实现关系解析：蓝图关联实体单跳 + 平台关联表单跳
- [x] 3.6a 实现 `scopeVersion` + 内存缓存，变更即 bump
- [ ] 3.6b Redis 缓存（多实例）
- [x] 3.7 单元测试：五种 scope、空绑定 fail-closed、无策略 fail-closed、跨维度非法、过期成员、deny 优先、cap 收窄
- [ ] 3.8 失败路径测试：解析异常、非法节点、循环树、伪造主体

## 4. 统一执行点

- [x] 4.1a `DataScopeService.resolve(actor, resourceKey, action)` + 预算缓存
- [x] 4.1b `assertRowInScope` + `assertCreateInScope`
- [x] 4.2a `ScopeSqlCompiler`：ScopeExpr → SQL/params，支持 column/jsonb/exists
- [ ] 4.2b TypeORM `applyScope(qb, expr, alias)`
- [x] 4.3 语义运行时列表/详情/单条读接入范围谓词（与字段权限、ownership 组合）
- [x] 4.4 语义运行时写/更新/删除/状态迁移接入：目标行越界拒绝，创建校验写入节点在可写范围
- [ ] 4.5 导入接入：逐行校验，批量不部分落库；错误可定位到行与字段
- [ ] 4.6 导出/统计/视图/追溯接入同一谓词
- [ ] 4.7 Agent 工具面与插件 capability broker 接入（按资源/动作解析，结果不绕过）
- [ ] 4.8 负例 e2e：跨子树不可见、详情 404、更新/删除 403、越权创建、导出/视图/追溯、Agent 工具越界

## 5. 管理面与预览

- [x] 5.1a 维度/节点/成员/绑定/策略 service CRUD
- [x] 5.1b 管理 API + 权限点（`data-scope:read` / `data-scope:manage`）
- [x] 5.2a `DataScopeService.preview()`（复用 resolve）
- [x] 5.2b 预览 API（返回 expr/version/declared）
- [ ] 5.2c 预览 UI + 节点集合/可读谓词摘要
- [ ] 5.3 策略/成员/节点变更写审计（actor、before/after、原因）
- [ ] 5.4 `api-client` 与 OpenAPI 更新
- [ ] 5.5 管理 UI：树、成员、策略、预览（可放 Portal 组织管理区）
- [ ] 5.6 空绑定预检 API/脚本：统计 null/空值行数，给出回填提示

## 6. 蓝图集成

- [x] 6.1 `blueprint-semantic` 实体支持 `dataScope`（`ownerField` + `bindings`）
- [x] 6.2a 编译器校验 dataScope：字段/实体/关联字段存在、dimension key 合法
- [ ] 6.2b `permissions.json` 的 own/team/policy 与 cap 校验
- [ ] 6.3 `permissions.json` 支持 `scope: "policy"` + `dataScope`，保持旧值语义不变
- [ ] 6.4 装载/升级时解析蓝图模板 cap；租户策略只能收窄
- [ ] 6.5 旧包兼容：无 `dataScope` 的包行为不变；`scope` 仅作为声明/粗粒度映射
- [ ] 6.6 `ownership` 与 `dataScope` 组合（AND），不改变既有 ownership 空值语义
- [ ] 6.7 编译/装载负例：未知 scope、缺 dataScope、悬空字段、租户放大 cap

## 7. 验证与样板

- [ ] 7.1 区域样板 e2e：大区→省→市，三级经理各自可见/不可见
- [ ] 7.2 学校样板 e2e：校区→年级→班级，校长/年级主任/班主任/任课教师
- [ ] 7.3 关系样板：课程通过 `TeachingAssignment` 只对任课教师可见
- [ ] 7.4 性能基线：树展开、成员解析、JSONB 过滤、缓存命中
- [ ] 7.5 RLS 与范围叠加的负例（跨租户优先拒绝）
- [x] 7.6 `openspec validate add-generic-data-scope-authorization --strict`
- [ ] 7.7 运行元语/契约校验：`check-domain-doc.mjs`、`check-meta-docs.mjs`（如涉及 FLOWS/DECISIONS）

## 8. 文档与交付

- [ ] 8.1 更新 `docs/protocols/blueprint-delivery.md`：把 §14.3 “部门/仓库级不做”改为指向本能力，并写明 RLS 只做租户边界
- [ ] 8.2 更新 `docs/ARCHITECTURE.md` 权限小节（如存在）
- [ ] 8.3 更新 `AGENT-TOOLS.md` / `contracts/tools.json`：Agent 数据访问工具必须声明并执行范围
- [ ] 8.4 更新 `openspec/specs/data-scope/spec.md` 归档说明
- [ ] 8.5 发布说明：声明即执行、空绑定 fail-closed、租户只能收窄
