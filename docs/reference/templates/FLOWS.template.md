# FLOWS.md — 调度总表与业务线步骤链

> **机器可校验的业务流程契约**。每条业务线的步骤链以 `yaml flow` 围栏块声明，
> producer/consumer 配对防止“产生对象无人消费”或“消费对象无人产生”的死边。
> 调度总表与代码侧 registry `jobKey` + 装饰器 `name` 三向对拍，
> 校验由 `node scripts/check-meta-docs.mjs` 强制。
> 改 cron / 改业务线步骤链时必须同步本文件并通过校验。
> 文中相对路径除特别说明外均相对仓库根。

---

## 调度总表

与 `apps/api/src/monitor/scheduled-job.registry.ts` 的 `jobKey` 和
各 job service 的 `@Cron(..., { name: ... })` 三向对拍。新增/改名 cron 必须三处同步。

| jobKey | 触发时点 | 入口 | 作用 |
|---|---|---|---|
| `order.close_expired` | `0 2 * * *`（每日 02:00） | `libs/app-order/src/lib/order-job.service.ts#closeExpired` | 关闭超时未支付订单 |
| `order.notify_due` | `*/15 * * * *`（每 15 分钟） | `libs/app-order/src/lib/order-job.service.ts#notifyDue` | 推送待审批订单提醒 |
| `release.eval_nightly` | `30 3 * * *`（每日 03:30） | `libs/release-kernel/src/lib/eval-job.service.ts#runNightly` | 跑稳定版 Agent 评测 |

**错峰约定**：日任务集中在 02:00–04:00；推送类按 15 分钟错峰，避免同批查询争用资源。

---

## 业务线步骤链

每条链以 `yaml flow` 围栏块声明，字段：
- `id`（唯一，`FLOW-<AREA>-<NN>`）
- `name`、`trigger`（cron jobKey 或事件）
- `steps[]`：每步 `actor`（path#symbol）+ `produces`（创建/更新的对象）+ `consumes`（引用的前置对象）
- `dead_edge_check`：列出 producer→consumer 配对，校验器据此防死边

### 1. 订单提交到履约

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
  - actor: libs/app-order/src/lib/order.service.ts#markFulfilling
    produces: [biz_order(status=fulfilling)]
    consumes: [biz_shipment]
dead_edge_check:
  - producer: submit → outbox:order.submitted
    consumer: onOrderSubmitted ← outbox:order.submitted
  - producer: onOrderSubmitted → biz_shipment
    consumer: markFulfilling ← biz_shipment
```

### 2. 超时订单关闭

```yaml flow
id: FLOW-ORDER-02
name: 超时订单关闭
trigger: order.close_expired
steps:
  - actor: libs/app-order/src/lib/order-job.service.ts#closeExpired
    produces: [biz_order(status=cancelled, close_reason=TIMEOUT)]
    consumes: [biz_order(status=draft, created_at < now()-24h)]
dead_edge_check:
  - producer: closeExpired → biz_order(cancelled)
    consumer: 订单列表/报表读取 cancelled 状态
```

**说明**：关闭前必须检查是否已支付；已支付订单走退款流程，不在本 job 处理。

---

## 附录：cron 命名空间约定

- `<domain>.<action>` 格式：`order.` / `release.` / `agent.` / `sys.`
- 新增 cron 必须三处同步：本表 + registry + 对应 job service 的装饰器
- 推送类错峰；日任务集中在低峰
- 每个 job 必须：可重入、幂等、有超时、失败可见、可手动重放
