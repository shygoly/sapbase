> 当前进度（2026-11-09）：状态机 + 持久化/RLS + 类型注册 + PG 队列 + worker/lease/
> 重试/DLQ/取消 + 外部任务 API + 回调签名/SSRF + 事件回放已落地；
> 剩余：Redis 唤醒、SSE/WebSocket、事件保留期、消费方接入、管理面/指标、Agent 长任务。

## 1. 契约与元语

- [x] 1.1 定义 `job` / `job-attempt` / `job-event` / `job-type` 的持久化形状与 JSON Schema（`schemas/async-job.schema.json`）
- [x] 1.2 在 `docs/META_LANGUAGE.md` 登记任务/回调术语与不变量（INV-JOB-01..05）
- [x] 1.3 在 `DOMAIN.md` 新增任务小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [x] 1.4 未启用 cron：worker interval + poll 兜底，不登记 FLOWS（避免三处不同步）
- [x] 1.5 在 `DECISIONS.md` 登记 PG 真源 + Redis 唤醒、至少一次 + 幂等、Agent Runtime 边界（D-7/D-8/D-9）

## 2. 存储与 RLS

- [x] 2.1 迁移：`jobs` / `job_attempts` / `job_events`
- [x] 2.2 索引：`(status, runAt, priority)`、`(organizationId, status, createdAt)`、幂等唯一约束
- [x] 2.3a 新表加入 `TENANT_RLS_DDL`
- [x] 2.3b 跨租户负例（jobs RLS e2e）
- [x] 2.4 TypeORM 实体与模块注册

## 3. 任务类型注册

- [x] 3.1 `JobTypeDefinition` + registry（payload schema、handler、timeout、retry、concurrency）
- [x] 3.2 启动时校验重复类型/非法 schema
- [x] 3.3 未知类型/非法 payload 拒绝入队
- [x] 3.4 类型版本 `typeVersion` 与兼容策略（同 type 多版本并存，按 version 取 handler）
- [x] 3.5 单测：注册、校验、未知类型

## 4. 队列与 worker

- [x] 4.1 `JobQueue` 接口 + PG 实现（`FOR UPDATE SKIP LOCKED`）
- [ ] 4.2 Redis 唤醒 + cron 兜底扫描
- [x] 4.3 worker 领取/lease/heartbeat/超时重新入队
- [x] 4.4a 并发/优先级（按类型并发上限 + priority/runAt 排序）
- [x] 4.4b 限流（按组织/分钟窗口，超限 429）
- [x] 4.5 优雅停机/取消协作
- [x] 4.6 单测/e2e：并发领取、崩溃恢复、重复领取

## 5. 生命周期与重试

- [x] 5.1 状态机：queued/running/succeeded/failed/cancelled/waiting/dead
- [x] 5.2 进度/阶段/日志事件
- [x] 5.3 超时/重试/指数退避（纯逻辑）
- [x] 5.4 DLQ：dead 任务、手动重放
- [x] 5.5 取消：queued/running/waiting
- [x] 5.6 单测：超时、重试、DLQ、取消

## 6. 幂等

- [x] 6.1 唯一键 `(organizationId, type, idempotencyKey)`
- [x] 6.2 重复入队返回已存在任务
- [x] 6.3a handler 幂等约定写入 META/DECISIONS（至少一次）
- [ ] 6.3b handler 重复执行/幂等测试
- [x] 6.4 外部 Idempotency-Key 头/字段

## 7. 外部任务 API

- [x] 7.1 `POST /jobs` 创建（类型/权限/配额/payload 校验）
- [x] 7.2 `GET /jobs/:id` 状态/进度/结果/错误
- [x] 7.3 `POST /jobs/:id/cancel`
- [x] 7.4 列表查询（管理员/所有者）
- [x] 7.5 组织/应用上下文来自可信身份，不接受 body 覆盖
- [x] 7.6 最大 payload/排队配额（速率限制见 4.4b）
- [x] 7.7 API 文档与 `api-client`（`jobsApi`）

## 8. 外部回调

- [x] 8.1 `callbackUrl` / `callbackSecretRef` / HMAC 签名
- [x] 8.2 回调重试/退避/超时/2xx 判定
- [x] 8.3 SSRF 防护：https/allowlist/私网默认拒绝/禁止重定向
- [x] 8.4 回调状态查询与手动重放
- [x] 8.5 负例：伪造签名、内网地址、重定向、超时、重复回调

## 9. 进度事件

- [x] 9.1 `job_events` 写入与序号
- [x] 9.2 SSE 推送（`GET /jobs/:id/stream`，轮询事件表）
- [x] 9.3 `afterSeq` 回放（HTTP）
- [x] 9.4 事件保留期/清理（`pruneEvents`，dead 任务保留完整事件）
- [x] 9.5a 序号唯一 + 冲突重试（乱序/重复）
- [x] 9.5b 断线重连：`afterSeq` 回放 e2e + SSE 从 cursor 继续

## 10. 消费方接入

- [ ] 10.1 导入/导出任务（配合 `add-bulk-import-export-framework`）
- [ ] 10.2 媒体扫描/转码任务（配合 `add-asset-and-media-pipeline`）
- [ ] 10.3 文档解析任务（配合 `add-document-intelligence`）
- [ ] 10.4 Agent 长任务：携带 `agentRunId`，桥接事件，不复制 run 状态
- [ ] 10.5 内容生成任务

## 11. 管理面与观测

- [x] 11.1 任务中心：列表/筛选/详情/事件（web-console `/admin/jobs`）
- [x] 11.2a 重试/取消/DLQ 重放 API
- [x] 11.2b 管理 UI 操作入口（取消/重试/DLQ/回调重放）
- [x] 11.3 指标：状态/积压/回调失败统计（`GET /jobs/stats`；P50/P95 耗时由指标 change 接入）
- [ ] 11.4 告警：积压/失败率/超时
- [x] 11.5 权限点：`jobs:read` / `jobs:manage`

## 12. 验收

- [x] 12.1 事务回滚不留任务
- [x] 12.2 重复幂等键只执行一次
- [x] 12.3 worker 崩溃后任务恢复（lease 过期回收）
- [x] 12.4 失败重试/退避/DLQ/手动重放
- [x] 12.5 外部轮询/回调闭环；签名/SSRF 负例
- [ ] 12.6 Agent 长任务不产生第二套 run 状态
- [x] 12.7 `openspec validate add-async-job-and-callback-facade --strict`
- [x] 12.8 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
