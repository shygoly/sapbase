## ADDED Requirements

### Requirement: 用户响应不得包含凭据材料

任何返回用户数据的 HTTP 响应 MUST NOT 包含口令摘要或其它凭据材料，
**包括嵌套**的用户引用（例如某实体上的 `createdBy` / `reviewedBy` / `invitedBy` 关系）。

判定 MUST 落在**数据读取层**：口令摘要列默认 MUST NOT 被加载，只有明确的凭据读取路径
可以显式取用。因此该约束 MUST NOT 依赖"每个控制器记得手动脱敏"，
也 MUST NOT 依赖全局序列化拦截器。

判定 MUST NOT 影响凭据比对：登录仍必须能读到摘要并正确校验口令。

#### Scenario: 直属用户接口
- **WHEN** 调用 `GET /users`、`GET /users/:id`、`POST /users` 或 `PUT /users/:id`
- **THEN** 响应体（含分页包装）中 MUST NOT 出现 `passwordHash` 字段
- **AND** 响应全文 MUST NOT 出现 bcrypt 形态（`$2a$` / `$2b$` 开头）的字符串

#### Scenario: 嵌套用户引用
- **WHEN** 某个接口返回的实体通过关系带出了用户对象（如 `createdBy`）
- **THEN** 该嵌套对象同样 MUST NOT 包含 `passwordHash` 或 bcrypt 形态的字符串

#### Scenario: 凭据读取路径仍然可用
- **WHEN** 登录时按邮箱取用户以比对口令
- **THEN** 该路径 MUST 能取到口令摘要
- **AND** 正确口令 MUST 登录成功

#### Scenario: 通用查询不加载凭据
- **WHEN** 通过通用读取（按 id 取用户、列用户）取用户
- **THEN** 返回对象 MUST NOT 带口令摘要
