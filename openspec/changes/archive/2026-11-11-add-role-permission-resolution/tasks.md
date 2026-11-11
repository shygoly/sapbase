# Implementation Tasks

## 里程碑与验收门

| 里程碑 | 范围 | 验收门（命令 + 期望） |
| --- | --- | --- |
| **P1** 解析判定 | `RolesService.findByName` + 有效权限服务 | 单元测试：并集/去重/组织隔离/停用角色/角色缺失，各一条 |
| **P2** 接进签发 | `login` 与 `switchOrganization` 共用同一判定 | 单元测试：两者签发的 `permissions` 一致且等于有效权限 |
| **P3** 真库证明 | 角色权限真的从库里来 | e2e（真 Postgres）：建组织 + 角色 + 用户 → 登录 → JWT 里含角色权限；跨组织/停用两条负例 |
| **P4** 回归 | 没弄坏既有 | 全量单测 + 既有 e2e 清单全绿；`verify-from-zero` 零结构差异 |

### 执行约定

1. 每完成一项：勾选 + 附证据（命令 + 真实输出）。
2. **并集、不减权限**：直授权限在任何分支下都必须保留 —— 有专门一条测试。
3. **组织隔离**：`findByName` 的签名必须强制带 `organizationId`，
   不允许出现"按名字全局查角色"的入口。
4. 角色解析失败（不存在/停用/无组织上下文）**不许**让登录失败，只给直授。
5. 不新增 npm 依赖；不动 schema（`roles` 表已存在，本变更只读它）。

## Phase P1: 解析判定

- [x] `backend/src/roles/roles.service.ts`：新增 `findByName(name, organizationId)`，
      只返回 `status='active'` 且属于该组织的角色（或返回 `null`）
- [x] 有效权限服务（单一判定）：输入 `{ userId 的 role, 直授权限, organizationId }`，
      输出有效权限 = 组织内同名 active 角色权限 ∪ 直授，去重、顺序稳定
- [x] 单元测试：并集；去重；**其它组织的同名角色不生效**；**停用角色不生效**；
      角色不存在 → 只留直授；`organizationId` 缺失 → 只留直授

证据（P1）：

```
$ npm run test --workspace backend -- --testPathPattern='(effective-permissions.service.spec|roles.service.spec)' --no-coverage
PASS src/auth/effective-permissions.service.spec.ts
PASS src/roles/roles.service.spec.ts
Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
```

## Phase P2: 接进签发

> **复核更正（重要）**：真正的登录门**不是** `AuthService` —— `auth.controller.ts` 的
> `POST /auth/login` 与 `POST /auth/switch-organization` 调的是 **DDD 侧**
> `auth-context/application/services/{login,switch-organization}.service.ts`，
> 而 `AuthService.login` **全仓没有任何非测试调用方**。
> 下面的 `AuthService` 两条仍然是有效的（语义一致、单一判定），
> 但**只改它等于没改到用户走的那条路**。真正的验收必须落在 DDD 那两条门上。

- [x] `AuthService.login` 用有效权限替换 `user.permissions`
      （JWT payload 与响应里的 `user.permissions` 都要换）
- [x] `AuthService.switchOrganization` 用**同一个**服务解析（不许内联第二份逻辑）
- [x] **DDD `LoginService.execute`（`POST /auth/login` 的真实落点）** 用同一个判定替换
      `permissions: user.permissions || []`；payload 与响应里的 `user.permissions` 都要换
- [x] **DDD `SwitchOrganizationService.execute`（`POST /auth/switch-organization` 的真实落点）**
      同样替换
- [x] 判定落点搬到 `RolesModule`（角色是更低的领域模块），由 `AuthModule` 与
      `AuthContextModule` 共用 —— `AuthModule` 已经 import `AuthContextModule`，
      反向依赖会形成循环，所以共享判定**不能**留在 `auth/`
- [x] DDD 侧按既有端口范式接：在 `auth-context/domain/services/` 加端口（如
      `IEffectivePermissionsResolver`），在 `auth-context/infrastructure/external/` 加适配器，
      `LoginService` / `SwitchOrganizationService` 注入**端口**而不是具体类
- [x] 单元测试：DDD 两条服务签发的 `permissions` 等于有效权限；
      解析失败（角色缺失/停用/无组织）时只留直授且**登录不失败**
- [x] 单元测试：两条路径签发的 `permissions` 一致且等于有效权限；
      `role` 字段行为不变
- [x] 单元测试：直授 ∪ 角色 → 结果是并集（不是覆盖，也不是只取角色）

证据（P2）：

```
$ npm run test --workspace backend -- --testPathPattern='(auth.service.spec|effective-permissions.service.spec|roles.service.spec)' --no-coverage
PASS src/roles/roles.service.spec.ts
PASS src/auth/effective-permissions.service.spec.ts
PASS src/auth/auth.service.spec.ts
Test Suites: 3 passed, 3 total
Tests:       20 passed, 20 total
```

既有「非空直授原样进 payload」用例仍绿（无组织上下文时只发直授）。

证据（P2 本轮 DDD 门 + 搬家）：

```
$ npm run test --workspace backend -- --testPathPattern='(effective-permissions.service.spec|roles.service.spec|auth.service.spec|login.service.spec|switch-organization.service.spec)' --no-coverage
PASS src/roles/roles.service.spec.ts
PASS src/auth-context/application/services/switch-organization.service.spec.ts
PASS src/auth-context/application/services/login.service.spec.ts
PASS src/roles/effective-permissions.service.spec.ts
PASS src/auth/auth.service.spec.ts
Test Suites: 5 passed, 5 total
Tests:       33 passed, 33 total
```

判定文件已从 `auth/` 搬到 `roles/`；`AuthService` 仍从 `RolesModule` 取同一服务。

## Phase P3: 真库证明

- [x] e2e（真 Postgres，照既有骨架）：插入组织 + 角色（带权限点）+ 用户（`role` 指向该角色），
      走真实 HTTP 登录，断言返回的 JWT payload 里含角色权限点
- [x] e2e 负例：另建一个组织放同名角色（权限不同）→ 该角色权限**不**出现在 JWT 里
- [x] e2e 负例：把角色置为 `inactive` → 角色权限**不**出现在 JWT 里，且登录仍然成功
- [x] 若有新增 e2e spec，追加进 `.github/workflows/ci.yml` 的 e2e 清单

注：按本 change 实施裁定，e2e 走 `AuthService.login` + `validateToken`（服务层 + 真库），
不接 passport / HTTP 登录。CI 清单末尾追加 `test/role-permissions.e2e-spec.ts`，未重排。

> **复核更正**：上面的服务层证明**不足以**关掉本变更 —— 它证的是 `AuthService` 这条
> **没有调用方**的路。真正的门是 `POST /auth/login` → DDD `LoginService`。
> 因此还要补：
- [x] e2e 走**真实 HTTP** `POST /auth/login`（该路由无守卫，不需要 passport）：
      真库建组织 + 成员关系 + `active` 角色（带权限点）+ 用户（bcrypt 口令、`role` 指向该角色）
      → 登录 → 从响应 token 解出 payload，断言含角色权限点
- [x] e2e 负例（同样走 HTTP）：跨组织同名角色不生效；`inactive` 角色不生效且登录仍成功
- [x] e2e 同时覆盖 `POST /auth/switch-organization`（切组织后权限按新组织解析）

证据（P3）：

```
$ cd backend && DB_NAME=sapbase_rebuild npx jest --config ./test/jest-e2e.json --runInBand test/role-permissions.e2e-spec.ts
PASS test/role-permissions.e2e-spec.ts (16.428 s)
  角色 → JWT 有效权限
    ✓ 选中组织内的 active 角色权限进入 JWT (54 ms)
    ✓ 另一个组织的同名角色权限不进入 JWT (4 ms)
    ✓ 停用角色的权限不进入 JWT，登录仍成功且直授保留 (19 ms)
Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

证据（P3 本轮真 HTTP）：

```
$ cd backend && DB_NAME=sapbase_rebuild npx jest --config ./test/jest-e2e.json --runInBand test/role-permissions.e2e-spec.ts
PASS test/role-permissions.e2e-spec.ts (7.588 s)
  角色 → JWT 有效权限
    ✓ 选中组织内的 active 角色权限进入 JWT (50 ms)
    ✓ 另一个组织的同名角色权限不进入 JWT (3 ms)
    ✓ 停用角色的权限不进入 JWT，登录仍成功且直授保留 (5 ms)
    HTTP POST /auth/login 与 /auth/switch-organization
      ✓ POST /auth/login：选中组织内的 active 角色权限进入 token 与 user.permissions (136 ms)
      ✓ POST /auth/login：另一个组织的同名角色权限不进入 token (102 ms)
      ✓ POST /auth/login：停用角色的权限不进入 token，登录仍成功且直授保留 (103 ms)
      ✓ POST /auth/switch-organization：切到另一组织后权限按新组织解析 (112 ms)
Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

Nest `@Post()` 默认 201（未改 controller 状态码）。HTTP 断言按 201。

## Phase P4: 回归与文档

- [x] 全量单测全绿（基线随前一变更而定，只准增加）
- [x] 既有 e2e 清单全绿
- [x] `rebuild-database` + `verify-from-zero` 零结构差异
- [x] 在 backend 结构化文档（`backend/AGENTS.md` 指向的既有文档，**不要新建文件**）
      记一句：有效权限 = 组织内同名 active 角色 ∪ 直授；这是访问控制行为，不是展示字段
- [x] `openspec validate add-role-permission-resolution --strict` 通过

证据（P4）：

```
$ npm run build --workspace backend
> nest build
（exit 0）

$ npm run test --workspace backend
Test Suites: 108 passed, 108 total
Tests:       890 passed, 890 total
（基线 106 / 878，只增加：+2 套件 +12 例）

$ npx ts-node --transpile-only scripts/rebuild-database.ts --db=sapbase_rebuild
已重建 sapbase_rebuild：40 张表
台账 22 条（基线 1 + 历史迁移 21）

$ npx ts-node --transpile-only scripts/verify-from-zero.ts --db=sapbase_rebuild
✅ 从零重建成功：实体与库无结构差异（另有 3 处默认值写法差异）

$ DB_NAME=sapbase_rebuild npx jest --config ./test/jest-e2e.json --runInBand \
    test/currency-permissions.e2e-spec.ts test/agent-tools.e2e-spec.ts \
    test/user-serialization.e2e-spec.ts test/notifications-inbox.e2e-spec.ts
PASS test/user-serialization.e2e-spec.ts   → 3 真跑 pass
PASS test/agent-tools.e2e-spec.ts          → 12 真跑 pass
PASS test/currency-permissions.e2e-spec.ts → 4 真 skip
  跳过 e2e：deliver CNY 失败（400 ... 没有 active 的契约：available-inventory）
PASS test/notifications-inbox.e2e-spec.ts  → 3 真 skip
  跳过 e2e：deliver 失败（400 ... 没有 active 的契约：available-inventory）
Test Suites: 4 passed, 4 total
Tests:       22 passed, 22 total
（Jest 把 early-return 计为 pass；这 4 条里没有登记 available-inventory 的 spec，
 空库一起跑也无法让 currency-permissions / notifications-inbox 真跑。）

$ DO_NOT_TRACK=1 POSTHOG_DISABLED=1 openspec validate add-role-permission-resolution --strict
Change 'add-role-permission-resolution' is valid
```

证据（P4 本轮收口）：

```
$ npm run build --workspace backend
> nest build
（exit 0）

$ npm run test --workspace backend
Test Suites: 108 passed, 108 total
Tests:       896 passed, 896 total
（上一轮收口后 108 / 890；本轮只增加：+6 例，套件数不变）

$ npx ts-node --transpile-only scripts/rebuild-database.ts --db=sapbase_rebuild
已重建 sapbase_rebuild：40 张表
台账 22 条（基线 1 + 历史迁移 21）

$ npx ts-node --transpile-only scripts/verify-from-zero.ts --db=sapbase_rebuild
✅ 从零重建成功：实体与库无结构差异（另有 3 处默认值写法差异）

$ DB_NAME=sapbase_rebuild npx jest --config ./test/jest-e2e.json --runInBand \
    test/atomic-gates.e2e-spec.ts test/blueprint-pipeline.e2e-spec.ts \
    test/plugin-sandbox.e2e-spec.ts test/currency-permissions.e2e-spec.ts \
    test/agent-tools.e2e-spec.ts test/user-serialization.e2e-spec.ts \
    test/role-permissions.e2e-spec.ts test/notifications-inbox.e2e-spec.ts
PASS test/atomic-gates.e2e-spec.ts          → 4 真跑 pass
PASS test/blueprint-pipeline.e2e-spec.ts    → 3 真跑 pass
PASS test/plugin-sandbox.e2e-spec.ts        → 5 真跑 pass
PASS test/agent-tools.e2e-spec.ts           → 12 真跑 pass
PASS test/user-serialization.e2e-spec.ts    → 3 真跑 pass
PASS test/role-permissions.e2e-spec.ts      → 7 真跑 pass
PASS test/currency-permissions.e2e-spec.ts  → 4 真 skip
  跳过 e2e：deliver CNY 失败（400 ... 没有 active 的契约：available-inventory）
PASS test/notifications-inbox.e2e-spec.ts   → 3 真 skip
  跳过 e2e：deliver 失败（400 ... 没有 active 的契约：available-inventory）
Test Suites: 8 passed, 8 total
Tests:       41 passed, 41 total
（整条按顺序一起跑后，currency / notifications 仍因缺 available-inventory 契约而 early-return。
 atomic-gates 会装 available-inventory 模块，但不会登记同名 atomic contract。）

$ DO_NOT_TRACK=1 POSTHOG_DISABLED=1 openspec validate add-role-permission-resolution --strict
Change 'add-role-permission-resolution' is valid
```
