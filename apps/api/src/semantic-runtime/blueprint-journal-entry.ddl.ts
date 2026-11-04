/**
 * `blueprint_journal_entries` 的**唯一** DDL。
 *
 * 三处消费同一份：
 *   1. 增量迁移 `1791110000000-CreateBlueprintJournalEntries`
 *   2. 空库基线 `SCHEMA_BASELINE_SQL`
 *   3. e2e `beforeAll` 幂等应用
 *
 * 金额用 bigint 小单位 + scale，不用 numeric/float。
 * 外键 / 主键 / 唯一约束名用 TypeORM DefaultNamingStrategy 哈希。
 */
export const BLUEPRINT_JOURNAL_ENTRIES_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.blueprint_journal_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "blueprintId" character varying NOT NULL,
    "blueprintVersion" character varying NOT NULL,
    "ruleId" character varying NOT NULL,
    event character varying NOT NULL,
    entity character varying NOT NULL,
    "recordId" uuid NOT NULL,
    account character varying NOT NULL,
    side character varying NOT NULL,
    "amountUnits" bigint NOT NULL,
    scale integer NOT NULL,
    CONSTRAINT "PK_ed2d23a06549dafc1771ad975b6" PRIMARY KEY (id),
    CONSTRAINT "UQ_cabe470d13abf1ab79840147daf" UNIQUE ("recordId", "ruleId", account, side)
)`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'UQ_cabe470d13abf1ab79840147daf'
    ) THEN
      ALTER TABLE ONLY public.blueprint_journal_entries
        ADD CONSTRAINT "UQ_cabe470d13abf1ab79840147daf" UNIQUE ("recordId", "ruleId", account, side);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'FK_5202c3ad4ea898ae6649a4f0f84'
    ) THEN
      ALTER TABLE ONLY public.blueprint_journal_entries
        ADD CONSTRAINT "FK_5202c3ad4ea898ae6649a4f0f84"
        FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);
    END IF;
  END $$`,
]
