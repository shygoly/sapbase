# Stripe 订阅配置

`migrate-to-saas-architecture` 的订阅由后端直接调用 Stripe API；前端只拿
Checkout/Portal 的短时 URL，不接触密钥。

## 1. 后端环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `STRIPE_SECRET_KEY` | 是 | Stripe secret key；缺失时订阅接口返回 400，组织/团队功能不受影响 |
| `STRIPE_WEBHOOK_SECRET` | 是 | webhook 签名密钥；缺失时 webhook 拒绝 |
| `NEXT_PUBLIC_STRIPE_PRICE_PRO` | 前端 | Pro 计划价格 ID |
| `NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE` | 前端 | Enterprise 计划价格 ID |

密钥只放部署环境/secret manager，不提交仓库，不返回给前端。

## 2. Stripe 侧配置

1. 创建 Product/Price（订阅、按月）。
2. 配置 webhook endpoint：`POST /api/organizations/:organizationId/subscriptions/webhook`。
3. 订阅事件：
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. 复制 signing secret 到 `STRIPE_WEBHOOK_SECRET`。

## 3. 流程

- `POST /api/organizations/:id/subscriptions/checkout` `{ priceId }`
  → 创建/复用 Stripe customer，返回 Checkout URL。
- `POST /api/organizations/:id/subscriptions/portal` `{ returnUrl }`
  → 返回 Customer Portal URL。
- `GET /api/organizations/:id/subscriptions/status`
  → `{ configured, organization: { planName, subscriptionStatus, ... } }`。
- webhook 校验签名后把状态写回 `organizations.subscriptionStatus`；
  前端不信任回跳参数。

## 4. 验收

未配置密钥时：

```bash
node tests/saas-organization.e2e.js
```

应看到 `configured=false`，checkout 返回 400。配置测试密钥后：

1. 用测试卡完成 Checkout；
2. 确认 webhook 把组织状态更新为 `active`；
3. 打开 Customer Portal 取消订阅，确认状态变为 `cancelled`。

真实订阅 e2e 需要 Stripe 测试账号；不要在生产用测试密钥。
