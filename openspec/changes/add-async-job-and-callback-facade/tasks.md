## 1. 契约与元语

- [ ] 1.1 定义 `job` / `job-attempt` / `job-event` / `job-type` 的持久化形状与 JSON Schema
- [ ] 1.2 在 `docs/META_LANGUAGE.md` 登记任务/回调术语与不变量（INV-JOB-01..05）
- [ ] 1.3 在 `DOMAIN.md` 新增任务小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [ ] 1.4 在 `FLOWS.md` 登记任务/回调相关 job（如启用）
- [ ] 1.5 在 `DECISIONS.md` 登记 PG 真源 + Redis 唤醒、至少一次 + 幂等、Agent Runtime 边界

## 2. 存储与 RLS

- [ ] 2.1 迁移：`jobs` / `job_attempts` / `job_events`
- [ ] 2.2 索引：`(status, runAt, priority)`、`(organizationId, status, createdAt)`、幂等唯一约束
- [ ] 2.3 新表加入 `TENANT_RLS_DDL`；跨租户负例
- [ ] 2.4 TypeORM 实体与模块注册

## 3. 任务类型注册

- [ ] 3.1 `JobTypeDefinition` + registry（payload schema、handler、timeout、retry、concurrency）
- [ ] 3.2 启动时校验重复类型/非法 schema
- [ ] 3.3 未知类型/非法 payload 拒绝入队
- [ ] 3.4 类型版本 `typeVersion` 与兼容策略
- [ ] 3.5 单测：注册、校验、未知类型

## 4. 队列与 worker

- [ ] 4.1 `JobQueue` 接口 + PG 实现（`FOR UPDATE SKIP LOCKED`）
- [ ] 4.2 Redis 唤醒 + cron 兜底扫描
- [ ] 4.3 worker 领取/lease/heartbeat/超时重新入队
- [ ] 4.4 并发/优先级/限流
- [ ] 4.5 优雅停机/取消协作
- [ ] 4.6 单测：并发领取、崩溃恢复、重复领取

## 5. 生命周期与重试

- [ ] 5.1 状态机：queued/running/succeeded/failed/cancelled/waiting/dead
- [ ] 5.2 进度/阶段/日志事件
- [ ] 5.3 超时/重试/指数退避
- [ ] 5.4 DLQ：dead 任务、手动重放
- [ ] 5.5 取消：queued/running/waiting
- [ ] 5.6 单测：超时、重试、DLQ、取消

## 6. 幂等

- [ ] 6.1 唯一键 `(organizationId, type, idempotencyKey)`
- [ ] 6.2 重复入队返回已存在任务
- [ ] 6.3 handler 幂等约定与测试
- [ ] 6.4 外部 Idempotency-Key 头/字段

## 7. 外部任务 API

- [ ] 7.1 `POST /jobs` 创建（类型/权限/配额/payload 校验）
- [ ] 7.2 `GET /jobs/:id` 状态/进度/结果/错误
- [ ] 7.3 `POST /jobs/:id/cancel`
- [ ] 7.4 列表查询（管理员/所有者）
- [ ] 7.5 组织/应用上下文来自可信身份，不接受 body 覆盖
- [ ] 7.6 限流/最大 payload/并发配额
- [ ] 7.7 API 文档与 `api-client`

## 8. 外部回调

- [ ] 8.1 `callbackUrl` / `callbackSecretRef` / HMAC 签名
- [ ] 8.2 回调重试/退避/超时/2xx 判定
- [ ] 8.3 SSRF 防护：https/allowlist/私网默认拒绝/禁止重定向
- [ ] 8.4 回调状态查询与手动重放
- [ ] 8.5 负例：伪造签名、内网地址、重定向、超时、重复回调

## 9. 进度事件

- [ ] 9.1 `job_events` 写入与序号
- [ ] 9.2 WebSocket/SSE 推送
- [ ] 9.3 `afterSeq` 回放
- [ ] 9.4 事件保留期/清理
- [ ] 9.5 单测：乱序/重复/断线重连

## 10. 消费方接入

- [ ] 10.1 导入/导出任务（配合 `add-bulk-import-export-framework`）
- [ ] 10.2 媒体扫描/转码任务（配合 `add-asset-and-media-pipeline`）
- [ ] 10.3 文档解析任务（配合 `add-document-intelligence`）
- [ ] 10.4 Agent 长任务：携带 `agentRunId`，桥接事件，不复制 run 状态
- [ ] 10.5 内容生成任务

## 11. 管理面与观测

- [ ] 11.1 任务中心：列表/筛选/详情/事件
- [ ] 11.2 重试/取消/DLQ 重放
- [ ] 11.3 指标：积压/成功率/耗时/回调失败
- [ ] 11.4 告警：积压/失败率/超时
- [ ] 11.5 权限点：`jobs:read` / `jobs:manage`

## 12. 验收

- [ ] 12.1 事务回滚不留任务
- [ ] 12.2 重复幂等键只执行一次
- [ ] 12.3 worker 崩溃后任务恢复
- [ ] 12.4 失败重试/退避/DLQ/手动重放
- [ ] 12.5 外部轮询/回调闭环；签名/SSRF 负例
- [ ] 12.6 Agent 长任务不产生第二套 run 状态
- [ ] 12.7 `openspec validate add-async-job-and-callback-facade --strict`
- [ ] 12.8 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
