# Design: 收敛用户凭据暴露面

## Context

`User` 实体被两类接口序列化：

1. **直属**：`users.controller.ts` 的 `create` / `findAll` / `findOne` / `update` 直接返回实体；
2. **嵌套**：`module-registry.service.ts`（`createdBy`）、`ai-modules.service.ts`
   （`createdBy` / `reviewedBy`）、`organizations.service.ts`（`user` / `invitedBy`）
   通过 TypeORM relations 把 User 挂在别的实体的 JSON 里。

第 2 类决定了"在 users 控制器上做一次性手动脱敏"是**错的**：它只堵住 1，
而攻击面更大的其实是 2。

需要摘要的路径（已核对，全仓只有两条，且都经由 `UsersService.findByEmail`）：

- `auth/auth.service.ts` 的 `validateUser` → `bcrypt.compare(password, user.passwordHash)`
- `auth-context/application/services/login.service.ts` → `passwordService.compare(...)`
  （经 `auth-context/infrastructure/persistence/user.repository.ts` 转调 `UsersService.findByEmail`）

两者的登录响应都是**显式摘要**（不含 passwordHash），所以"摘要被加载"本身不等于泄漏 ——
泄漏来自"实体被直接序列化"。

## Goals / Non-Goals

- Goals：让"口令摘要不出现在任何响应体里"成为一条**判定**，对直属与嵌套同时生效，
  且不依赖"每个控制器记得脱敏"。
- Non-Goals：不改数据库列定义（列还在、还要用来比对）；不做全局响应白名单重构；
  不新增依赖。

## Decisions

### 决策 1：边界放在**数据读取层** —— `select: false`

`User.passwordHash` 声明 `select: false`，TypeORM 默认**不加载**这一列。
于是：

- 直属实体序列化 → 对象上根本没有这个属性；
- **嵌套**关系（`createdBy` 等 join 出来的 User）→ 同样没有；
- 零全局改造：不需要 `class-transformer`、不需要 `ClassSerializerInterceptor`、
  不需要碰 `main.ts`。

这是"能让危险的东西不存在，就不要靠策略去拦"的直接应用：不是"记得别输出它"，
而是"它压根不在内存里"。

### 决策 2：放弃"`@Exclude()` + 全局 `ClassSerializerInterceptor`"方案

先前考虑过这条（实体标 `@Exclude()`，`main.ts` 挂全局拦截器）。放弃的理由：

1. **保护依赖注册**：少了那行拦截器，泄漏立刻回来 —— 保护强度取决于"每个 app 都记得挂"。
   而 e2e 是自建 Nest app（不走 `main.ts`），本身就与生产存在分叉。
2. **blast radius 不成比例**：为了去掉一个字段，去改**所有**接口的序列化路径，
   风险远大于收益。
3. `select: false` 在数据层，天然覆盖嵌套，且与 `main.ts` 无关。

### 决策 3：摘要读取路径收敛为一处，并在注释里点名

`UsersService.findByEmail` 显式取摘要（`addSelect`），注释写明它是**凭据读取路径**。
别处**不得**新增显式取摘要的查询 —— 这条写进文档，并由 e2e 的"响应里不得出现 bcrypt 形态"
断言兜底。

## Risks / Trade-offs

| 风险 | 对策 |
| --- | --- |
| 忘记显式取摘要的读取方拿到 `undefined` | 已知只有两条登录路径需要；失败形态响亮（`bcrypt.compare` 抛错 / 登录失败），不静默 |
| 未来有人为别的用途显式 select 摘要并把实体直接返回 | 硬断言：真 HTTP e2e 检查响应全文不得出现 bcrypt 形态字符串（`$2a$` / `$2b$`） |
| 嵌套关系逃过 `select: false` | 不一定：`select: false` 对 join 同样生效。仍要有**一条嵌套路径的真 HTTP 断言**来证明，不靠推理 |
| 客户端依赖 `passwordHash` | 不做兼容层；文档记一句 |

## Migration Plan

无数据库迁移（`select` 是 ORM 读取层声明，不改 DDL）。部署即生效。回滚＝去掉 `select: false`。
