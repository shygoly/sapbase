# Outbox 协议（跨进程事件）

> 状态：`consolidate-platform-foundations` N0
> 相关：进程内总线 `backend/src/common/events/`；发布点在 `semantic-runtime` 的迁移 / 审批 / 导入

本文件钉跨进程事件的**形状、幂等、投递、重试、可见性、重启恢复**。
进程内领域事件（`IEventPublisher.publish`）不走本协议。

---

## 1. 两条路径（如实，不美化）

| 路径 | 用途 | 落点 |
| --- | --- | --- |
| **跨进程 / 业务事件** | 必须与业务写入同事务落库，重启后仍可投递 | `outbox_events` + 投递器 |
| **进程内领域事件** | 不需要跨进程投递 | `IEventPublisher.publish` / `publishSync` |

订阅注册**只有一处**：`EventBusService.subscribe` / `handlers/`。
投递器只做「读表 → 去重 → 按 topic 调用已注册订阅者」，**不再造第二套订阅表**。

调用约定：

- 跨进程发布：`OutboxService.publish(manager, event)`，`manager` 必须是调用方事务里的 `EntityManager`。
- 投递调用：`EventBusService.dispatchToSubscribers(topic, payload)`（按 topic **精确匹配**；`subscribeAll` 的 `*` 只服务进程内路径）。
- `IEventPublisher.publish` **只用于进程内、不需要跨进程投递**的领域事件。

---

## 2. 事件形状

`outbox_events` 一行 = 一次已发生的业务事实。

| 列 | 含义 |
| --- | --- |
| `id` | 行主键 |
| `topic` | 点分命名，见 §2.1 |
| `payload` | jsonb，只放该 topic 的字段 |
| `occurredAt` | 业务发生时间（写入时） |
| `deliveredAt` | 全部订阅者成功之后；未投递为 null |
| `attempts` | 投递尝试次数，默认 0 |
| `lastError` | 最近一次失败的错误文本 |
| `idempotencyKey` | 发布侧幂等键，**UNIQUE** |
| `status` | `pending` / `delivered` / `failed` |
| `nextAttemptAt` | 下次可投时间；新行 = 写入时刻（立即可投） |
| `organizationId` | 租户 |
| `aggregateType` / `aggregateId` | 聚合定位（可空；导入完成事件无单条记录） |
| `createdAt` / `updatedAt` | 行生命周期 |

补充列的理由：`status` + `nextAttemptAt` 让投递器按「到期未投」扫描，而不靠内存队列；
`organizationId` 做租户隔离；`aggregateType/Id` 便于按单据追查。

### 2.1 topic 与 payload

| topic | 何时写 | payload |
| --- | --- | --- |
| `blueprint.record.transitioned` | `transition` 成功改 state 之后、记账之前 | `{blueprintId, entity, recordId, from, to, version, actor}` |
| `blueprint.record.approval.pending` | `write` 新建审批链（每个新链一条，首个待审步） | `{ruleId, role, stepIndex, entity, recordId}` |
| `blueprint.record.approval.decided` | `approve` 推进/全批 | `{ruleId, role, stepIndex, entity, recordId, result, actor}` |
| `blueprint.import.completed` | `importMaster` 批处理结束后 | `{entity, imported, failed, dryRun, batchId, actor}` |

`aggregateType=entity`、`aggregateId=recordId`（导入完成事件二者为空）。

---

## 3. 幂等

### 3.1 发布侧（`idempotencyKey` UNIQUE）

调用方组键，必须**可确定且唯一到「这一次发生」**：

| 事件 | 键 |
| --- | --- |
| 迁移 | `transition:${recordId}:${from}->${to}:v${version}`（`version` 为迁移后的版本） |
| 审批待审 | `approval-pending:${recordId}:${ruleId}:${stepIndex}` |
| 审批决定 | `approval-decided:${recordId}:${ruleId}:${stepIndex}` |
| 导入完成 | `import:${entity}:${batchId}`（`batchId` 为本次 `importMaster` 调用生成） |

同一键二次 INSERT → UNIQUE 冲突 → **整笔业务事务失败**。
不要把「同一逻辑事件」发两次；重试业务写入应先被业务闸拦住（版本冲突 / 链已存在）。

### 3.2 订阅者侧（`outbox_deliveries`）

`UNIQUE(eventId, subscriber)`。投递器对每个订阅者：

1. **先 INSERT** 去重行；冲突 ⇒ 该订阅者已处理过 ⇒ **跳过，不调用**。
2. 调用订阅者。
3. 调用失败 ⇒ **删去重行**（让重试还能再调）并计入 `attempts` / `lastError`。
4. 调用成功 ⇒ 去重行保留，这就是「只处理一次」的证据，不靠订阅者自觉。

`outbox_events` = 不丢（与业务同事务）。
`outbox_deliveries` = 不重复（重复投递只处理一次）。

---

## 4. 投递语义

- **至少一次**：成功前可以多次尝试；订阅者必须能靠 §3.2 去重。
- **顺序**：同一批按 `occurredAt` 升序。
- **批量上限**：每轮最多 50 行。
- **触发**：`@Interval` 轮询 + `OutboxDispatcherService.drain()` 可手动触发（测试直接调）。
- **无订阅者**：视为投递成功（`status=delivered`）。
- **进程内不保存待投队列**：只读表。重启后新进程实例 `drain()` 即可继续。

---

## 5. 重试

退避：`nextAttemptAt = now + min(2^attempts, 3600)` 秒（`attempts` 为失败后的次数）。
上限：`attempts >= 8` ⇒ `status=failed`，**停在 failed，不静默丢弃**。
未达上限时保持 `pending`，等 `nextAttemptAt`。

---

## 6. 失败可见性

- 查询：`GET /outbox/events?status=&organizationId=`，返回含 `attempts` / `lastError` / `deliveredAt`。
- 手动重投：`POST /outbox/events/:id/redeliver` → `status=pending`、`attempts` 保留、`nextAttemptAt=now()`，随后可被投递器拾取。

租户：`organizationId` 必填（query 或当前用户）；与 JWT 租户不一致则拒。

本轮**不做** OTel / Prometheus / 指标栈；投递路径另打结构化日志（`outbox.delivered` / `outbox.failed`，含 attempts 与 lastError 摘要）。见 [`observability.md`](./observability.md)。

---

## 7. 事务边界

`publish(manager, event)` **必须**用调用方事务的 `manager`，自己不开事务、不用默认连接。

| 发布点 | 与哪笔事务同命运 |
| --- | --- |
| 迁移 | `transition` 的 `dataSource.transaction`：改 state → **发事件** → 记账。记账不平衡会回滚，事件也不留。 |
| 审批待审 | `write` 的同一事务（`ensureApprovalChains` 建链后发） |
| 审批决定 | `approve` 的同一事务 |
| 导入完成 | 各行已各自提交；批处理摘要（含本事件）在批结束后**单独一笔事务**写入。它与「导入摘要」同事务，不是与每一行同事务。 |

---

## 8. 进程内 publisher（本轮未改）

下列调用走 `IEventPublisher.publish`，**进程内，未改**。
转换触发条件：当下游需要**跨进程**消费它们时，再迁到 outbox。

N0 声明范围内点名的 6 处：

| 文件 | 事件 |
| --- | --- |
| `auth-context/application/services/login.service.ts` | `UserLoggedInEvent` |
| `auth-context/application/services/switch-organization.service.ts` | `OrganizationSwitchedEvent` |
| `ai-module-context/application/services/publish-module.service.ts` | `ModulePublishedEvent`、`ModuleRegisteredEvent` |
| `ai-module-context/application/services/generate-patch.service.ts` | `PatchGeneratedEvent` |
| `ai-module-context/application/services/create-module.service.ts` | `ModuleCreatedEvent` |
| `ai-module-context/application/services/submit-review.service.ts` | `ReviewSubmittedEvent` |

另：`organization-context/application/services/` 下还有若干进程内 `publish`（建组织 / 成员 / 邀请等），同样未改，触发条件相同。
