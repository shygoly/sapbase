# 最小可观测（结构化日志）

> 状态：`consolidate-platform-foundations` N3
> 相关：投递失败可见性见 [`outbox.md`](./outbox.md) §6

本文件钉本轮**做了什么、明确没做什么**。可观测性栈（OTel / Prometheus / 指标）不上。

---

## 1. 本轮做

| 能力 | 落点 |
| --- | --- |
| 一行结构化日志 | `backend/src/common/logging/structured-logger.ts`：`log(level, message, fields)` |
| 格式切换 | `LOG_FORMAT=json` → `{ts, level, msg, ...fields}`；缺省 / `text` → 人类可读一行 |
| 关键路径 | 迁移 `transition`、审批 `approve`、导入 `importMaster`、outbox `drain` 每条 delivered/failed |
| 投递失败可定位 | `GET /outbox/events` 看 `attempts` / `lastError` / `status` → 修复 → `POST /outbox/events/:id/redeliver` → 再 `drain` |

日志字段只放排障需要的标识（blueprintId / entity / recordId / from / to / version；ruleId / stepIndex / role / result；imported / failed / dryRun；eventId / topic / attempts / lastError 摘要）。**不写**整份 record `data`、许可证私钥、`apiKey`。

---

## 2. 本轮明确不做

| 组件 | 决策 | 触发条件（以后再做） |
| --- | --- | --- |
| OpenTelemetry | **不做** | 规模或跨进程排障需求上升，现有 JSON 日志不够定位 |
| Prometheus / 指标栈 | **不做** | 同上；需要 SLO / 告警时再立变更 |
| 分布式追踪 | **不做** | 出现多服务调用链 |
| 日志采集 / 索引 | **不做** | 仍由进程 stdout 承担 |

判据见 `openspec/changes/consolidate-platform-foundations/design.md` §4：当前规模不值一套栈；N 阶段只要求事件投递失败可定位。

---

## 3. 排障闭环（投递失败）

1. `GET /outbox/events?status=&organizationId=` → 读 `attempts`、`lastError`、`status`。
2. 修订阅者或数据。
3. `POST /outbox/events/:id/redeliver` → `status=pending`，`attempts` 保留，`nextAttemptAt=now`。
4. 投递器 `drain()` 再投；成功则 `status=delivered`。

重投接口是 N0 已有能力，N3 不重造。
