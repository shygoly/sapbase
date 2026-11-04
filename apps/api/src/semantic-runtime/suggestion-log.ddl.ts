/**
 * `blueprint_suggestion_logs` 的**唯一** DDL。
 *
 * 三处消费同一份：
 *   1. 增量迁移 `1791400000000-CreateBlueprintSuggestionLogs`
 *   2. 空库基线 `SCHEMA_BASELINE_SQL`
 *   3. 单测断言这份 DDL 不是第二份建表
 *
 * 主键 / 外键 / 索引名用 TypeORM DefaultNamingStrategy 哈希。
 */
export const SUGGESTION_LOG_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.blueprint_suggestion_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "blueprintId" character varying NOT NULL,
    entity character varying NOT NULL,
    "recordId" uuid NOT NULL,
    "suggestedToState" character varying(255) NOT NULL,
    reason text,
    CONSTRAINT "PK_606cd71e8e42233e7cbd0d032ec" PRIMARY KEY (id)
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_643163585d4666a25396508f3a"
    ON public.blueprint_suggestion_logs USING btree ("blueprintId", entity, "recordId")`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'FK_88a3056b00cc91c66ab54a7fe05'
    ) THEN
      ALTER TABLE ONLY public.blueprint_suggestion_logs
        ADD CONSTRAINT "FK_88a3056b00cc91c66ab54a7fe05"
        FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);
    END IF;
  END $$`,
]
