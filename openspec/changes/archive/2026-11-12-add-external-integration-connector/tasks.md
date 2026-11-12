## 1. 契约与元语

- [x] 1.1 定义 connector/outbound/webhook/data-source/sync-job/run 的持久化形状与 Schema
- [x] 1.2 在 `docs/META_LANGUAGE.md` 登记外部集成术语与不变量（INV-EX-01..06）
- [x] 1.3 在 `DOMAIN.md` 新增集成小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [x] 1.4 在 `FLOWS.md` 登记同步/重试/对账 job
- [x] 1.5 在 `DECISIONS.md` 登记 SSRF、只读 DB、查询模板白名单、服务令牌二次校验

## 2. 存储与 RLS

- [x] 2.1 迁移：`integration_connectors` / `outbound_messages` / `webhook_endpoints` / `webhook_events` / `data_sources` / `data_sync_jobs` / `data_sync_runs`
- [x] 2.2 索引/唯一约束：connector key、webhook event id、sync job key
- [x] 2.3 新表加入 `TENANT_RLS_DDL`；跨租户负例
- [x] 2.4 TypeORM 实体与模块注册

## 3. 凭证与连接器

- [x] 3.1 `integration_connectors` CRUD + `integrations:manage`
- [x] 3.2 secretRef 解析：Bearer/API Key/Basic/OAuth2 client credentials
- [x] 3.3 连接测试（只读）；配置变更审计
- [x] 3.4 连接器启停/版本已实现；灰度发布后置（可选）
- [x] 3.5 单测：凭证不落明文、越权管理、禁用后拒绝调用

## 4. 出站 REST/Webhook

- [x] 4.1 出站消息模型 + 幂等键
- [x] 4.2 async-job 投递：认证/headers/超时/限流
- [x] 4.3 重试/退避/4xx vs 5xx/DLQ
- [x] 4.4 熔断/半开/并发展开
- [x] 4.5 SSRF allowlist/私网默认拒绝/禁止重定向
- [x] 4.6 响应截断/脱敏/审计
- [x] 4.7 单测：成功/4xx/5xx/超时/重复/SSRF

## 5. 入站 Webhook

- [x] 5.1 `webhook_endpoints` CRUD + secret
- [x] 5.2 HMAC/时间戳/重放保护
- [x] 5.3 幂等 eventId + payload hash
- [x] 5.4 声明式 mapping → 内部事件/工具
- [x] 5.5 失败重放/DLQ/大小限制
- [x] 5.6 单测：签名错、过期、重复、未知事件、超大 payload

## 6. 数据库连接器

- [x] 6.1 `data_sources` CRUD + 连接测试（只读）
- [x] 6.2 Postgres 只读驱动已实现；MySQL/MSSQL/Oracle 驱动与真实源库后置
- [x] 6.3 TLS/allowlist/只读账号/最小权限
- [x] 6.4 查询模板白名单 + 参数化
- [x] 6.5 `data_sync_jobs`：字段映射/游标/批量/模式
- [x] 6.6 `data_sync_runs` + async-job 执行
- [x] 6.7 源库压力控制：限流/超时/批量
- [x] 6.8 单测：只读、注入防护、超时、字段映射

## 7. 同步与对账

- [x] 7.1 增量水位/游标；full/incremental
- [x] 7.2 幂等写入：唯一键/导入适配器
- [x] 7.3 对账：源/目标计数、校验和、差异报告
- [x] 7.4 失败行报告/重试/告警
- [x] 7.5 手动重跑/并发限制已实现；cron 调度后置
- [x] 7.6 单测：重复同步、断点续跑、差异告警

## 8. 外部系统调用平台

- [x] 8.1 服务令牌/委托身份接入（配合 identity change）
- [x] 8.2 scope + 功能权限 + 数据范围二次校验
- [x] 8.3 OpenAPI/Swagger 已暴露；出站有限流，外部入站 API 限流后置
- [x] 8.4 负例：伪造 subject、越权 scope、跨组织、过期 token

## 9. 安全与审计

- [x] 9.1 SSRF/内网/元数据防护
- [x] 9.2 凭证加密/脱敏/轮换
- [x] 9.3 PII 最小化/脱敏
- [x] 9.4 连接器变更/调用/同步/失败/对账审计
- [x] 9.5 负例：恶意 URL、注入 SQL、越权源库、明文密钥

## 10. 管理端与验收

- [x] 10.1 Portal 连接器管理/测试已实现；Console 复用同一 API 后置
- [x] 10.2 Portal 同步任务/运行/差异/重跑已实现；Console 复用同一 API 后置
- [x] 10.3 Portal 出站/DLQ/重放已实现；Console 复用同一 API 后置
- [x] 10.4 指标：成功率/重试/差异/耗时
- [x] 10.5 e2e：教务源增量同步班级/学生 + 对账
- [x] 10.6 e2e：外部系统服务令牌调用平台 API
- [x] 10.7 `openspec validate add-external-integration-connector --strict`
- [x] 10.8 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
