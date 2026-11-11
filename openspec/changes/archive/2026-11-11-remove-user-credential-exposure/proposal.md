# Change: 收敛用户凭据暴露面（响应里不再出现 passwordHash）

## Why

`GET /users`、`GET /users/:id`、`POST /users`、`PUT /users/:id` 把整个 `User` 实体塞进
`ApiResponseDto`，`passwordHash`（bcrypt 摘要）原样出现在 JSON 里。

更要紧的是**嵌套**：多个服务加载了 User 关系并一起序列化 ——
`module-registry.service` 的 `createdBy`、`ai-modules.service` 的 `createdBy` / `reviewedBy`、
`organizations.service` 的 `user` / `invitedBy`。也就是说，任何一个登录用户请求这些接口，
都能顺手拿到**别人**的口令摘要。

这不是"少一个字段"的问题：口令摘要是离线爆破的输入。拿到同事的 hash 就能在自己机器上
慢慢跑字典，与平台侧的登录限流无关。

`auth.service` 与 `auth-context` 的**登录**响应反而是显式的脱敏摘要
（`auth.service.spec.ts` 明确断言"不含 passwordHash / dataScope"）—— 说明"不该带 hash"
早有共识，只是**查询层**默认把摘要一起取了出来，于是任何直接序列化实体的接口都会漏。

## What Changes

- **ADDED**: 边界落在**数据读取层** —— `User.passwordHash` 声明为 `select: false`，
  即默认**不加载**这一列。于是直属序列化与嵌套序列化**同时**免疫，
  而且不需要任何全局序列化改造（blast radius 为零）。
- **ADDED**: 唯一允许取摘要的路径收敛为一处 —— `UsersService.findByEmail` 显式
  `addSelect` 该列，并在注释里写明"这是凭据读取路径"。平台里只有两个调用方
  （`AuthService.validateUser` 与 `auth-context` 的 `LoginService`），且两者都只返回
  显式摘要，不返回实体。
- **ADDED**: 回归测试钉死这条不变量：单元（通用查询不加载摘要、凭据路径能加载）
  + 真 HTTP e2e（直属四个接口 + 一条嵌套接口，响应体里既无 `passwordHash` 字段、
  也无 bcrypt 形态字符串）。
- **MODIFIED**: 无。不改任何既有接口的行为契约，只去掉本不该出现的字段。

## Impact

- 受影响规格：新增能力 `user-management`
- 受影响代码：`backend/src/users/user.entity.ts`、`backend/src/users/users.service.ts`
  （`findByEmail` 显式 select）、`backend/test/user-serialization.e2e-spec.ts`（新增）、
  `.github/workflows/ci.yml`（e2e 清单追加一行）
- **对外契约**：响应体收窄。若有客户端依赖 `passwordHash`，那是它在读不该读的东西；不做兼容层。
- **风险**：`select: false` 会让"忘了显式取"的读取方拿到 `undefined`。
  失败的形态是**响亮的**（登录直接失败 / `bcrypt.compare` 抛错），不是静默降级；
  且已知需要摘要的只有那两条登录路径，二者都在验收门覆盖之内。
- **不做**：不引入 `class-transformer` 序列化器、不加全局拦截器 —— 理由见 design.md 决策 2。
