# DOMAIN.md — 领域数据契约

> **机器可校验的领域契约**。改任何 `biz_` / `app_` / `agent_` / `sys_` 表、实体或
> `app-*` / `domain-*` 服务前，先读本文件对应 `##` 小节（按聚合切片读取，勿全文加载）。
> 改动涉及表关系 / 级联 / 公式 / 状态词汇时**必须**同步对应小节，并跑
> `node scripts/check-domain-doc.mjs`。
> 表格与 YAML 块的格式契约见「附录：格式契约」。
> 文中相对路径除特别说明外均相对仓库根。
> 示例列名用 camelCase（sapbase 当前 TypeORM 默认命名）；若 manifest 是 snake_case，按实际替换。
> **覆盖矩阵只是示例**：采用时必须收录你的全部表（或先用基线把存量缺口列出来），不能照抄这 5 行。

---

## 覆盖矩阵

| 表 | 小节 |
|---|---|
| biz_order | 订单 |
| biz_order_line | 订单 |
| biz_customer | 客户 |
| app_releases | 发布 |
| agent_feedback | 智能体反馈 |

---

## 订单（app-order）

覆盖表：biz_order, biz_order_line

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| biz_order.customerId | biz_customer.id | 订单归属客户 | db-fk:fk_biz_order_customer | 删除客户前必须先处理订单 |
| biz_order_line.orderId | biz_order.id | 明细归属订单 | db-fk:fk_biz_order_line_order, service:libs/app-order/src/lib/order.service.ts#saveLines | 级联删除由服务层控制 |
| biz_order.status | dict:order_status | 订单状态 | service:libs/app-order/src/lib/order.service.ts#assertStatus | 字典仅标签，运行时由状态机校验 |
| biz_order.createdBy | sys_users.id | 创建人 | none | 审计字段，不强制外键 |

### 状态机

```text
draft → submitted → approved → fulfilled
                 ↘ cancelled
```

状态词必须与 `biz_order.status` 的 CHECK/字典一致；不得另造 `done` / `finished`。

### 不变量

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

```yaml invariant
id: INV-ORDER-GAP-01
tables: [biz_order]
desc: 待补——订单取消后应释放库存占用；当前只有手工释放，偿还条件：库存模块接入后补自动释放。
trigger: OrderService.cancel()
enforcement:
  - none
db: none
spec: TODO
```

---

## 客户（app-customer）

覆盖表：biz_customer

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| biz_customer.organizationId | sys_organizations.id | 租户归属 | db-fk:fk_biz_customer_org | RLS 最后边界 |

---

## 发布（app-release）

覆盖表：app_releases

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| app_releases.baseReleaseId | app_releases.id | 基线发布 | db-fk:fk_app_releases_base | 自引用；首版为 NULL |
| app_releases.organizationId | sys_organizations.id | 租户私有发布 | none | NULL = 平台级发布；备注说明原因 |

### 不变量

```yaml invariant
id: INV-REL-01
tables: [app_releases]
desc: 已发布 Release 的内容字段不可变；只允许状态改为 superseded/revoked。
trigger: PublishService.publish() / 直接 UPDATE
enforcement:
  - db-check:trg_app_release_guard
  - service:libs/release-kernel/src/lib/publish.service.ts#publish
db: trg_app_release_guard
spec: libs/release-kernel/src/lib/publish.service.spec.ts
```

---

## 智能体反馈（agent-feedback）

覆盖表：agent_feedback

### 关系

| 源列 | 目标 | 语义 | 强制点 | 备注 |
|---|---|---|---|---|
| agent_feedback.releaseId | app_releases.id | 反馈针对的版本 | db-fk:fk_agent_feedback_release | 必填；无版本无法复现 |

---

## 附录：格式契约

`check-domain-doc.mjs` 按以下契约解析本文件，破坏契约会导致校验失败：

1. **覆盖矩阵**：`## 覆盖矩阵` 下第一张表，表头恰为 `| 表 | 小节 |`。
   必须且仅收录 schema manifest 中全部匹配 `tablePrefixes` 的表，一表一行。
2. **聚合小节**：每个 `##` 标题下用 `覆盖表：a, b, c` 声明归属；必须与覆盖矩阵一致。
3. **关系表**：表头恰为 `| 源列 | 目标 | 语义 | 强制点 | 备注 |`。
   - 源列：`表名.列名`（物理 snake_case）。
   - 目标：`表名.列名` | `dict:<dict_type>` | `-`。
   - 强制点：逗号分隔 token：`db-fk:<约束名>` | `db-check:<约束名>` | `db-unique:<约束名>` |
     `service:<路径>#<符号>` | `policy:<路径>#<符号>` | `ui:<路径>` | `test:<路径>` | `none`。
     `none` 必须在备注说明原因。
4. **invariant 块**：围栏代码块 info-string 恰为 `yaml invariant`。字段：
   `id`（唯一，`INV-<AREA>-<NN>` 或 `INV-<AREA>-GAP-<NN>`）、`tables`（数组）、`desc`、`trigger`、
   `enforcement`（token 数组，允许 `none`）、`db`（约束名或 none）、
   `spec`（spec 路径；`TODO` 表示待补，校验降级为 WARN）。
5. **校验规则**：表/列存在性对 schema manifest；`db-*` 约束名须在 `sqlDirs` 的 SQL 中出现；
   `service`/`policy`/`ui`/`test` 的路径须存在且符号可在文件内检索到。
