import type { QueryRunner } from 'typeorm'
import { SCHEMA_BASELINE_SQL } from './schema-baseline'
import { SCHEMA_BASELINE_DEFERRED_SQL } from './schema-baseline-deferred'

/**
 * 实体 schema 基线的**应用**逻辑（不是 `MigrationInterface`）。
 *
 * ## 为什么不是迁移类
 *
 * 直觉方案是"基线当作第一个迁移，后面照常回放历史迁移"。**实测走不通**：
 *
 *   · 基线把 `audit_logs` 按实体建全 → 历史迁移 `EnhanceAuditLogTable` 还要 `ADD COLUMN changes`
 *     → `column "changes" of relation "audit_logs" already exists`
 *   · 而历史迁移一旦提交就**不许改写**（`backend/AGENTS.md` 第 3 条）
 *
 * 于是采用标准的 **squash 基线**：空库用基线一次成型，**历史迁移不重放**，
 * 而是连同基线一起写进 TypeORM 的迁移台账（`migrations` 表）—— 之后的 `migration:run`
 * 看到它们"已应用"，不会再执行。这是 Rails / Django 做 squash 时的通行做法：
 * 新库走新路径，老库走老路径，两边的**终点是同一张 schema**（由 `verify-from-zero` 断言）。
 *
 * 所以本文件由 `scripts/rebuild-database.ts` 调用，**不在**增量迁移链里。
 */
export const BASELINE_MIGRATION_NAME = 'EntitySchemaBaseline1600000000000'

/** 基线条数（用于报告）。 */
export const BASELINE_STATEMENT_COUNT =
  SCHEMA_BASELINE_SQL.length + SCHEMA_BASELINE_DEFERRED_SQL.length

/**
 * 在**空库**上把实体 schema 一次性建出来。
 *
 * 顺序：先建表/索引/内联约束，再补指向 `organizations` 等表的外键 ——
 * 后者在建表阶段还不存在，必须等所有表建完（与"延后外键"是同一个理由，
 * 只是这里在同一段逻辑里完成，因为整张 schema 一次成型）。
 */
export async function applyEntitySchemaBaseline(queryRunner: QueryRunner): Promise<void> {
  for (const statement of SCHEMA_BASELINE_SQL) {
    await queryRunner.query(statement)
  }
  for (const statement of SCHEMA_BASELINE_DEFERRED_SQL) {
    await queryRunner.query(statement)
  }
}
