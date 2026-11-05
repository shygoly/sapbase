# AI 模块：数据库与安全性说明

## 数据库如何处理？

### 当前设计：**不会**根据六步定义或 Blueprint 层自动生成业务表

- **后端存储**
  - 六步向导的每一步产出先过 `schemas/ai-definition-*.schema.json`，再写入
    `ai_module_definitions.step1~step6_*`（JSONB）；不合法步骤不会被保存。
  - 完成时调用「根据定义生成」接口，后端**确定性**执行
    `normalizeDefinitionShape → definitionToBlueprint → writeBlueprintDir → packageFrom → compile`，
    把 Blueprint 五层（semantic / flows / 可选 rules / experience）与 `objects` 写入
    **`ai_modules.patch_content`**（JSONB），并产出/编译 `.erpkg`；
    `ai_modules.metadata.blueprint` 记录 `packageId` 与 `irDigest`。不再调用第二次 LLM 生成未定义的 “Model DSL”。
  - AI 修改通过 `POST /api/ai-modules/:id/patches/apply` 应用（object/state 子集），
    bump patch 版本后重新产包/编译；page/permission/menu patch 在服务端明确拒绝。
  - 交付通过 `POST /api/ai-modules/:id/blueprint/deliver`：给包补 `license.json`、重签，
    并按当前租户 `load` 验证；只有验证成功才写 `metadata.blueprint.loadedAt`。
  - 即：数据库里只会多一条/更新一条 **AI 模块记录**（表 `ai_modules`），
    `patch_content` 里是 Blueprint 层，**不会**根据这份文档自动执行 `CREATE TABLE` 或迁移。

- **业务表从哪里来**
  - 系统现有的业务表（用户、角色、菜单、设置、审计日志、AI 模块本身等）来自 **手写的 TypeORM 实体 + 迁移**（如 `migrations/` 下的脚本），与 AI 生成的 Patch 无关。
  - Patch DSL 描述的是 **运行时 schema**（对象/页面/权限/状态等），用于前端 PatchManager 的校验、执行和版本管理；**当前没有**「根据 Patch 自动生成并执行数据库迁移」的流程。

- **若要让「定义 → 真实表」**
  - 需要额外实现一层：例如根据 Patch 中的 `object` 定义生成 DDL 或 TypeORM 迁移，再由管理员审核后执行 `migration:run`。  
  - 当前代码库中 **没有** 这层实现；所有与 DB 表结构相关的变更仍依赖人工编写迁移。

---

## 六步定义如何校验？

- 判据只有一份：`apps/api/src/ai-modules/definition-schema.ts` 按 stepId 映射到
  `schemas/ai-definition-*.schema.json`，`generateDefinitionStep`、
  `generateAllDefinitionSteps`、`saveDefinition` 都走它。
- 校验失败返回 400，带 stepId 与字段路径；不写库、不覆盖旧 `patch_content`。
- AI 响应文本解析（Kimi `content[0].text` / OpenAI `choices[0].message.content` / 嵌套
  `data.content`）统一走 `ai-response.ts`；无 JSON / 非法 JSON / 非对象一律报错，
  不再回退成默认空 patch。
- 定义 → Blueprint 支持两种形状：嵌套（`objectModel`/`stateFlow`）与 wizard 扁平
  （`entities`/`states`/`transitions`）。

---

## 安全性如何控制？

### 1. 接口权限（后端）

- 以下操作均受 **`@Auth('system:manage')`** 保护，只有具备 `system:manage` 权限的用户可调用：
  - 创建/更新/删除 AI 模块
  - 生成 Patch（`generate`）、根据定义生成（`generate-from-definition`）
  - 修改已有模块（`modify`）
  - 运行测试、提交审核、审核、发布、取消发布
- 即：**只有系统管理员级别才能用 AI 生成或改模块定义**，从入口上控制谁可以动「定义」。

### 2. Patch 安全等级（前端 PatchManager）

- 在 **PatchValidator** 中为每个 Patch 计算 **安全等级**：
  - **L1**：允许自动执行（如：页面 scope、添加字段等）。
  - **L2**：需用户确认后再执行（如：新增权限、修改字段、状态机变更等）。
  - **L3**：**禁止执行**（如：修改/删除权限、删除对象字段等危险操作）。
- 执行前会检查：L3 直接拒绝；L2 若未确认则拒绝。  
- 这样即使 AI 生成了危险操作，也不会被直接执行，必须经过人工或二次确认。

### 3. 权限类 Patch 的额外校验

- 对 **permission** scope 的 Patch，校验逻辑会确保：**执行者不能授予超过自己已有权限的权限**。  
- 即：管理员只能在其自身权限范围内通过 Patch 增删改权限，避免越权提升。

### 4. 审计

- **AuditLogger** 会记录 Patch 的应用与拒绝（含拒绝原因），便于事后追溯「谁在何时对哪个模块做了什么、是否被拒绝」。

---

## 小结

| 问题 | 答案 |
|------|------|
| 六步/Blueprint 会直接生成数据库表吗？ | **不会**。六步定义确定性转换为 Blueprint 层并产出/编译 `.erpkg`（`metadata.blueprint`），但不执行建表或迁移。 |
| 业务表从哪来？ | 目前全部来自手写实体与迁移；若要做「定义 → 表」，需另做「Patch → DDL/迁移 + 审核执行」的流程。 |
| 谁可以生成/改模块？ | 仅具备 **system:manage** 权限的用户（后端接口级控制）。 |
| 生成的 Patch 会不会被乱执行？ | 有 **L1/L2/L3** 分级：危险操作为 L3 禁止、敏感操作为 L2 需确认；权限类 Patch 不能越权授予。 |
| 出问题能追溯吗？ | 可以，通过 **AuditLogger** 记录执行与拒绝记录。 |
