# Implementation Tasks

## 里程碑与验收门

| 里程碑 | 范围 | 验收门（命令 + 期望） |
| --- | --- | --- |
| **S1** 边界落地 | `User.passwordHash` → `select: false`；`findByEmail` 成为凭据读取路径 | `npm run build --workspace backend` 0 error；单元测试证明通用查询不加载摘要、凭据路径能加载 |
| **S2** 真 HTTP 证据 | 直属接口 + **嵌套**接口的响应体都不含凭据材料 | 新 e2e 在真 Postgres 上全绿 |
| **S3** 登录没被弄坏 | `select: false` 之后两条登录路径仍然可用 | 既有登录单测全绿；至少一条**真实登录**可用性证明 |
| **S4** 回归 | 没弄坏既有 | 全量单测 + **完整既有 e2e 清单**全绿；`verify-from-zero` 零结构差异 |

### 执行约定

1. 每完成一项：勾选 + 附证据（命令 + 真实输出），不写"应该可以"。
2. **不许**引入 `class-transformer` 序列化器，**不许**加全局拦截器，**不许**动 `main.ts`
   （理由见 design.md 决策 2）。
3. 不改数据库列定义、不加迁移（`select` 是读取层声明）。`verify-from-zero` 必须仍然零差异。
4. **摘要读取路径只允许一处**：`UsersService.findByEmail`。别处不许新增显式取摘要的查询。
5. 不能只测 `/users`：**嵌套**路径必须有一条真 HTTP 断言，否则本变更的核心价值没有被证明。

## Phase S1: 边界落地

- [ ] `backend/src/users/user.entity.ts`：`passwordHash` 的 `@Column` 加 `select: false`，
      注释写清「默认不加载；只有凭据读取路径显式取」
- [ ] `backend/src/users/users.service.ts`：`findByEmail` 显式取摘要
      （如 `createQueryBuilder('user').addSelect('user.passwordHash')`），
      注释点名「这是凭据读取路径，唯一允许取摘要的地方」
- [ ] 单元测试：通用读取（`findOne` / `findAll`）不带摘要；`findByEmail` 带摘要

## Phase S2: 真 HTTP 证据

- [ ] `backend/test/user-serialization.e2e-spec.ts`（真 Postgres，照既有 e2e 骨架：
      60s 超时、最小 TestingModule、guard override、无库 skip 并给理由）
- [ ] 断言 **直属**：`POST /users`、`GET /users/:id`、`PUT /users/:id`、`GET /users`（分页包装）
      四条的响应体都不含 `passwordHash`
- [ ] 断言 **嵌套**：至少一条加载了 User 关系的接口（`createdBy` 之类）的响应体里，
      嵌套对象也不含 `passwordHash`
- [ ] 断言方式**双重**：既查字段名（`passwordHash` 这个 key 不出现），
      也查 bcrypt 形态（响应全文里不出现 `$2a$` / `$2b$`），
      这样"改字段名就漏"和"值被塞进别的 key"都堵住
- [ ] 把该 spec 追加进 `.github/workflows/ci.yml` 的 e2e 清单

## Phase S3: 登录没被弄坏

- [ ] 证明两条登录路径仍能拿到摘要并比对成功：
      `auth.service` 的 `validateUser` 与 `auth-context` 的 `LoginService`
      （既有单测若已覆盖，说明清楚是哪两条；不够就补）
- [ ] 若某条登录路径原本依赖"隐式加载摘要"而失效，**修那一条读取路径**
      （走 `findByEmail`），**不要**改用全局序列化器

## Phase S4: 回归与文档

- [ ] 全量单测全绿
- [ ] **完整**既有 e2e 清单全绿（与 `ci.yml` 里那份逐条一致，含本变更新增的那条）
- [ ] `rebuild-database` + `verify-from-zero` 零结构差异
- [ ] 在 backend 结构化文档（`backend/AGENTS.md` 指向的既有文档，**不要新建文件**）记一句：
      用户响应永不含凭据材料；边界在读取层（`select: false`），摘要只由 `findByEmail` 显式取
- [ ] `openspec validate remove-user-credential-exposure --strict` 通过
