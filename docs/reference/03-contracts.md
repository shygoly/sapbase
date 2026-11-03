# 03 · 四份机器可校验契约

> 本文件定义 `DOMAIN.md` / `FLOWS.md` / `DECISIONS.md` / `AGENT-TOOLS.md` 的**格式契约**。
> 格式不是文风问题：校验器按这些表头与围栏块解析，破坏格式等于破坏契约。
> 参考实现见 [`scripts/`](./scripts/)，可复制骨架见 [`templates/`](./templates/)。

---

## 0. 为什么文档要能被机器校验

人工评审能发现“写得不对”，但发现不了“写得和代码不一致”。典型漂移：

- 表加了一列，`DOMAIN.md` 没加；
- cron 改名了，`FLOWS.md` 还是旧名；
- 代码里写了 `D-27`，`DECISIONS.md` 里没有；
- `tools.json` 加了一个写工具，但没声明确认策略；
- 发布表允许 `UPDATE`，于是“不可变”只写在文档里。

机器校验不保证设计正确，但它保证**文档与代码至少在同一页**。
设计是否正确，仍由人评审与测试证明。

---

## 1. 四份契约的分工

| 契约 | 回答 | 真源 | 校验器 | 失败级别 |
|---|---|---|---|---|
| `DOMAIN.md` | 有哪些表/列/关系？哪些不变量必须成立？ | 表结构 + 关系 + `yaml invariant` | `check-domain-doc.mjs` | E |
| `FLOWS.md` | 什么时候跑什么？业务线谁产出、谁消费？ | 调度总表 + `yaml flow` | `check-meta-docs.mjs` | E |
| `DECISIONS.md` | 为什么这样设计？哪些决策不可回退？ | `yaml decision` | `check-meta-docs.mjs` | E |
| `AGENT-TOOLS.md` | 智能体能调用什么？写操作怎么确认？ | `contracts/tools.json` + 表格 | `check-agent-tools.mjs` | E |
| `RELEASE`（运行时） | 发布是否不可变？激活是否唯一？ | PG 表 + 服务层 | DB 约束 + 测试 | E |

**命名空间正交**：

```text
D-x      架构决策        DECISIONS.md
TD-x     技术债          docs/tech-debt.md
INV-x    不变量          DOMAIN.md / 01-meta-model.md
FLOW-x   业务线          FLOWS.md
```

同一个设计点可以同时有 `D-x` 与 `INV-x`，但编号独立，禁止混用前缀。

---

## 2. `DOMAIN.md` 格式

### 2.1 覆盖矩阵

必须是 `## 覆盖矩阵` 下的第一张表，表头**恰好**：

```markdown
| 表 | 小节 |
|---|---|
| biz_order | 订单 |
| biz_order_line | 订单 |
```

规则：

- 必须且仅收录 schema manifest 中匹配 `tablePrefixes` 的全部表；一表一行。
- “小节”必须是文档里真实存在的 `##` 标题（不含 `## ` 前缀）。
- 同一张表只能出现一次。
- 全局表（无 `organization_id`）在“小节”或备注里注明“全局表”。

### 2.2 聚合小节

每个聚合一个 `##` 标题，建议格式：

```markdown
## 订单（app-order）

覆盖表：biz_order, biz_order_line

### 关系
...
### 状态机
...
### 不变量
...
```

- `覆盖表：` 一行，逗号分隔，必须与覆盖矩阵一致。
- 小节内可以有任意说明，但**关系表与 invariant 块**必须符合下面的格式。

### 2.3 关系表

表头**恰好**：

```markdown
| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| biz_order.customerId | biz_customer.id | 订单归属客户 | db-fk:fk_biz_order_customer | 删除客户前必须先处理订单 |
| biz_order.status | dict:order_status | 订单状态 | service:libs/app-order/src/lib/order.service.ts#assertStatus | 字典仅标签，运行时由状态机校验 |
```

规则：

- **源列**：`表名.列名`，列名以 schema manifest 为准（TypeORM 默认 camelCase；Prisma/SQL 常见 snake_case）；表与列必须存在于 manifest。
- **目标**：`表名.列名` | `dict:<dict_type>` | `-`。
- **强制点**：逗号分隔 token：

| token | 含义 | 校验 |
|---|---|---|
| `db-fk:<约束名>` | 数据库外键 | 约束名必须出现在 `sqlDirs` 的 SQL 中 |
| `db-check:<约束名>` | 数据库 CHECK | 同上 |
| `db-unique:<约束名>` | 数据库唯一约束 | 同上 |
| `service:<path>#<symbol>` | 服务层强制 | 文件存在，且文件内能检索到 symbol |
| `policy:<path>#<symbol>` | 纯策略函数强制 | 同上 |
| `ui:<path>` | 仅 UI 强制 | 文件存在 |
| `test:<path>` | 仅测试强制 | 文件存在 |
| `none` | 不强制 | **备注必须非空并说明原因** |

- 一个关系可以有多个强制点，逗号分隔；`none` 不能与其他 token 并用。
- `db:<约束名>` 与 `db-fk:` 的区别：前者是 invariant 的汇总字段，后者是关系表的强制点。

### 2.4 invariant 块

围栏代码块 info-string **恰好** `yaml invariant`：

```yaml invariant
id: INV-ORDER-01
tables: [biz_order, biz_order_line]
desc: 订单提交前必须至少有一行明细，且金额合计等于明细金额之和（精度 2 位）。
trigger: OrderService.submit()
enforcement:
  - service:libs/app-order/src/lib/order.service.ts#submit
  - policy:libs/domain-order/src/lib/order-total.ts#assertTotal
db: ck_biz_order_total
spec: libs/app-order/src/lib/order.service.spec.ts
```

字段：

| 字段 | 必填 | 规则 |
|---|---|---|
| `id` | ✅ | `INV-<AREA>-<NN>` 或 `INV-<AREA>-GAP-<NN>`；全局唯一 |
| `tables` | ✅ | 数组；每张表必须在覆盖矩阵里 |
| `desc` | ✅ | 一句话说清“什么条件下必须成立” |
| `trigger` | ✅ | 入口方法/事件/作业 |
| `enforcement` | ✅ | token 数组；允许 `none`（需在 `desc` 说明原因） |
| `db` | 否 | 约束名或 `none`；默认 `none` |
| `spec` | 否 | 测试文件路径；`TODO` 表示待补，校验降级为 WARN |

**GAP 块**：用于记录“知道但还没补”的不变量。`INV-<AREA>-GAP-<NN>` 允许 `spec: TODO`，
但必须在 `desc` 写清偿还条件；CI 输出 WARN，不阻断。

### 2.5 附录：格式契约

`DOMAIN.md` 末尾保留一节 `## 附录：格式契约`，复述上面规则。校验器不解析这一节，
但人和 Agent 需要它。附录是契约的一部分，改格式必须同步改校验器与本文件。

### 2.6 manifest 从哪来

校验器不直接依赖某个 ORM。它读 `meta.config.json` 的 `schema`：

```jsonc
{
  "schema": {
    "kind": "manifest",                 // manifest | prisma | sql
    "path": "contracts/schema-manifest.json",
    "tablePrefixes": []
  }
}
```

- `manifest`：`{ "tables": { "biz_order": { "columns": ["id", "customer_id"] } } }`。
  由 `scripts/schema-manifest.*` 从 TypeORM/Prisma 生成；推荐用于 sapbase（TypeORM）。
- `prisma`：直接解析 `schema.prisma` 的 `model` / `@@map` / `@map`。
- `sql`：解析 `CREATE TABLE` 语句，适合以 SQL 为真源的迁移。

**原则**：DOMAIN 校验的是“文档 vs 结构”，不关心结构由谁生成。换 ORM 不应换文档格式。

---

## 3. `FLOWS.md` 格式

### 3.1 调度总表

必须是 `## 调度总表` 下的第一张表，建议表头：

```markdown
| jobKey | 触发时点 | 入口 | 作用 |
|---|---|---|---|
| `order.close_expired` | `0 2 * * *`（每日 02:00） | `libs/app-order/src/lib/order-job.service.ts#closeExpired` | 关闭超时未支付订单 |
```

规则：

- 第一列必须是反引号包裹的 `<domain>.<action>`；`domain` / `action` 只允许 `[a-z][a-z0-9_]*`。
- `jobKey` 全局唯一。
- 必须在 registry 文件里出现 `jobKey: '<同名>'`。
- 必须在代码里出现同名装饰器（`@Cron(..., { name: '<同名>' })`）。
- 三者集合必须**完全相等**：多一个、少一个都失败（INV-FLOW-01）。

registry 约定：

```ts
// apps/api/src/monitor/scheduled-job.registry.ts
export const SCHEDULED_JOBS = [
  { jobKey: 'order.close_expired', cron: '0 2 * * *', timeoutMs: 60_000, idempotent: true },
] as const
```

### 3.2 业务线块

围栏代码块 info-string **恰好** `yaml flow`：

```yaml flow
id: FLOW-ORDER-01
name: 订单提交到履约
trigger: order.submit
steps:
  - actor: libs/app-order/src/lib/order.service.ts#submit
    produces: [biz_order(status=submitted), outbox:order.submitted]
    consumes: [biz_cart, biz_customer]
  - actor: libs/app-fulfillment/src/lib/fulfillment.service.ts#onOrderSubmitted
    produces: [biz_shipment(status=pending)]
    consumes: [outbox:order.submitted]
dead_edge_check:
  - producer: submit → outbox:order.submitted
    consumer: onOrderSubmitted ← outbox:order.submitted
```

字段：

| 字段 | 必填 | 规则 |
|---|---|---|
| `id` | ✅ | `FLOW-<AREA>-<NN>`；全局唯一 |
| `name` | ✅ | 一句话 |
| `trigger` | ✅ | `jobKey` 或 `event:<name>` 或 `manual:<entry>` |
| `steps` | ✅ | 至少一步；每步 `actor` / `produces` / `consumes` |
| `dead_edge_check` | 建议 | producer/consumer 配对；多步链路必须有 |

规则：

- `actor` 是 `path#symbol`；路径必须存在，symbol 必须能检索到。
- `produces` / `consumes` 是对象记号：`表(条件)`、`outbox:<event>`、`dict:<name>`、`Oracle 视图` 等。
- `dead_edge_check` 的 producer 必须匹配某个 step 的 `produces`，consumer 必须匹配某个 step 的 `consumes`；
  校验器做前缀/包含匹配，不要求完全相等。
- 单步 flow 可以没有 `dead_edge_check`；多步没有则 WARN。

### 3.3 附录：cron 命名空间

- `<domain>.<action>`；domain 用小写单数名词（`order`、`inventory`），action 用动词（`close_expired`）。
- 同一 domain 的 cron 尽量错峰；在附录写清错峰约定。
- 新增 cron 必须三处同步：`FLOWS.md` + registry + 装饰器。

---

## 4. `DECISIONS.md` 格式

### 4.1 decision 块

围栏代码块 info-string **恰好** `yaml decision`：

```yaml decision
id: D-12
title: 发布版本不可变，修复必须发新版本
status: accepted
date: 2026-10
context: |
  早期“发布”只是上传 Blueprint 包，覆盖同名版本；出问题无法复现，
  也无法判断某个租户到底跑的是哪份定义。
decision: |
  app_releases 的 published 行只读；内容字段由数据库触发器拒绝 UPDATE。
  任何修复产生新的 semver + 新 digest；回退 = 重新激活旧 release。
references:
  - INV-REL-01
  - INV-REL-07
  - docs/reference/04-versioning-release.md
code_markers:
  - libs/release-kernel/src/lib/publish.service.ts
  - libs/release-kernel/src/lib/activate.service.ts
```

字段：

| 字段 | 必填 | 规则 |
|---|---|---|
| `id` | ✅ | `D-<NN>`；全局唯一、只增不减 |
| `title` | ✅ | 一句话 |
| `status` | ✅ | `proposed` / `accepted` / `superseded` / `deprecated` |
| `date` | 建议 | `YYYY-MM` |
| `context` | 建议 | 为什么需要这个决策 |
| `decision` | ✅ | 决定了什么、边界在哪 |
| `references` | 建议 | 关联 `INV-x` / `DOMAIN` / 文档 |
| `code_markers` | 建议 | 代码落点；用于反向检索 |

### 4.2 代码标记规则

- 代码里写 `D-12` 表示“这段实现对应决策 12”。
- 校验器只认**独立词边界**的 `D-<数字>`：前面不能是字母/数字，避免 `FLOW-WARD-01` 误匹配。
- `TD-x` 不是 `D-x`，不会被要求登记到 `DECISIONS.md`；但必须登记到 `docs/tech-debt.md`（人工评审）。
- 一个决策被推翻：不改旧块，新增 `status: superseded` + 新 `D-x`，在旧块 `references` 指向新块。

### 4.3 什么时候必须立 D-x

- 换了不可逆的技术选型（ORM、消息、存储、认证）。
- 引入新的跨模块依赖方向。
- 规定了一个“以后都不能这么做”的边界。
- 对已有决策的推翻。

**不需要 D-x**：普通 bugfix、样式调整、单个模块内部重构（除非改变了边界）。

---

## 5. `AGENT-TOOLS.md` 格式

### 5.1 机器真源是 `contracts/tools.json`

`tools.json` 的形状由 `schemas/agent-tool.schema.json` 约束。`AGENT-TOOLS.md` 是**人读索引**，
必须与 `tools.json` 完全一致；校验器做集合对拍。

### 5.2 表格

表头**恰好**：

```markdown
| 工具 | 权限 | 写 | 确认 | 超时(ms) | 不可信结果 | 敏感参数 | 允许的智能体 | 处理器 |
|---|---|---|---|---|---|---|---|---|
| `erp_order_get` | `tool:order:read` | 否 | none | 5000 | 否 | - | `piagent-runtime` | `libs/agent-tools/src/lib/order.ts#getOrder` |
| `erp_order_create` | `tool:order:write` | 是 | required | 5000 | 否 | `customerName` | `piagent-runtime` | `libs/agent-tools/src/lib/order.ts#createOrder` |
```

规则：

- 工具名必须与 `tools.json` 的 `name` 完全一致；snake_case，带至少一个下划线。
- 权限格式 `tool:<domain>:<action>`。
- 写 `是` ⇒ 确认 `required`；写 `否` ⇒ 默认 `none`，敏感读操作可用 `required`（需在备注/描述说明）。写 `是` 配 `none` 直接失败。
- 超时 100–60000。
- 不可信结果 `是/否` 对应 `untrustedResult`。
- 敏感参数用逗号分隔，或 `-`。
- 允许的智能体：`piagent-runtime` / `piagent-builder` / `*`；必须与 `allowedAgents` 一致。
- 处理器：`path#symbol` 或 `-`（`-` 表示平台内置/由 registry 直接分派）。
  非 `-` 时，文件必须存在且 symbol 可检索。

### 5.3 执行链（固定顺序）

```text
契约查得到？
  → 参数形状合法？
  → 权限 all-of 满足？
  →（写操作）确认令牌有效？
  → 执行
  → 审计（成功与失败都写）
```

任一步不过即拒，**不部分执行、不回退到“换个工具试试”**。

### 5.4 双 profile 的能力矩阵

| 能力 | `piagent-runtime` | `piagent-builder` |
|---|---|---|
| 业务答疑 | ✅ | ✅ |
| 查业务数据 | ✅（按权限/租户） | ✅（只读） |
| 新建/修改业务数据 | ✅（确认令牌） | ⛔ |
| 读取反馈/指标 | ⛔ | ✅ |
| 起草变更提议 | ⛔ | ✅ |
| 校验/编译/预览 | ⛔ | ✅ |
| 批准/发布/激活 | ⛔ | ⛔（平台只允许人） |
| 修改知识/规则 | ⛔ | ✅（只能提议） |

矩阵不是提示词，是 `allowedAgents` + 权限点 + 服务端校验。

### 5.5 错误码

工具失败统一返回：

```json
{ "ok": false, "error": { "code": "DENIED", "message": "...", "details": {} } }
```

| code | 含义 | 智能体应对 |
|---|---|---|
| `DENIED` | 无权限 | 如实说明，不换工具绕过 |
| `INVALID_ARGS` | 参数不合契约 | 按提示修正后重试一次 |
| `NOT_FOUND` | 对象/工具不存在 | 说明“没有这个能力/找不到” |
| `CONFLICT` | 状态不允许 | 说明当前状态，不强行重试 |
| `TIMEOUT` | 超时 | 可稍后重试一次 |
| `UNAVAILABLE` | 后端暂不可用 | 可稍后重试一次 |
| `INTERNAL` | 平台错误 | 不重试，提示联系管理员 |

---

## 6. Release 运行时契约（不是文档）

发布/激活的不可变性不能只写在文档里，必须有 DB 与服务层强制。详见
[`04-versioning-release.md`](./04-versioning-release.md) §7。最小要求：

1. `app_releases` 的 `published` 行，内容字段拒绝 `UPDATE`（触发器）。
2. `release_digest` 由平台重算；客户端值只用于比对，不用于写入。
3. `app_release_activations` 只追加；唯一索引保证一个 org 只有一个 active（cohort 例外）。
4. 每个业务请求/Agent turn 记录 `release_id`。
5. 回退是新增 activation，不是修改旧 release。

---

## 7. 校验器与 CI

### 7.1 配置

根目录 `meta.config.json`（模板见 `scripts/meta.config.example.json`）：

```jsonc
{
  "docs": {
    "domain": "DOMAIN.md",
    "flows": "FLOWS.md",
    "decisions": "DECISIONS.md",
    "agentTools": "AGENT-TOOLS.md"
  },
  "code": {
    "roots": ["apps", "libs", "backend/src", "speckit/src"],
    "extensions": [".ts", ".tsx"],
    "ignoreDirs": ["node_modules", ".next", "dist", "coverage", ".nx", ".git"]
  },
  "schema": {
    "kind": "manifest",
    "path": "contracts/schema-manifest.json",
    "tablePrefixes": []
  },
  "cron": {
    "registry": "apps/api/src/monitor/scheduled-job.registry.ts",
    "decoratorPatterns": ["@Cron\\([^)]*name:\\s*['\"]([^'\"]+)['\"]"]
  },
  "agentTools": {
    "contract": "contracts/tools.json",
    "handlerRoots": ["libs/agent-tools/src", "backend/src/agent-tools"],
    "handlerPattern": "toolName\\s*:\\s*['\"]([^'\"]+)['\"]"
  },
  "sqlDirs": ["sql", "tools/postgres/init", "backend/src/migrations"]
}
```

### 7.2 命令

```bash
node docs/reference/scripts/check-domain-doc.mjs
node docs/reference/scripts/check-meta-docs.mjs
node docs/reference/scripts/check-agent-tools.mjs
node docs/reference/scripts/check-all.mjs
```

参数：

| 参数 | 作用 |
|---|---|
| `--config <path>` | 指定配置，默认根目录 `meta.config.json` |
| `--warn-only` | 有错误也退出 0（采用初期用） |
| `--json` | 机器可读输出，CI 汇总用 |
| `--baseline <path>` | 只报基线之外的新问题（存量债务用） |

退出码：`0` 通过（或有 WARN）；`1` 有 ERR；`2` 配置/IO 错误。

### 7.3 CI 顺序

```text
1. check:domain      结构/关系/不变量
2. check:meta        cron/D-x/flow
3. check:agent-tools 工具面
4. typecheck
5. test
6. build
```

前三个是秒级；任何 ERR 直接挡 PR。`--warn-only` 只用于采用初期（建议不超过 2 个迭代）。

### 7.4 基线（存量债务）

采用时存量违规可能很多。用 `meta-baseline.json` 记录：

```json
{
  "check-domain-doc": ["DOMAIN.md:12 未收录 biz_legacy_x"],
  "check-agent-tools": []
}
```

- 基线内的错误降级为 WARN；基线外的新错误仍然 ERR。
- `--update-baseline` 必须在 PR 里单独提交并说明；禁止顺手更新基线“洗绿”。
- 基线只能缩小，不能扩大；每月 review 一次。

---

## 8. 校验器不能证明什么

| 能证明 | 不能证明 |
|---|---|
| 表/列/关系名对得上 | 关系语义是否合理 |
| cron 三处一致 | cron 时间是否符合业务 |
| `D-x` 都有登记 | 决策是否正确 |
| 工具都有契约与处理器 | 工具实现是否安全 |
| 写工具都有确认 | 确认 UI 是否让人看懂 |
| 发布行不可变 | 发布内容是否该发 |

**结论**：机器校验负责“一致性”，人负责“正确性”，测试负责“行为”，评测负责“智能体质量”。
四者缺一不可，不能互相替代。

---

## 9. 反模式

| 反模式 | 为什么错 | 正确做法 |
|---|---|---|
| 文档写一套、代码写一套，靠 PR 描述同步 | 下一个人/Agent 读不到 | 进契约 + checker |
| 为了让 check 过，把表从覆盖矩阵删掉 | 掩盖未归属表 | 补归属或登记 GAP |
| 基线只增不减 | 债务永久化 | 基线只缩不扩，月度 review |
| 用 `@Cron('...')` 不写 `name` | 三向对拍失效 | 必须 `{ name: '<jobKey>' }` |
| 写工具声明 `confirmation: none` | 无人确认的写通道 | schema 直接拒绝 |
| 工具没有处理器但留在 `tools.json` | 智能体选到就报错 | 契约/处理器集合对拍 |
| 把 `INV-x` 写成“建议” | 不变量失去强制力 | 要么有强制点，要么降级为设计说明 |
