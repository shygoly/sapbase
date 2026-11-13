#!/usr/bin/env node
/**
 * `blueprint_records` 基准（6.7）。
 *
 * 在事务内插入合成行并 EXPLAIN ANALYZE 典型查询，最后 rollback，不污染数据。
 * 用法：
 *   npm run bench:blueprint-records
 *   BENCH_ROWS=100000 npm run bench:blueprint-records
 */
import { Client } from 'pg'

const rows = Number(process.env.BENCH_ROWS ?? 20_000)
const org = process.env.BENCH_ORG ?? process.env.ORG_ID
const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'sapbasic',
  user: process.env.DB_USERNAME || process.env.USER,
  password: process.env.DB_PASSWORD || undefined,
})

function timing(plan) {
  const root = Array.isArray(plan) ? plan[0] : plan
  return {
    executionTimeMs: root?.['Execution Time'] ?? null,
    planningTimeMs: root?.['Planning Time'] ?? null,
    plan: root?.Plan ?? null,
  }
}

await client.connect()
try {
  const orgRows = org
    ? [{ id: org }]
    : (await client.query('SELECT id FROM public.organizations ORDER BY id LIMIT 1')).rows
  if (orgRows.length === 0) throw new Error('没有可用的 organization；请设置 BENCH_ORG')
  const organizationId = orgRows[0].id

  await client.query('BEGIN')
  const started = Date.now()
  await client.query(
    `INSERT INTO public.blueprint_records (
       id, "createdAt", "updatedAt", "organizationId", "blueprintId",
       "blueprintVersion", entity, data, state, version, "archivedAt",
       "archivedBy", "archiveReason"
     )
     SELECT public.uuid_generate_v4(), now(), now(), $1, 'bench-blueprint',
            '1.0.0', 'BenchEntity',
            jsonb_build_object('name', 'bench-' || g, 'ownerId', 'bench-owner'),
            'active', 1,
            CASE WHEN g % 10 = 0 THEN now() - interval '400 days' ELSE NULL END,
            CASE WHEN g % 10 = 0 THEN 'bench' ELSE NULL END,
            CASE WHEN g % 10 = 0 THEN 'bench-retention' ELSE NULL END
       FROM generate_series(1, $2) g`,
    [organizationId, rows],
  )
  const insertMs = Date.now() - started

  const listPlan = timing(
    (
      await client.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT id, data, state
           FROM public.blueprint_records
          WHERE "organizationId" = $1
            AND "blueprintId" = 'bench-blueprint'
            AND entity = 'BenchEntity'
            AND "archivedAt" IS NULL
          ORDER BY "createdAt" DESC
          LIMIT 50`,
        [organizationId],
      )
    ).rows[0]['QUERY PLAN'],
  )
  const retentionPlan = timing(
    (
      await client.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT id
           FROM public.blueprint_records
          WHERE "organizationId" = $1
            AND "archivedAt" IS NOT NULL
            AND "archivedAt" < now() - interval '365 days'
          ORDER BY "archivedAt" ASC
          LIMIT 1000`,
        [organizationId],
      )
    ).rows[0]['QUERY PLAN'],
  )
  const countPlan = timing(
    (
      await client.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
         SELECT COUNT(*)::int
           FROM public.blueprint_records
          WHERE "organizationId" = $1 AND "archivedAt" IS NULL`,
        [organizationId],
      )
    ).rows[0]['QUERY PLAN'],
  )
  const tableRows = (
    await client.query(
      `SELECT COUNT(*)::int AS rows,
              pg_total_relation_size('public.blueprint_records')::bigint AS bytes
         FROM public.blueprint_records
        WHERE "organizationId" = $1`,
      [organizationId],
    )
  ).rows[0]

  const rowThreshold = Number(process.env.BLUEPRINT_RECORDS_PARTITION_ROWS ?? 50_000_000)
  const byteThreshold = Number(
    process.env.BLUEPRINT_RECORDS_PARTITION_BYTES ?? 50 * 1024 * 1024 * 1024,
  )
  const recommended =
    Number(tableRows.rows) >= rowThreshold || Number(tableRows.bytes) >= byteThreshold

  console.log(
    JSON.stringify(
      {
        organizationId,
        syntheticRows: rows,
        insertMs,
        table: {
          rows: Number(tableRows.rows),
          bytes: Number(tableRows.bytes),
        },
        queries: {
          tenantList50: listPlan,
          retentionBatch1000: retentionPlan,
          activeCount: countPlan,
        },
        partition: {
          recommended,
          rowThreshold,
          byteThreshold,
          reason: recommended
            ? 'threshold exceeded'
            : 'rows/bytes below thresholds; index + retention is sufficient',
        },
      },
      null,
      2,
    ),
  )
} finally {
  await client.query('ROLLBACK').catch(() => undefined)
  await client.end()
}
