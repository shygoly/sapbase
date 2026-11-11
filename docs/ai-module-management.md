# AI Module Management

AI 模块从模型配置到发布的完整流程。模块的 DSL 真源是 `ai_modules.patchContent`，
版本历史在 `ai_module_versions`；发布后由 Module Registry 承载运行时。

## 1. AI Model Configuration

入口：Console `/admin/ai-models`。

- 模型密钥只从服务端环境/密钥引用读取，前端不保存明文。
- `AIModelsService.findDefault()` 选择 active 默认模型；没有默认模型时生成类接口返回 400。
- 连接测试只验证凭据与 endpoint，不写入模块内容。
- 支持 Kimi/Anthropic 兼容 endpoint（`ANTHROPIC_BASE_URL` + `KIMI_API_KEY`）。

## 2. AI Module Development

入口：Console `/admin/ai-modules/develop`。

两种创建方式：

1. **自然语言快速生成**：`POST /ai-modules/:id/generate`，LLM 输出 Patch/DSL，服务端
   `normalizePatchContent()` 统一补 `version/patchId/timestamp/actor/scope/operation/target/payload`。
2. **六步定义向导**：object model → relationships → state flow → pages → permissions → reports；
   `POST /ai-modules/:id/generate-from-definition` 确定性转换为 Blueprint 五层，不调用 LLM 生成结构。

每次生成/修改/应用 Patch 都写 `ai_module_versions` 快照（patchContent/metadata/definition/status/actor/reason）
与 `audit_logs`（`ai_module.generate` 等）。

### 版本历史与回滚

入口：Console `/admin/ai-modules/versions`。

| 操作 | API | 说明 |
|---|---|---|
| 列表 | `GET /ai-modules/:id/versions?page=&pageSize=` | 最新在前 |
| 详情 | `GET /ai-modules/:id/versions/:versionId` | 单条快照 |
| diff | `GET /ai-modules/:id/versions/diff?from=&to=` | 递归 path/from/to 变更 |
| 回滚 | `POST /ai-modules/:id/versions/:versionId/rollback` | 恢复内容并把状态打回 `draft` |

回滚不删除历史，也不直接发布：必须重新测试、提交评审、审批后才能发布。

## 3. AI Module Testing

入口：Console `/admin/ai-modules/test`，接口 `POST /ai-modules/:id/test`。

测试直接校验 `patchContent.objects`（或 `semantic.entities`）的字段与关系，不再“模拟 500ms 全过”：

| 场景 | 必填字段（任一命中） | 关系（可选提示） |
|---|---|---|
| Customer | `id`、`name/customerName`、`email/contactEmail` | orders/transactions |
| Order | `id`、`orderNo/orderNumber/number`、`total/totalAmount/amount`、`status` | customer/items/tracking |
| OrderTracking | `id`、`orderId/order`、`status`、`timestamp/trackedAt/createdAt` | order |
| FinancialTransaction | `id`、`transactionNumber/transactionNo/number`、`amount`、`type/transactionType`、`status` | order/customer |

结果写 `ai_module_tests`，并汇总到 `ai_modules.testResults`：

```json
{
  "total": 4,
  "passed": 3,
  "failed": 1,
  "skipped": 0,
  "coverage": { "scenarios": 4, "passed": 3, "failed": 1, "percent": 75, "entities": 3 },
  "tests": [{ "name": "Customer CRUD", "entityType": "Customer", "status": "passed" }]
}
```

存在 `failed` 时 `POST /ai-modules/:id/submit-review` 拒绝提交。

## 4. Review and Approval

入口：Console `/admin/ai-modules/review`。

- 状态机：`draft/testing` → `pending_review` → `reviewing` → `approved/rejected`。
- 评审写入 `ai_module_reviews`（decision/comments/rejectionReason/reviewerId/reviewedAt）。
- 评审结果生成 `ai_module_review-<decision>` 版本快照，并向创建人发通知
  （分类 `approval`，动作链接 `/admin/ai-modules/review`）。
- 作者不得批准自己起草的模块（沿用 D-4 作者 ≠ 批准人）。

## 5. Publishing / Unpublishing

入口：Console `/admin/ai-modules/publish`。

- 只有 `approved` 模块可发布；发布注册到 Module Registry 并记录 `publishedAt`。
- 下架只改状态为 `unpublished`，不隐式改写 DSL；需要回退内容请走版本历史。
- 发布/下架都写版本快照与审计日志。

## 6. Audit

所有 AI 模块操作写 `audit_logs`：

| action | 触发 |
|---|---|
| `ai_module.create` | 创建草稿 |
| `ai_module.update` | 编辑元数据 |
| `ai_module.generate` / `ai_module.modify` | 自然语言生成/修改 |
| `ai_module.generate-from-definition` | 六步定义生成 |
| `ai_module.test` | 运行 CRM 测试 |
| `ai_module.submit-review` | 提交评审 |
| `ai_module.review-approved` / `ai_module.review-rejected` | 评审结果 |
| `ai_module.publish` / `ai_module.unpublish` | 上下架 |
| `ai_module.rollback:<versionId>` | 回滚 |
| `ai_module.delete` | 删除模块 |

## 7. 边界

- Module DSL 只读浏览/导出见 `docs/module-dsl.md`；Patch DSL 增量修改见 `docs/patch-dsl.md`。
- 版本快照是内容历史，不是发布物；发布物仍是 Module Registry / erpkg。
- 不做用户自定义脚本；LLM 输出必须经服务端 Schema/Blueprint 校验。
