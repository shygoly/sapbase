# `blueprint_records` 基准与保留策略（6.7）

## 如何运行

```bash
npm run bench:blueprint-records
BENCH_ROWS=100000 npm run bench:blueprint-records
```

脚本在事务内插入合成行并执行 `EXPLAIN (ANALYZE, BUFFERS)`，最后 rollback；
不污染业务数据。

## 当前基线（2026-11，dev PG）

```json
{
  "syntheticRows": 20000,
  "insertMs": 388,
  "table": { "rows": 20010, "bytes": 14802944 },
  "queries": {
    "tenantList50": 12.019,
    "retentionBatch1000": 4.291,
    "activeCount": 7.677
  },
  "partition": { "recommended": false }
}
```

查询：

1. 按 `organizationId + blueprintId + entity + archivedAt IS NULL` 取 50 行
2. 按 `organizationId + archivedAt < cutoff` 取保留批次 1000 行
3. 统计 active 行数

## 决策

当前规模下 **不启用分区**：20k 行时三条查询均 < 15ms，新增的
`(organizationId, createdAt)`、`(organizationId, blueprintId, entity)`、
`(organizationId, archivedAt)` 索引足够。

触发分区/进一步优化的条件（任一）：

- 单表 > 50,000,000 行或 > 50 GiB
- 保留清理单批 > 100k 行/天
- 列表/保留查询 P95 > 200ms

满足后再评估 `PARTITION BY HASH (organizationId)` 或按 app 的 list 分区；
分区会改变主键/唯一约束与 RLS 策略，必须单独变更审批。

## 保留策略

- 只删除 `archivedAt IS NOT NULL AND archivedAt < now() - 365 days` 的行
- active 行永不删除
- 默认每批 1000 行，dry-run 可先看候选数
- 每日 `30 4 * * *` cron `blueprint_records.retention_scan` fan-out 组织
- 手工入口：`GET /api/blueprints/records/retention/stats`、
  `POST /api/blueprints/records/retention/prune`
