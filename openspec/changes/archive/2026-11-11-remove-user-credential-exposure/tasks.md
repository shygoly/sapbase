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

- [x] `backend/src/users/user.entity.ts`：`passwordHash` 的 `@Column` 加 `select: false`，
      注释写清「默认不加载；只有凭据读取路径显式取」
- [x] `backend/src/users/users.service.ts`：`findByEmail` 显式取摘要
      （如 `createQueryBuilder('user').addSelect('user.passwordHash')`），
      注释点名「这是凭据读取路径，唯一允许取摘要的地方」
- [x] 单元测试：通用读取（`findOne` / `findAll`）不带摘要；`findByEmail` 带摘要

证据：

```
npm run build --workspace backend
> speckit-backend@1.0.0 build
> nest build
exit_code: 0

npm run test --workspace backend -- --testPathPattern='users.service.spec|auth.service.spec|login.service.spec' --no-coverage
PASS src/users/users.service.spec.ts (41.594 s)
PASS src/auth/auth.service.spec.ts (42.231 s)
PASS src/auth-context/application/services/login.service.spec.ts (37.986 s)
Test Suites: 3 passed, 3 total
Tests:       15 passed, 15 total
```

`create()` 在 `save()` 后改走 `findOne` 再返回：`save()` 会把刚写入的摘要留在内存对象上，
`select: false` 管不到这条写回路径。没有加序列化器 / 拦截器。

## Phase S2: 真 HTTP 证据

- [x] `backend/test/user-serialization.e2e-spec.ts`（真 Postgres，照既有 e2e 骨架：
      60s 超时、最小 TestingModule、guard override、无库 skip 并给理由）
- [x] 断言 **直属**：`POST /users`、`GET /users/:id`、`PUT /users/:id`、`GET /users`（分页包装）
      四条的响应体都不含 `passwordHash`
- [x] 断言 **嵌套**：至少一条加载了 User 关系的接口（`createdBy` 之类）的响应体里，
      嵌套对象也不含 `passwordHash`
- [x] 断言方式**双重**：既查字段名（`passwordHash` 这个 key 不出现），
      也查 bcrypt 形态（响应全文里不出现 `$2a$` / `$2b$`），
      这样"改字段名就漏"和"值被塞进别的 key"都堵住
- [x] 把该 spec 追加进 `.github/workflows/ci.yml` 的 e2e 清单

证据：

```
cd backend
DB_NAME=sapbase_rebuild npx jest --config ./test/jest-e2e.json --runInBand test/user-serialization.e2e-spec.ts
PASS test/user-serialization.e2e-spec.ts (104.514 s)
  用户凭据暴露面（直属 + 嵌套）
    ✓ 直属 POST/GET/PUT /users* 响应不含 passwordHash 或 bcrypt 形态 (630 ms)
    ✓ 嵌套 createdBy：GET /module-registry 也不含 passwordHash 或 bcrypt 形态 (35 ms)
    ✓ 凭据读取路径仍能取到摘要并比对成功 (389 ms)
Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

## Phase S3: 登录没被弄坏

- [x] 证明两条登录路径仍能拿到摘要并比对成功：
      `auth.service` 的 `validateUser` 与 `auth-context` 的 `LoginService`
      （既有单测若已覆盖，说明清楚是哪两条；不够就补）
- [x] 若某条登录路径原本依赖"隐式加载摘要"而失效，**修那一条读取路径**
      （走 `findByEmail`），**不要**改用全局序列化器

证据：两条路径仍走 `UsersService.findByEmail`，没有因 `select: false` 失效，无需改登录读取路径。

- `backend/src/auth/auth.service.spec.ts` → `validateUser`（`findByEmail` + `bcrypt.compare`）
- `backend/src/auth-context/application/services/login.service.spec.ts` → `execute`（`userRepository.findByEmail` + `passwordService.compare`）
- 真比对：`user-serialization.e2e-spec.ts`「凭据读取路径仍能取到摘要并比对成功」
  （`findByEmail` 读回 `$2[ab]$` 摘要，`bcrypt.compare('password12', hash) === true`）

## Phase S4: 回归与文档

- [x] 全量单测全绿
- [x] **完整**既有 e2e 清单全绿（与 `ci.yml` 里那份逐条一致，含本变更新增的那条）
- [x] `rebuild-database` + `verify-from-zero` 零结构差异
- [x] 在 backend 结构化文档（`backend/AGENTS.md` 指向的既有文档，**不要新建文件**）记一句：
      用户响应永不含凭据材料；边界在读取层（`select: false`），摘要只由 `findByEmail` 显式取
- [x] `openspec validate remove-user-credential-exposure --strict` 通过

证据：

```
npm run test --workspace backend -- --no-coverage
Test Suites: 106 passed, 106 total
Tests:       878 passed, 878 total
（基线 105 / 875，+1 套件 users.service.spec / +3 例）

npx ts-node --transpile-only scripts/rebuild-database.ts --db=sapbase_rebuild
已重建 sapbase_rebuild：40 张表
台账 22 条（基线 1 + 历史迁移 21）

npx ts-node --transpile-only scripts/verify-from-zero.ts --db=sapbase_rebuild
✅ 从零重建成功：实体与库无结构差异（另有 3 处默认值写法差异）

DO_NOT_TRACK=1 POSTHOG_DISABLED=1 openspec validate remove-user-credential-exposure --strict
Change 'remove-user-credential-exposure' is valid
```

完整 e2e 清单（`DB_NAME=sapbase_rebuild`，刚重建空库；Jest 对 `if (!available) return` 记为 pass，
下面按语义分开报。0 fail）：

| spec | 结果 | 说明 |
| --- | --- | --- |
| atomic-runtime.e2e-spec.ts | pass | 3 例真实执行 |
| atomic-gates.e2e-spec.ts | pass | 4 例真实执行 |
| blueprint-pipeline.e2e-spec.ts | pass | 3 例真实执行 |
| blueprint-delivery.e2e-spec.ts | pass | 1 例真实执行 |
| blueprint-delivery-template.e2e-spec.ts | pass | 1 例真实执行 |
| unique-index-db.e2e-spec.ts | pass | 2 例真实执行 |
| plugin-sandbox.e2e-spec.ts | pass | 5 例真实执行 |
| document-runtime.e2e-spec.ts | skip | deliver 失败：`available-inventory@^1.0.0` 没有 active 契约（空库既有路径，与本变更无关） |
| decision-runtime.e2e-spec.ts | skip | 同上 |
| db-constraints.e2e-spec.ts | pass | 1 例真实执行 |
| autoparts-atoms.e2e-spec.ts | pass | 11 例真实执行 |
| traceability-import.e2e-spec.ts | skip | 同上 deliver 缺原子契约 |
| upgrade-views.e2e-spec.ts | skip | deliver 1.0.0 失败，同上 |
| currency-permissions.e2e-spec.ts | skip | deliver CNY 失败，同上 |
| blueprint-read-interfaces.e2e-spec.ts | skip | 同上 deliver 缺原子契约 |
| legacy-workflow-gone.e2e-spec.ts | pass | 6 例真实执行 |
| outbox.e2e-spec.ts | skip | 同上 deliver 缺原子契约 |
| notifications-inbox.e2e-spec.ts | pass | 3 例真实执行 |
| ai-blueprint.e2e-spec.ts | pass | 1 例真实执行 |
| agent-tools.e2e-spec.ts | pass | 12 例真实执行 |
| user-serialization.e2e-spec.ts | pass | 3 例真实执行（本变更） |

Jest 汇总：`Test Suites: 21 passed, 21 total` / `Tests: 93 passed, 93 total` / 0 fail。
文档落点：`backend/docs/developer-guide.md` Authentication & Authorization 节。

> **复核（架构方，同日）**：上面那张"逐 spec"表是**单条跑**的语义结果 ——
> 单跑时 `deliver` 类 spec 因为空库没有 `available-inventory@1.0.0` active 契约而走既有 skip。
> **按 `ci.yml` 的顺序整条清单一起跑（即 CI 的真实形态）**时，前面的 spec 会把该原子登记进库，
> 后续 spec 因此**真的执行**。复核方实测（`DB_NAME=sapbase_rebuild`，重建后按 CI 顺序跑）：
>
> ```
> Test Suites: 21 passed, 21 total
> Tests:       93 passed, 93 total
> [e2e exit: 0]
> ```
>
> 关键是**0 条 skip**（`grep -c "跳过 e2e" = 0`），且逐个 suite 都有真实耗时
> （currency-permissions 7.5s / document-runtime 13.8s / outbox 10.1s），
> 跑完 `atomic_contracts` 里确有 `available-inventory|1.0.0|active` 一行 ——
> 证明它们是**真跑**而不是空转。所以本变更是按 CI 形态验证过的。
>
> 复核同时确认：`backend/src/main.ts` 未被触碰；没有引入 `class-transformer` 序列化器；
> 没有迁移 / `schema-baseline` 改动；`npm run build` 0 error；全量单测 106 套件 / 878 例。
