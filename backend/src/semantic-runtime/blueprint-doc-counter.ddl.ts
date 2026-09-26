/**
 * `blueprint_doc_counters` 的**唯一** DDL。
 *
 * 三处消费同一份，避免「迁移 / 基线 / e2e 各写一份」漂成三套 schema：
 *   1. 增量迁移 `1791000000000-CreateBlueprintDocCounters`
 *   2. 空库基线 `SCHEMA_BASELINE_SQL`（追加在末尾，此时 organizations 已存在）
 *   3. e2e `beforeAll` 幂等应用（本地 sapbasic 不靠人工 DDL）
 *
 * 主键与外键名用 TypeORM DefaultNamingStrategy 的哈希，否则 verify-from-zero 会报约束待改名。
 */
export const BLUEPRINT_DOC_COUNTERS_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.blueprint_doc_counters (
    "blueprintId" character varying NOT NULL,
    "organizationId" uuid NOT NULL,
    entity character varying NOT NULL,
    period character varying NOT NULL,
    seq integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_0d816df73344b3b37697f3cbca4" PRIMARY KEY ("blueprintId", "organizationId", entity, period)
)`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'FK_17d5de0edd64a36ebb42e286d55'
    ) THEN
      ALTER TABLE ONLY public.blueprint_doc_counters
        ADD CONSTRAINT "FK_17d5de0edd64a36ebb42e286d55"
        FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);
    END IF;
  END $$`,
]
